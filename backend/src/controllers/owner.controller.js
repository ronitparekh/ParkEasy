import mongoose from "mongoose";
import Parking from "../models/Parking.js";
import Booking from "../models/Booking.js";

export const getOwnerParkings = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const parkings = await Parking.find({ ownerId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(parkings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch owner parkings" });
  }
};

export const addOwnerParking = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { name, lat, lng, price, totalSlots } = req.body;

    if (!name || lat === undefined || lng === undefined || price === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const priceNum = Number(price);
    const totalSlotsNum = totalSlots === undefined ? undefined : Number(totalSlots);

    if (
      !name.trim() ||
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      Number.isNaN(priceNum) ||
      (totalSlotsNum !== undefined && (Number.isNaN(totalSlotsNum) || totalSlotsNum < 0))
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const parking = await Parking.create({
      name: name.trim(),
      lat: latNum,
      lng: lngNum,
      price: priceNum,
      ...(totalSlotsNum !== undefined
        ? { totalSlots: totalSlotsNum, availableSlots: totalSlotsNum }
        : {}),
      ownerId: req.user.id,
    });

    res.status(201).json(parking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add parking" });
  }
};

export const updateOwnerParking = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }

    if (parking.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const { name, lat, lng, price, totalSlots } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: "Invalid name" });
      }
      parking.name = String(name).trim();
    }

    if (lat !== undefined) {
      const latNum = Number(lat);
      if (Number.isNaN(latNum)) {
        return res.status(400).json({ message: "Invalid lat" });
      }
      parking.lat = latNum;
    }

    if (lng !== undefined) {
      const lngNum = Number(lng);
      if (Number.isNaN(lngNum)) {
        return res.status(400).json({ message: "Invalid lng" });
      }
      parking.lng = lngNum;
    }

    if (price !== undefined) {
      const priceNum = Number(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: "Invalid price" });
      }
      parking.price = priceNum;
    }

    if (totalSlots !== undefined) {
      const totalSlotsNum = Number(totalSlots);
      if (Number.isNaN(totalSlotsNum) || totalSlotsNum < 0) {
        return res.status(400).json({ message: "Invalid totalSlots" });
      }

      const bookedSlots = parking.totalSlots - parking.availableSlots;
      if (totalSlotsNum < bookedSlots) {
        return res.status(400).json({
          message: `totalSlots cannot be less than booked slots (${bookedSlots})`,
        });
      }

      parking.totalSlots = totalSlotsNum;
      parking.availableSlots = totalSlotsNum - bookedSlots;
    }

    await parking.save();
    res.json(parking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update parking" });
  }
};

export const deleteOwnerParking = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }

    if (parking.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const hasBookings = await Booking.exists({ parkingId: parking._id });
    if (hasBookings) {
      return res
        .status(400)
        .json({ message: "Cannot delete parking with bookings" });
    }

    await Parking.deleteOne({ _id: parking._id });
    res.json({ message: "Parking deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete parking" });
  }
};

export const getOwnerDashboard = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    const parkings = await Parking.find({ ownerId });
      const parkingIds = parkings.map(p => p._id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const stats = await Booking.aggregate([
      {
        $match: {
          parkingId: { $in: parkingIds },
          $or: [
            { "payment.status": "PAID" },
            { payment: { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          activeBookings: {
            $sum: {
              $cond: [{ $in: ["$status", ["UPCOMING", "ACTIVE", "CHECKED_IN", "OVERSTAYED"]] }, 1, 0]
            }
          },
          grossEarnings: {
            $sum: {
              $add: [{ $ifNull: ["$totalPrice", 0] }, { $ifNull: ["$overstayFine", 0] }]
            }
          },
          totalRefunds: {
            $sum: {
              $cond: [
                { $eq: ["$status", "CANCELLED"] },
                { $ifNull: ["$refundAmount", 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const today = await Booking.aggregate([
      {
        $match: {
          parkingId: { $in: parkingIds },
          $or: [
            { "payment.status": "PAID" },
            { payment: { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          paidToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gte: [
                        { $ifNull: ["$payment.paidAt", "$createdAt"] },
                        startOfDay
                      ]
                    }
                  ]
                },
                { $ifNull: ["$totalPrice", 0] },
                0
              ]
            }
          },
          overstayToday: {
            $sum: {
              $cond: [
                { $gte: ["$checkedOutAt", startOfDay] },
                { $ifNull: ["$overstayFine", 0] },
                0
              ]
            }
          },
          refundsToday: {
            $sum: {
              $cond: [
                { $gte: ["$cancelledAt", startOfDay] },
                { $ifNull: ["$refundAmount", 0] },
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          todayEarnings: { $subtract: [{ $add: ["$paidToday", "$overstayToday"] }, "$refundsToday"] },
          paidToday: 1,
          overstayToday: 1,
          refundsToday: 1,
        }
      }
    ]);

    res.json({
      totalParkings: parkings.length,
      totalBookings: stats[0]?.totalBookings || 0,
      activeBookings: stats[0]?.activeBookings || 0,
      grossEarnings: stats[0]?.grossEarnings || 0,
      totalRefunds: stats[0]?.totalRefunds || 0,
      totalEarnings: (stats[0]?.grossEarnings || 0) - (stats[0]?.totalRefunds || 0),
      todayEarnings: today[0]?.todayEarnings || 0,
      refundsToday: today[0]?.refundsToday || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard error" });
  }
};
