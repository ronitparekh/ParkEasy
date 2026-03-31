import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getNearbyParkings, getParkingById, calculateParkingPrice } from "../controllers/parking.controller.js";

const router = express.Router();

// Nearby parking (user must be logged in)
router.get("/nearby", protect, getNearbyParkings);

// Calculate dynamic price for a specific booking scenario
router.post("/:id/price-quote", protect, calculateParkingPrice);

// Parking details by id (user must be logged in)
router.get("/:id", protect, getParkingById);

export default router;
