import express from "express";
import cors from "cors";
import dotenv from "dotenv";



import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import parkingRoutes from "./routes/parking.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import ownerRoutes from "./routes/owner.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import anprRoutes from "./routes/anpr.routes.js";

import { startBookingAutoCompleteJob } from "./jobs/bookingAutoComplete.js";
import { startPaymentHoldCleanupJob } from "./jobs/paymentHoldCleanup.js";

dotenv.config();
connectDB();

startBookingAutoCompleteJob();
startPaymentHoldCleanupJob();


const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/parking", parkingRoutes);
app.use("/booking", bookingRoutes);
app.use("/owner", ownerRoutes);
app.use("/payment", paymentRoutes);
app.use("/anpr", anprRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

