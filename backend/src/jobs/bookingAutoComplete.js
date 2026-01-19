import cron from "node-cron";
import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";
import { getBookingStartEndIst } from "../utils/ist.js";

export const startBookingAutoCompleteJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const activeBookings = await Booking.find({
        status: "ACTIVE",
      });

      for (const booking of activeBookings) {
        const { end } = getBookingStartEndIst(booking);
        if (!end) continue;

        if (end <= now) {
          booking.status = "COMPLETED";
          await booking.save();

          const parking = await Parking.findById(
            booking.parkingId
          );
          if (parking) {
            parking.availableSlots += 1;
            await parking.save();
          }
        }
      }
    } catch (err) {
      console.error("Auto-complete job error:", err);
    }
  });
};
