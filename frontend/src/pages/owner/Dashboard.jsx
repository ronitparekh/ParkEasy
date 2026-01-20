import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";
import ParkingMap from "../../components/ParkingMap";
import OwnerNavbar from "../../components/OwnerNavbar";

function Stat({ title, value }) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-xl p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function OwnerDashboard() {
  const [stats, setStats] = useState(null);
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();

    const id = setInterval(() => {
      loadStats();
    }, 5000);

    return () => clearInterval(id);
  }, []);

  async function loadStats() {
    try {
      const res = await api.get("/owner/dashboard");
      setStats(res.data);
    } catch {
      // keep last known stats
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [statsRes, parkingsRes] = await Promise.all([
        api.get("/owner/dashboard"),
        api.get("/owner/parkings"),
      ]);

      setStats(statsRes.data);
      setParkings(parkingsRes.data || []);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Failed to load dashboard. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <OwnerNavbar />
      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
          <div className="max-w-6xl mx-auto">
            <p className="text-gray-400">Loading dashboard…</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <OwnerNavbar />
        <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">Owner Dashboard</h1>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={loadDashboard}
              className="border border-white/20 rounded-lg px-4 py-2"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!stats) return null;

  return (
    <>
      <OwnerNavbar />
      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto">

          <h1 className="text-4xl font-bold mb-2">Owner Dashboard</h1>
          <p className="text-gray-400 mb-8">
            Manage your parking spaces and bookings
          </p>

          {/* STATS */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Stat title="Total Parkings" value={stats.totalParkings} />
            <Stat title="Active Bookings" value={stats.activeBookings} />
            <Stat title="Net Earnings" value={`₹${stats.totalEarnings ?? 0}`} />
          </div>

          <div className="mb-10 flex">
            <Link
              to="/owner/analytics"
              className="border border-white/20 rounded-xl px-4 py-2 hover:bg-white/5"
            >
              Advanced analytics
            </Link>
          </div>

          {/* MAP ONLY */}
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <ParkingMap parkings={parkings} />
          </div>

        </div>
      </div>
    </>
  );
}
