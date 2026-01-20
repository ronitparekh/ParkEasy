import cron from "node-cron";
import Booking from "../models/Booking.js";
import Parking from "../models/Parking.js";
import { getBookingStartEndIst } from "../utils/ist.js";

function bumpSlots(parking) {
  if (!parking) return;
  parking.availableSlots = Number(parking.availableSlots || 0) + 1;
  if (parking.totalSlots !== undefined && parking.totalSlots !== null) {
    parking.availableSlots = Math.min(parking.availableSlots, Number(parking.totalSlots));
  }
}

export const startBookingAutoCompleteJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Drive booking status transitions.
      // NOTE: We never auto-complete. Completion happens only on exit scan.
      const bookings = await Booking.find({
        status: { $in: ["UPCOMING", "ACTIVE", "CHECKED_IN", "OVERSTAYED"] },
      });

      for (const booking of bookings) {
        const { start, end } = getBookingStartEndIst(booking);
        if (!start || !end) continue;

        const gate = booking.gateStatus ?? "PENDING_ENTRY";
        const checkedIn = gate === "CHECKED_IN";
        const checkedOut = gate === "CHECKED_OUT";

        // Keep status consistent with gate state.
        if (checkedOut && booking.status !== "COMPLETED") {
          booking.status = "COMPLETED";
          await booking.save();
          continue;
        }

        // If a booking is checked in, mark CHECKED_IN (or keep OVERSTAYED).
        if (checkedIn && booking.status !== "OVERSTAYED" && booking.status !== "CHECKED_IN") {
          booking.status = "CHECKED_IN";
          await booking.save();
          continue;
        }

        // UPCOMING -> ACTIVE when time starts.
        if (booking.status === "UPCOMING" && now >= start) {
          booking.status = "ACTIVE";
          await booking.save();
          continue;
        }

        // ACTIVE -> EXPIRED if not checked in within 20 minutes of start, OR if booking ended without check-in.
        if (booking.status === "ACTIVE" && gate === "PENDING_ENTRY") {
          const noCheckinGraceMs = 20 * 60 * 1000;
          const expireAt = new Date(Math.min(end.getTime(), start.getTime() + noCheckinGraceMs));
          if (now >= expireAt) {
            booking.status = "EXPIRED";
            await booking.save();

            const parking = await Parking.findById(booking.parkingId);
            if (parking) {
              bumpSlots(parking);
              await parking.save();
            }

            continue;
          }
        }

        // CHECKED_IN -> OVERSTAYED after end + 5 minutes if not checked out.
        if (booking.status === "CHECKED_IN" && checkedIn) {
          const exitGraceMs = 5 * 60 * 1000;
          if (now.getTime() > end.getTime() + exitGraceMs) {
            booking.status = "OVERSTAYED";
            await booking.save();
            continue;
          }
        }
      }
    } catch (err) {
      console.error("Auto-complete job error:", err);
    }
  });
};
