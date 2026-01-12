import cron from "node-cron";
import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";

export const startPaymentHoldCleanupJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const expired = await Booking.find({
        status: "PENDING_PAYMENT",
        holdExpiresAt: { $lte: now },
      }).select("_id parkingId");

      for (const b of expired) {
        const updated = await Booking.findOneAndUpdate(
          { _id: b._id, status: "PENDING_PAYMENT" },
          {
            $set: {
              status: "EXPIRED",
              "payment.status": "FAILED",
              "payment.failedAt": new Date(),
              "payment.failureReason": "PAYMENT_WINDOW_EXPIRED",
            },
          },
          { new: false }
        );

        if (updated) {
          await Parking.findByIdAndUpdate(b.parkingId, {
            $inc: { availableSlots: 1 },
          });
        }
      }
    } catch (err) {
      console.error("Payment hold cleanup job error:", err);
    }
  });
};
