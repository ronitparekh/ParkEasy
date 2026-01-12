import mongoose from "mongoose";

const parkingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    totalSlots: {
      type: Number,
      required: true,
      default: 20,
    },

    availableSlots: {
      type: Number,
      required: true,
      default: 20,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Parking", parkingSchema);
