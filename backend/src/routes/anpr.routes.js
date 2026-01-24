import express from "express";
import multer from "multer";
import { scanPlate } from "../controllers/anpr.controller.js";

const router = express.Router();

/**
 * Multer configuration for image uploads
 * - In-memory storage (no disk writes)
 * - Max 10MB
 * - Only JPEG, PNG, WebP
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported. Use JPEG, PNG, or WebP.`));
    }
  },
});

/**
 * POST /anpr/scan
 * Body: multipart/form-data with "image" field
 * Returns: { plate, confidence, method }
 */
router.post("/scan", upload.single("image"), scanPlate);

export default router;
