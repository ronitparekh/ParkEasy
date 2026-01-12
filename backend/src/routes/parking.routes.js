import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getNearbyParkings, getParkingById } from "../controllers/parking.controller.js";

const router = express.Router();

// Nearby parking (user must be logged in)
router.get("/nearby", protect, getNearbyParkings);

// Parking details by id (user must be logged in)
router.get("/:id", protect, getParkingById);

export default router;
