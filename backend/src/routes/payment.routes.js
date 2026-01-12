import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayKey,
} from "../controllers/payment.controller.js";

const router = express.Router();

router.get("/razorpay/key", protect, getRazorpayKey);
router.post("/razorpay/create-order", protect, createRazorpayOrder);
router.post("/razorpay/verify", protect, verifyRazorpayPayment);

export default router;
