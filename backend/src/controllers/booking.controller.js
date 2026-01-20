import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";
import User from "../models/User.js";
import { normalizePlate } from "../utils/plate.js";
import {
  formatIstDateYmd,
  getBookingStartEndIst,
  getTodayIstRange,
  makeUtcDateFromIstParts,
  parseYmd,
} from "../utils/ist.js";

function requireOwner(req, res) {
  if (req.user?.role !== "OWNER") {
    res.status(403).json({ message: "Access denied" });
    return false;
  }
  return true;
}

function getTodayRange() {
  // Production servers often run in UTC; bookings are intended for IST.
  return getTodayIstRange(new Date());
}

function getBookingStartEnd(booking) {
  return getBookingStartEndIst(booking);
}

async function assertOwnerOwnsParking(req, res, parkingId) {
  const parking = await Parking.findById(parkingId);
  if (!parking) {
    res.status(404).json({ message: "Parking not found" });
    return null;
  }
  if (parking.ownerId.toString() !== req.user.id) {
    res.status(403).json({ message: "Access denied" });
    return null;
  }
  return parking;
}

async function findTodaysBookingByPlate({ parkingId, plate, statuses }) {
  const { start, end, now } = getTodayRange();
  const candidates = await Booking.find({
    parkingId,
    status: { $in: statuses },
    bookingDate: { $gte: start, $lt: end },
  }).sort({ createdAt: -1 });

  const plateNorm = normalizePlate(plate);
  if (!plateNorm) return { booking: null, now, plateNorm };

  const matched = candidates.find(
    (b) =>
      normalizePlate(b.vehicleNumber) === plateNorm &&
      (b.gateStatus ?? "PENDING_ENTRY") !== "CHECKED_OUT"
  );
  return { booking: matched || null, now, plateNorm };
}

function bumpSlotsOnCheckout(parking) {
  if (!parking) return;
  parking.availableSlots = Number(parking.availableSlots || 0) + 1;
  if (parking.totalSlots !== undefined && parking.totalSlots !== null) {
    parking.availableSlots = Math.min(parking.availableSlots, Number(parking.totalSlots));
  }
}

function computeOverstayFine({ booking, now }) {
  const { end } = getBookingStartEnd(booking);
  if (!end) return { overstayMinutes: 0, overstayFine: 0 };

  const exitGraceMs = 5 * 60 * 1000;
  const billableMs = Math.max(0, now.getTime() - (end.getTime() + exitGraceMs));
  if (billableMs <= 0) return { overstayMinutes: 0, overstayFine: 0 };

  const billableMinutes = Math.ceil(billableMs / (60 * 1000));
  const units15 = Math.ceil(billableMs / (15 * 60 * 1000));
  const fine = units15 * 10; // ₹10 per 15 minutes

  return { overstayMinutes: billableMinutes, overstayFine: fine };
}

function addLiveOverstayFields(bookingDoc, now) {
  const booking = bookingDoc?.toObject ? bookingDoc.toObject() : bookingDoc;
  if (!booking) return booking;

  const gate = booking.gateStatus ?? "PENDING_ENTRY";
  if (gate === "CHECKED_OUT" || booking.status === "COMPLETED") {
    booking.overstayMinutesDue = 0;
    booking.overstayFineDue = 0;
    return booking;
  }

  if (!["CHECKED_IN", "OVERSTAYED"].includes(booking.status)) {
    booking.overstayMinutesDue = 0;
    booking.overstayFineDue = 0;
    return booking;
  }

  const { overstayMinutes, overstayFine } = computeOverstayFine({ booking, now });
  booking.overstayMinutesDue = overstayMinutes;
  booking.overstayFineDue = overstayFine;
  return booking;
}

