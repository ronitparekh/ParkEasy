import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    parkingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parking",
      required: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
    },

    gateStatus: {
      type: String,
      enum: ["PENDING_ENTRY", "CHECKED_IN", "CHECKED_OUT"],
      default: "PENDING_ENTRY",
    },

    checkedInAt: {
      type: Date,
    },

    checkedOutAt: {
      type: Date,
    },

    entryMethod: {
      type: String,
      enum: ["PLATE_OCR", "QR", "MANUAL"],
    },

    exitMethod: {
      type: String,
      enum: ["PLATE_OCR", "QR", "MANUAL"],
    },

    lastPlateScan: {
      rawText: { type: String, trim: true },
      normalized: { type: String, trim: true },
      confidence: { type: Number },
      scannedAt: { type: Date },
    },

    customerName: {
      type: String,
      trim: true,
    },

    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    customerPhone: {
      type: String,
      trim: true,
    },

    bookingDate: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String, // "10:00"
      required: true,
    },

    endTime: {
      type: String, // "12:00"
      required: true,
    },

    duration: {
      type: Number, // hours
      required: true,
    },

    totalPrice: {
      type: Number,
      required: true,
    },

    holdExpiresAt: {
      type: Date,
    },

    payment: {
      provider: {
        type: String,
        enum: ["RAZORPAY"],
      },
      orderId: {
        type: String,
        trim: true,
      },
      paymentId: {
        type: String,
        trim: true,
      },
      signature: {
        type: String,
        trim: true,
      },
      amount: {
        type: Number,
      },
      currency: {
        type: String,
        default: "INR",
      },
      status: {
        type: String,
        enum: ["CREATED", "PAID", "FAILED"],
      },
      paidAt: {
        type: Date,
      },
      failedAt: {
        type: Date,
      },
      failureReason: {
        type: String,
        trim: true,
      },
    },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
        "PAYMENT_FAILED",
      ],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.index({ parkingId: 1, bookingDate: 1, status: 1, gateStatus: 1 });

export default mongoose.model("Booking", bookingSchema);
