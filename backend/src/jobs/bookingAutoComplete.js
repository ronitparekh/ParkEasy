import cron from "node-cron";
import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";

export const startBookingAutoCompleteJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const activeBookings = await Booking.find({
        status: "ACTIVE",
      });

      for (const booking of activeBookings) {
        const baseDate = booking.bookingDate
          ? new Date(booking.bookingDate)
          : new Date(booking.createdAt);

        const [endHRaw, endMRaw] = String(booking.endTime || "").split(":");
        const endH = Number(endHRaw);
        const endM = Number(endMRaw);
        if (Number.isNaN(endH) || Number.isNaN(endM)) {
          continue;
        }

        const bookingEnd = new Date(baseDate);
        bookingEnd.setHours(endH, endM, 0, 0);

        if (bookingEnd <= now) {
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