// =========================
// CREATE BOOKING (PHASE 2)
// =========================
export const createBooking = async (req, res) => {
  try {
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
      duration: clientDuration,
      totalPrice: clientTotalPrice,
    } = req.body;

    if (
      !parkingId ||
      !vehicleNumber ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const bookingDateStr = bookingDate || formatIstDateYmd(new Date());
    const ymd = parseYmd(bookingDateStr);
    if (!ymd) {
      return res.status(400).json({ message: "Invalid booking date" });
    }

    // Store as the UTC instant corresponding to IST midnight for that date.
    const bookingDateOnly = makeUtcDateFromIstParts({ ...ymd, hour: 0, minute: 0, second: 0, ms: 0 });

    const [startHRaw, startMRaw] = String(startTime).split(":");
    const [endHRaw, endMRaw] = String(endTime).split(":");
    const startH = Number(startHRaw);
    const startM = Number(startMRaw);
    const endH = Number(endHRaw);
    const endM = Number(endMRaw);
    if (
      [startH, startM, endH, endM].some((n) => Number.isNaN(n))
    ) {
      return res.status(400).json({ message: "Invalid start/end time" });
    }

    const startDateTime = makeUtcDateFromIstParts({ ...ymd, hour: startH, minute: startM, second: 0, ms: 0 });
    const endDateTime = makeUtcDateFromIstParts({ ...ymd, hour: endH, minute: endM, second: 0, ms: 0 });

    if (endDateTime <= startDateTime) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    const parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }

    if (parking.availableSlots <= 0) {
      return res.status(400).json({ message: "No slots available" });
    }

    parking.availableSlots -= 1;
    await parking.save();

    const hours = Math.ceil(
      (endDateTime - startDateTime) / (1000 * 60 * 60)
    );
    const duration = Math.max(1, hours);
    const totalPrice = duration * Number(parking.price);

    if (clientDuration && Number(clientDuration) !== duration) {
      // Non-fatal: server is source of truth
    }
    if (clientTotalPrice && Number(clientTotalPrice) !== totalPrice) {
      // Non-fatal: server is source of truth
    }

    const user = await User.findById(userId).select("name email phone");

    const now = new Date();
    const initialStatus = now < startDateTime ? "UPCOMING" : now < endDateTime ? "ACTIVE" : "EXPIRED";

    if (initialStatus === "EXPIRED") {
      // Do not allow creating a booking for a past time window.
      bumpSlotsOnCheckout(parking);
      await parking.save();
      return res.status(400).json({ message: "Booking time has already passed" });
    }

    const booking = await Booking.create({
      userId,
      parkingId,
      vehicleNumber,
      customerName: String(customerName ?? user?.name ?? "").trim() || undefined,
      customerEmail:
        String(customerEmail ?? user?.email ?? "").trim().toLowerCase() || undefined,
      customerPhone: String(customerPhone ?? user?.phone ?? "").trim() || undefined,
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
      duration,
      totalPrice,
      status: initialStatus,
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create booking" });
  }
};

// =========================
// GET USER BOOKINGS
// =========================
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
    })
      .populate("parkingId", "name lat lng")
      .sort({ createdAt: -1 });

    const now = new Date();
    res.json((bookings || []).map((b) => addLiveOverstayFields(b, now)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// =========================
// GET OWNER BOOKINGS
// =========================
export const getOwnerBookings = async (req, res) => {
  try {
    if (req.user.role !== "OWNER") {
      return res.status(403).json({ message: "Access denied" });
    }

    const ownerParkings = await Parking.find({ ownerId: req.user.id }).select(
      "_id"
    );
    const parkingIds = ownerParkings.map((p) => p._id);

    const { parkingId } = req.query;
    // Owners shouldn't see temporary slot-hold records (PENDING_PAYMENT) or unpaid holds.
    // Only show bookings that are actually paid (or legacy bookings without a payment record).
    let match = {
      parkingId: { $in: parkingIds },
      status: { $ne: "PENDING_PAYMENT" },
      $or: [{ "payment.status": "PAID" }, { payment: { $exists: false } }],
    };
    if (parkingId) {
      const found = parkingIds.some((id) => id.toString() === String(parkingId));
      if (!found) {
        return res.status(403).json({ message: "Access denied" });
      }
      match = {
        parkingId,
        status: { $ne: "PENDING_PAYMENT" },
        $or: [{ "payment.status": "PAID" }, { payment: { $exists: false } }],
      };
    }

    const bookings = await Booking.find(match)
      .populate("parkingId", "name lat lng")
      .populate("userId", "email")
      .sort({ createdAt: -1 });

    const now = new Date();
    res.json((bookings || []).map((b) => addLiveOverstayFields(b, now)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch owner bookings" });
  }
};

// =========================
// CANCEL BOOKING
// =========================
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (
      booking.userId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (!['UPCOMING', 'ACTIVE'].includes(booking.status) || (booking.gateStatus ?? "PENDING_ENTRY") !== "PENDING_ENTRY") {
      return res
        .status(400)
        .json({ message: "Booking cannot be cancelled" });
    }

    const now = new Date();
    const { start } = getBookingStartEnd(booking);

    let refundPercent = 0;

    // 100% refund only for instant cancellation right after PAYMENT succeeds.
    if (
      booking.payment?.status === "PAID" &&
      booking.payment?.paidAt &&
      now.getTime() - new Date(booking.payment.paidAt).getTime() <= 2 * 60 * 1000
    ) {
      refundPercent = 1;
    } else if (start && now.getTime() < start.getTime()) {
      // Otherwise, refund is based ONLY on time-to-start.
      const msToStart = start.getTime() - now.getTime();
      if (msToStart >= 60 * 60 * 1000) {
        refundPercent = 0.75;
      } else if (msToStart >= 30 * 60 * 1000) {
        refundPercent = 0.5;
      } else {
        refundPercent = 0;
      }
    } else {
      refundPercent = 0;
    }

    const totalPrice = Number(booking.totalPrice || 0);
    const refundAmount = Math.max(0, Math.min(totalPrice, Math.round(totalPrice * refundPercent)));

    booking.status = "CANCELLED";
    booking.cancelledAt = now;
    booking.refundPercent = refundPercent;
    booking.refundAmount = refundAmount;
    await booking.save();

    // 🔼 Restore parking slot
    const parking = await Parking.findById(booking.parkingId);
    if (parking) {
      bumpSlotsOnCheckout(parking);
      await parking.save();
    }

    res.json({
      message: "Booking cancelled",
      refundPercent,
      refundAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};

// =========================
// OWNER: CHECK-IN / CHECK-OUT (PLATE OCR)
// =========================
export const ownerCheckInByPlate = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { parkingId, plateNumber, rawText, confidence } = req.body;
    if (!parkingId || !plateNumber) {
      return res.status(400).json({ message: "parkingId and plateNumber are required" });
    }

    const parking = await assertOwnerOwnsParking(req, res, parkingId);
    if (!parking) return;

    const { booking, now, plateNorm } = await findTodaysBookingByPlate({
      parkingId,
      plate: plateNumber,
      statuses: ["ACTIVE"],
    });

    if (!booking) {
      return res.status(404).json({ message: "No active booking found for this plate today" });
    }

    {
      const { start, end } = getBookingStartEnd(booking);
      if (start && end) {
        const graceMs = 30 * 60 * 1000;
        if (now.getTime() < start.getTime() - graceMs) {
          return res.status(400).json({ message: "Too early for this booking" });
        }
        if (now.getTime() > end.getTime() + graceMs) {
          return res.status(400).json({ message: "Booking time has passed" });
        }
      }
    }

    if (booking.gateStatus === "CHECKED_OUT") {
      return res.status(400).json({ message: "Booking already checked out" });
    }

    if (booking.gateStatus !== "CHECKED_IN") {
      booking.gateStatus = "CHECKED_IN";
      booking.checkedInAt = now;
      booking.entryMethod = "PLATE_OCR";
      booking.status = "CHECKED_IN";
    }

    booking.lastPlateScan = {
      rawText: rawText ? String(rawText).slice(0, 200) : undefined,
      normalized: plateNorm,
      confidence: typeof confidence === "number" ? confidence : undefined,
      scannedAt: now,
    };

    await booking.save();
    return res.json({ message: "Checked in", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check in" });
  }
};

export const ownerCheckOutByPlate = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { parkingId, plateNumber, rawText, confidence } = req.body;
    if (!parkingId || !plateNumber) {
      return res.status(400).json({ message: "parkingId and plateNumber are required" });
    }

    const parking = await assertOwnerOwnsParking(req, res, parkingId);
    if (!parking) return;

    const { booking, now, plateNorm } = await findTodaysBookingByPlate({
      parkingId,
      plate: plateNumber,
      statuses: ["CHECKED_IN", "OVERSTAYED"],
    });

    if (!booking) {
      return res.status(404).json({ message: "No active booking found for this plate today" });
    }

    if (booking.gateStatus !== "CHECKED_IN") {
      return res.status(400).json({ message: "Booking is not checked in yet" });
    }

    if (booking.gateStatus === "CHECKED_OUT" || booking.checkedOutAt) {
      return res.status(400).json({ message: "Booking already checked out" });
    }

    const { overstayMinutes, overstayFine } = computeOverstayFine({ booking, now });

    booking.gateStatus = "CHECKED_OUT";
    booking.checkedOutAt = now;
    booking.exitMethod = "PLATE_OCR";
    booking.status = "COMPLETED";
    booking.overstayMinutes = overstayMinutes;
    booking.overstayFine = overstayFine;
    booking.lastPlateScan = {
      rawText: rawText ? String(rawText).slice(0, 200) : undefined,
      normalized: plateNorm,
      confidence: typeof confidence === "number" ? confidence : undefined,
      scannedAt: now,
    };

    await booking.save();

    bumpSlotsOnCheckout(parking);
    await parking.save();

    return res.json({ message: "Checked out", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check out" });
  }
};

// =========================
// OWNER: CHECK-IN / CHECK-OUT (QR / BOOKING ID)
// =========================
export const ownerCheckInByBookingId = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { bookingId, parkingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const parking = await assertOwnerOwnsParking(req, res, parkingId || booking.parkingId);
    if (!parking) return;

    if (String(booking.parkingId) !== String(parking._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (booking.status !== "ACTIVE") {
      return res.status(400).json({ message: "Booking is not active" });
    }

    {
      const now = new Date();
      const { start, end } = getBookingStartEnd(booking);
      if (start && end) {
        const graceMs = 30 * 60 * 1000;
        if (now.getTime() < start.getTime() - graceMs) {
          return res.status(400).json({ message: "Too early for this booking" });
        }
        if (now.getTime() > end.getTime() + graceMs) {
          return res.status(400).json({ message: "Booking time has passed" });
        }
      }
    }

    if (booking.gateStatus === "CHECKED_OUT") {
      return res.status(400).json({ message: "Booking already checked out" });
    }

    if (booking.gateStatus !== "CHECKED_IN") {
      booking.gateStatus = "CHECKED_IN";
      booking.checkedInAt = new Date();
      booking.entryMethod = "QR";
      booking.status = "CHECKED_IN";
      await booking.save();
    }

    return res.json({ message: "Checked in", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check in" });
  }
};

export const ownerCheckOutByBookingId = async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { bookingId, parkingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const parking = await assertOwnerOwnsParking(req, res, parkingId || booking.parkingId);
    if (!parking) return;

    if (String(booking.parkingId) !== String(parking._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!["CHECKED_IN", "OVERSTAYED"].includes(booking.status)) {
      return res.status(400).json({ message: "Booking is not checked in" });
    }

    if (booking.gateStatus !== "CHECKED_IN") {
      return res.status(400).json({ message: "Booking is not checked in yet" });
    }

    if (booking.gateStatus === "CHECKED_OUT" || booking.checkedOutAt) {
      return res.status(400).json({ message: "Booking already checked out" });
    }

    const now = new Date();
    const { overstayMinutes, overstayFine } = computeOverstayFine({ booking, now });

    booking.gateStatus = "CHECKED_OUT";
    booking.checkedOutAt = now;
    booking.exitMethod = "QR";
    booking.status = "COMPLETED";
    booking.overstayMinutes = overstayMinutes;
    booking.overstayFine = overstayFine;
    await booking.save();

    bumpSlotsOnCheckout(parking);
    await parking.save();

    return res.json({ message: "Checked out", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check out" });
  }
};
