import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  addOwnerParking,
  deleteOwnerParking,
  getOwnerDashboard,
  getOwnerParkings,
  updateOwnerParking,
} from "../controllers/owner.controller.js";

const router = express.Router();

const requireOwner = (req, res, next) => {
  if (req.user.role !== "OWNER") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

/**
 * OWNER DASHBOARD
 */
router.get("/dashboard", protect, (req, res, next) => {

  next();
}, requireOwner, getOwnerDashboard);

// OWNER PARKINGS
router.get("/parkings", protect, requireOwner, getOwnerParkings);
router.post("/add-parking", protect, requireOwner, addOwnerParking);
router.put("/parkings/:id", protect, requireOwner, updateOwnerParking);
router.delete("/parkings/:id", protect, requireOwner, deleteOwnerParking);

export default router;
