import Parking from "../models/Parking.js";
import Booking from "../models/Booking.js";
import { calculateDynamicPrice } from "../utils/price.js";
import { countOverlappingBookings } from "../utils/capacity.js";
import { formatIstDateYmd, getIstDateParts, makeUtcDateFromIstParts, parseYmd } from "../utils/ist.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function addMinutesToTimeStr(timeStr, minutesToAdd) {
  const [hRaw, mRaw] = String(timeStr || "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;
  const total = h * 60 + m + Number(minutesToAdd || 0);
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

// GET /parking/:id
export const getParkingById = async (req, res) => {
  try {
    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }
    res.json(parking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch parking" });
  }
};

// GET /parking/nearby
export const getNearbyParkings = async (req, res) => {
  try {
    const {
      lat,
      lng,
      distance,
      search,
    } = req.query;

    const query = {};

    // =========================
    // NAME SEARCH (GLOBAL)
    // =========================
    if (search) {
      query.name = {
        $regex: search,
        $options: "i", // case-insensitive
      };
    }

    // =========================
    // DISTANCE FILTER (OPTIONAL)
    // =========================
    let parkings = await Parking.find(query);

    // Compute live availability for "now" in IST based on overlapping bookings,
    // so future bookings do not affect currently visible availability.
    if (parkings.length) {
      const now = new Date();
      const nowYmd = formatIstDateYmd(now);
      const ymd = parseYmd(nowYmd);
      if (ymd) {
        const bookingDateOnly = makeUtcDateFromIstParts({
          ...ymd,
          hour: 0,
          minute: 0,
          second: 0,
          ms: 0,
        });

        const nowParts = getIstDateParts(now);
        const nowTime = `${pad2(nowParts.hour)}:${pad2(nowParts.minute)}`;
        const nowPlusOneMinute = addMinutesToTimeStr(nowTime, 1);

        const parkingIds = parkings.map((p) => p._id);
        const todaysBookings = await Booking.find({
          parkingId: { $in: parkingIds },
          bookingDate: bookingDateOnly,
          status: {
            $nin: [
              "CANCELLED",
              "COMPLETED",
              "EXPIRED",
              "PENDING_PAYMENT",
              "PAYMENT_FAILED",
            ],
          },
        }).select("parkingId bookingDate startTime endTime status");

        const bookingsByParking = new Map();
        for (const b of todaysBookings) {
          const key = String(b.parkingId);
          const arr = bookingsByParking.get(key) || [];
          arr.push(b);
          bookingsByParking.set(key, arr);
        }

        parkings = parkings.map((p) => {
          const pObj = p.toObject ? p.toObject() : p;
          const related = bookingsByParking.get(String(p._id)) || [];
          const overlapCount = countOverlappingBookings(related, {
            bookingDate: bookingDateOnly,
            startTime: nowTime,
            endTime: nowPlusOneMinute,
          });
          const totalSlotsNum = Number(p.totalSlots || 0);
          pObj.availableSlots = Math.max(0, totalSlotsNum - overlapCount);
          return pObj;
        });
      }
    }

    if (lat && lng && distance) {
      const userLat = Number(lat);
      const userLng = Number(lng);
      const maxDistanceKm = Number(distance);

      parkings = parkings.filter((p) => {
        const d = getDistanceKm(
          userLat,
          userLng,
          p.lat,
          p.lng
        );
        return d <= maxDistanceKm;
      });
    }

    res.json(parkings);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch parkings",
    });
  }
};

// =========================
// DISTANCE UTILITY
// =========================
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// POST /parking/:id/price-quote
// Calculate dynamic price for a given booking scenario
export const calculateParkingPrice = async (req, res) => {
  try {
    const { bookingDate, startTime, endTime } = req.body;
    const parkingId = req.params.id;

    if (!bookingDate || !startTime || !endTime) {
      return res.status(400).json({ message: "bookingDate, startTime, and endTime are required" });
    }

    const parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }

    // Calculate duration from start and end times
    const [startHRaw, startMRaw] = String(startTime).split(":");
    const [endHRaw, endMRaw] = String(endTime).split(":");
    const startH = Number(startHRaw);
    const startM = Number(startMRaw);
    const endH = Number(endHRaw);
    const endM = Number(endMRaw);

    if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: "Invalid start/end time format" });
    }

    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const durationHours = Math.ceil(durationMinutes / 60);
    if (durationHours <= 0) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    // Query bookings that overlap with requested time on the same date
    const ymdParts = bookingDate.split("-");
    const bookingDateOnly = new Date(Date.UTC(Number(ymdParts[0]), Number(ymdParts[1]) - 1, Number(ymdParts[2]), 0, 0, 0));

    const overlappingBookings = await Booking.find({
      parkingId: parking._id,
      bookingDate: bookingDateOnly,
    });

    const overlappingCount = countOverlappingBookings(overlappingBookings, {
      bookingDate: bookingDateOnly,
      startTime,
      endTime,
    });

    const availableSlotsForPricing = Math.max(0, parking.totalSlots - overlappingCount);

    const pricing = calculateDynamicPrice({
      baseRate: parking.price,
      durationHours,
      totalSlots: parking.totalSlots,
      availableSlots: availableSlotsForPricing,
      bookingDateYmd: bookingDate,
    });

    res.json({
      parkingId: parking._id,
      baseRate: parking.price,
      effectiveHourlyRate: pricing.effectiveHourlyRate,
      occupancyPercent: pricing.occupancyPercent,
      dayType: pricing.dayType,
      multipliers: pricing.multipliers,
      durationHours: pricing.durationHours,
      totalPrice: pricing.totalPrice,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to calculate parking price" });
  }
};
