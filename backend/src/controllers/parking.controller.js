import Parking from "../models/Parking.js";

// GET /parking/:id
export const getParkingById = async (req, res) => {
  try {
    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: "Parking not found" });
    }
    res.json(parking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch parking" });
  }
};

// GET /parking/nearby
export const getNearbyParkings = async (req, res) => {
  try {
    const {
      lat,
      lng,
      distance,
      search,
    } = req.query;

    const query = {};

    // =========================
    // NAME SEARCH (GLOBAL)
    // =========================
    if (search) {
      query.name = {
        $regex: search,
        $options: "i", // case-insensitive
      };
    }

    // =========================
    // DISTANCE FILTER (OPTIONAL)
    // =========================
    let parkings = await Parking.find(query);

    if (lat && lng && distance) {
      const userLat = Number(lat);
      const userLng = Number(lng);
      const maxDistanceKm = Number(distance);

      parkings = parkings.filter((p) => {
        const d = getDistanceKm(
          userLat,
          userLng,
          p.lat,
          p.lng
        );
        return d <= maxDistanceKm;
      });
    }

    res.json(parkings);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch parkings",
    });
  }
};

// =========================
// DISTANCE UTILITY
// =========================
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
