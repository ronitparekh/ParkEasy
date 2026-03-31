import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";
import User from "../models/User.js";
import {
  buildActiveBookingsCapacityQuery,
  computeBookableLimit,
  computeConflictBuffer,
  countOverlappingBookings,
} from "../utils/capacity.js";
import {
  formatIstDateYmd,
  getBookingStartEndIst,
  makeUtcDateFromIstParts,
  parseYmd,
} from "../utils/ist.js";
import { calculateDynamicPrice } from "../utils/price.js";
import { emitDataUpdated } from "../realtime/socket.js";

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function getRazorpayKey(req, res) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    return res.status(500).json({ message: "Razorpay is not configured" });
  }
  res.json({ keyId });
}

// Create a 2-minute hold + Razorpay order
export async function createRazorpayOrder(req, res) {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(500).json({ message: "Razorpay is not configured" });
    }

    const userId = req.user.id;
    const {
      parkingId,
      vehicleNumber,
      bookingDate,
      startTime,
      endTime,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    const vehicleNumberClean = String(vehicleNumber ?? "").trim().toUpperCase();
    if (!parkingId || !vehicleNumberClean || !startTime || !endTime) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const bookingDateStr = bookingDate || formatIstDateYmd(new Date());
    const ymd = parseYmd(bookingDateStr);
    if (!ymd) {
      return res.status(400).json({ message: "Invalid booking date" });
    }

    const bookingDateOnly = makeUtcDateFromIstParts({ ...ymd, hour: 0, minute: 0, second: 0, ms: 0 });

    const [startHRaw, startMRaw] = String(startTime).split(":");
    const [endHRaw, endMRaw] = String(endTime).split(":");
    const startH = Number(startHRaw);
    const startM = Number(startMRaw);
    const endH = Number(endHRaw);
    const endM = Number(endMRaw);
    if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: "Invalid start/end time" });
    }

    const startDateTime = makeUtcDateFromIstParts({ ...ymd, hour: startH, minute: startM, second: 0, ms: 0 });
    const endDateTime = makeUtcDateFromIstParts({ ...ymd, hour: endH, minute: endM, second: 0, ms: 0 });

    if (endDateTime <= startDateTime) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + 2 * 60 * 1000);

    // If the user already successfully paid for the exact same slot details,
    // do not create another PENDING_PAYMENT hold booking (this commonly happens
    // if they revisit/refresh the payment page after success).
    const alreadyPaid = await Booking.findOne({
      userId,
      parkingId,
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
      vehicleNumber: vehicleNumberClean,
      status: { $in: ["UPCOMING", "ACTIVE", "CHECKED_IN", "OVERSTAYED", "COMPLETED"] },
      "payment.status": "PAID",
    }).select("_id status");

    if (alreadyPaid) {
      return res.status(200).json({
        alreadyPaid: true,
        bookingId: alreadyPaid._id,
        status: alreadyPaid.status,
      });
    }

    // Reuse an existing unexpired pending booking (prevents double-hold on refresh)
    const existing = await Booking.findOne({
      userId,
      parkingId,
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
      vehicleNumber: vehicleNumberClean,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    if (existing?.payment?.orderId) {
      return res.json({
        bookingId: existing._id,
        orderId: existing.payment.orderId,
        amount: existing.payment.amount,
        currency: existing.payment.currency || "INR",
        holdExpiresAt: existing.holdExpiresAt,
      });
    }

    // Fetch parking and check capacity by counting bookings that overlap with requested time slot
    let parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }

    const totalSlotsNum = Number(parking.totalSlots || 0);
    if (!Number.isFinite(totalSlotsNum) || totalSlotsNum <= 0) {
      return res.status(400).json({ message: "Invalid parking configuration" });
    }

    // Check capacity by counting bookings that overlap with requested time slot on the same date.
    const overlappingBookings = await Booking.find({
      parkingId,
      bookingDate: bookingDateOnly,
    });

    const overlappingCount = countOverlappingBookings(overlappingBookings, {
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
    });

    if (overlappingCount >= totalSlotsNum) {
      return res.status(400).json({ message: "All slots booked for this time slot" });
    }

    // For today's bookings, decrement availableSlots; for future dates, don't touch it
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const isToday = bookingDateOnly.getTime() === todayUTC.getTime();

    if (isToday) {
      parking.availableSlots = Math.max(0, Number(parking.availableSlots || 0) - 1);
      await parking.save();
    }

    const hours = Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60));
    const duration = Math.max(1, hours);
    const pricing = calculateDynamicPrice({
      baseRate: parking.price,
      durationHours: duration,
      totalSlots: parking.totalSlots,
      availableSlots: isToday ? parking.availableSlots : parking.totalSlots - overlappingCount,
      bookingDateYmd: bookingDateStr,
    });
    const totalPrice = pricing.totalPrice;

    const user = await User.findById(userId).select("name email phone");

    const booking = await Booking.create({
      userId,
      parkingId,
      vehicleNumber: vehicleNumberClean,
      customerName: String(customerName ?? user?.name ?? "").trim() || undefined,
      customerEmail: String(customerEmail ?? user?.email ?? "")
        .trim()
        .toLowerCase() || undefined,
      customerPhone: String(customerPhone ?? user?.phone ?? "").trim() || undefined,
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
      duration,
      totalPrice,
      status: "PENDING_PAYMENT",
      holdExpiresAt,
      payment: {
        provider: "RAZORPAY",
        currency: "INR",
        amount: Math.round(Number(totalPrice) * 100),
        status: "CREATED",
      },
    });
    emitDataUpdated({ type: "BOOKING_CREATED", bookingId: String(booking._id), parkingId: String(parkingId) });

    try {
      const order = await razorpay.orders.create({
        amount: booking.payment.amount,
        currency: "INR",
        receipt: String(booking._id),
        notes: {
          bookingId: String(booking._id),
          parkingId: String(parkingId),
          userId: String(userId),
        },
      });

      booking.payment.orderId = order.id;
      await booking.save();
      emitDataUpdated({ type: "BOOKING_UPDATED", bookingId: String(booking._id), parkingId: String(parkingId) });

      res.status(201).json({
        bookingId: booking._id,
        orderId: order.id,
        amount: booking.payment.amount,
        currency: "INR",
        holdExpiresAt: booking.holdExpiresAt,
      });
    } catch (err) {
      // If order creation fails, release the held slot
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          status: "PAYMENT_FAILED",
          "payment.status": "FAILED",
          "payment.failedAt": new Date(),
          "payment.failureReason": "ORDER_CREATE_FAILED",
        },
      });
      await Parking.findByIdAndUpdate(parkingId, { $inc: { availableSlots: 1 } });
      emitDataUpdated({ type: "BOOKING_UPDATED", bookingId: String(booking._id), parkingId: String(parkingId) });

      console.error(err);
      return res.status(500).json({ message: "Failed to create Razorpay order" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
}

export async function verifyRazorpayPayment(req, res) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ message: "Razorpay is not configured" });
    }

    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return res.status(400).json({ message: "Booking is not pending payment" });
    }

    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
      return res.status(400).json({ message: "Payment window expired" });
    }

    if (booking.payment?.orderId && booking.payment.orderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order ID mismatch" });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");

    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const now = new Date();
    const { start, end } = getBookingStartEndIst(booking);
    const nextStatus = start && end ? (now < start ? "UPCOMING" : now < end ? "ACTIVE" : "EXPIRED") : "ACTIVE";

    if (nextStatus === "EXPIRED") {
      booking.status = "EXPIRED";
      booking.payment = {
        ...(booking.payment || {}),
        provider: "RAZORPAY",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        status: "FAILED",
        failedAt: now,
        failureReason: "BOOKING_WINDOW_PASSED",
      };
      await booking.save();

      await Parking.findByIdAndUpdate(booking.parkingId, { $inc: { availableSlots: 1 } });
      emitDataUpdated({ type: "BOOKING_UPDATED", bookingId: String(booking._id), parkingId: String(booking.parkingId) });
      return res.status(400).json({ message: "Booking time has already passed" });
    }

    booking.status = nextStatus;
    booking.payment = {
      ...(booking.payment || {}),
      provider: "RAZORPAY",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      status: "PAID",
      paidAt: now,
    };
    booking.holdExpiresAt = undefined;

    await booking.save();
    emitDataUpdated({ type: "BOOKING_UPDATED", bookingId: String(booking._id), parkingId: String(booking.parkingId) });

    res.json({ message: "Payment verified", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
}
