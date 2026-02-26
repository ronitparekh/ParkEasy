import express from "express";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getOwnerBookings,
  ownerCheckInByPlate,
  ownerCheckOutByPlate,
  ownerCheckInByBookingId,
  ownerCheckOutByBookingId,
  arrivedAtGate,
  revokeArrivedAtGate,
} from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Create booking
router.post("/", protect, createBooking);

// Get user bookings
router.get("/my", protect, getMyBookings);

// Get owner bookings
router.get("/owner", protect, getOwnerBookings);

// OWNER GATE: plate OCR
router.post("/owner/gate/check-in/plate", protect, ownerCheckInByPlate);
router.post("/owner/gate/check-out/plate", protect, ownerCheckOutByPlate);

// OWNER GATE: QR/bookingId fallback
router.post("/owner/gate/check-in/booking", protect, ownerCheckInByBookingId);
router.post("/owner/gate/check-out/booking", protect, ownerCheckOutByBookingId);

// USER: queue protection (Arrived at gate)
router.post("/:id/arrive-at-gate", protect, arrivedAtGate);
router.post("/:id/arrive-at-gate/revoke", protect, revokeArrivedAtGate);

// Cancel booking
router.put("/:id/cancel", protect, cancelBooking);

export default router;
