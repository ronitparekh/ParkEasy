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

async function findTodaysActiveBookingByPlate({ parkingId, plate }) {
  const { start, end, now } = getTodayRange();
  const candidates = await Booking.find({
    parkingId,
    status: "ACTIVE",
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
      status: "ACTIVE",
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

    res.json(bookings);
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
    let match = { parkingId: { $in: parkingIds } };
    if (parkingId) {
      const found = parkingIds.some((id) => id.toString() === String(parkingId));
      if (!found) {
        return res.status(403).json({ message: "Access denied" });
      }
      match = { parkingId };
    }

    const bookings = await Booking.find(match)
      .populate("parkingId", "name lat lng")
      .populate("userId", "email")
      .sort({ createdAt: -1 });

    res.json(bookings);
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

    if (booking.status !== "ACTIVE") {
      return res
        .status(400)
        .json({ message: "Booking cannot be cancelled" });
    }

    booking.status = "CANCELLED";
    await booking.save();

    // 🔼 Restore parking slot
    const parking = await Parking.findById(booking.parkingId);
    if (parking) {
      parking.availableSlots += 1;
      await parking.save();
    }

    res.json({ message: "Booking cancelled" });
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

    const { booking, now, plateNorm } = await findTodaysActiveBookingByPlate({
      parkingId,
      plate: plateNumber,
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

    const { booking, now, plateNorm } = await findTodaysActiveBookingByPlate({
      parkingId,
      plate: plateNumber,
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

    booking.gateStatus = "CHECKED_OUT";
    booking.checkedOutAt = now;
    booking.exitMethod = "PLATE_OCR";
    booking.status = "COMPLETED";
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

    if (booking.status !== "ACTIVE") {
      return res.status(400).json({ message: "Booking is not active" });
    }

    if (booking.gateStatus !== "CHECKED_IN") {
      return res.status(400).json({ message: "Booking is not checked in yet" });
    }

    if (booking.gateStatus === "CHECKED_OUT" || booking.checkedOutAt) {
      return res.status(400).json({ message: "Booking already checked out" });
    }

    booking.gateStatus = "CHECKED_OUT";
    booking.checkedOutAt = new Date();
    booking.exitMethod = "QR";
    booking.status = "COMPLETED";
    await booking.save();

    bumpSlotsOnCheckout(parking);
    await parking.save();

    return res.json({ message: "Checked out", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check out" });
  }
};
