import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";
import OwnerNavbar from "../../components/OwnerNavbar";

function Stat({ title, value, subtitle }) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-xl p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle ? <p className="text-xs text-gray-500 mt-2">{subtitle}</p> : null}
    </div>
  );
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return `₹${Number.isFinite(v) ? Math.round(v) : 0}`;
}

export default function AdvancedAnalytics() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [statsRes, bookingsRes] = await Promise.all([
          api.get("/owner/dashboard"),
          api.get("/booking/owner"),
        ]);

        if (!alive) return;
        setStats(statsRes.data);
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.message || "Failed to load analytics");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const computed = useMemo(() => {
    const all = bookings || [];

    const countsByStatus = all.reduce((acc, b) => {
      const s = String(b?.status || "UNKNOWN");
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const overstayCollected = all.reduce((sum, b) => sum + Number(b?.overstayFine || 0), 0);
    const refundsTotal = all.reduce((sum, b) => sum + Number(b?.refundAmount || 0), 0);

    const grossTotal = all.reduce((sum, b) => {
      // booking total + fine, regardless of cancel; refunds are tracked separately
      return sum + Number(b?.totalPrice || 0) + Number(b?.overstayFine || 0);
    }, 0);

    const netTotal = grossTotal - refundsTotal;

    const topParkings = Object.values(
      all.reduce((acc, b) => {
        const pid = b?.parkingId?._id || b?.parkingId;
        const key = String(pid || "unknown");
        if (!acc[key]) {
          acc[key] = {
            parkingId: key,
            name: b?.parkingId?.name || "Parking",
            net: 0,
            gross: 0,
            refunds: 0,
            bookings: 0,
            overstays: 0,
          };
        }

        const total = Number(b?.totalPrice || 0);
        const fine = Number(b?.overstayFine || 0);
        const refund = Number(b?.refundAmount || 0);

        acc[key].gross += total + fine;
        acc[key].refunds += refund;
        acc[key].net += total + fine - refund;
        acc[key].bookings += 1;
        if (fine > 0) acc[key].overstays += 1;

        return acc;
      }, {})
    )
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);

    return {
      countsByStatus,
      overstayCollected,
      refundsTotal,
      grossTotal,
      netTotal,
      topParkings,
    };
  }, [bookings]);

  if (loading) {
    return (
      <>
        <OwnerNavbar />
        <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
          <div className="max-w-6xl mx-auto">
            <p className="text-gray-400">Loading analytics…</p>
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
            <div className="flex items-center justify-between gap-3 mb-6">
              <h1 className="text-3xl font-bold">Advanced Analytics</h1>
              <Link to="/owner/dashboard" className="border border-white/20 rounded-lg px-4 py-2">
                Back
              </Link>
            </div>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <OwnerNavbar />
      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
            <div>
              <h1 className="text-4xl font-bold">Advanced Analytics</h1>
              <p className="text-gray-400 mt-2">
                Deeper breakdowns from bookings, refunds, and overstays.
              </p>
            </div>
            <Link
              to="/owner/dashboard"
              className="self-start sm:self-auto border border-white/20 rounded-xl px-4 py-2 hover:bg-white/5"
            >
              Back to Dashboard
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Stat title="Total Bookings" value={stats?.totalBookings ?? bookings.length} />
            <Stat title="Gross" value={fmtMoney(stats?.grossEarnings ?? computed.grossTotal)} subtitle="Total booked + overstay fines" />
            <Stat title="Refunds" value={fmtMoney(stats?.totalRefunds ?? computed.refundsTotal)} subtitle="Cancelled refunds" />
            <Stat title="Net" value={fmtMoney(stats?.totalEarnings ?? computed.netTotal)} subtitle="Gross - refunds" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <Stat title="Overstay Collected" value={fmtMoney(computed.overstayCollected)} subtitle="Collected at checkout" />
            <Stat title="Today Net" value={fmtMoney(stats?.todayEarnings ?? 0)} subtitle="Payments + fines - refunds" />
            <Stat title="Active Now" value={stats?.activeBookings ?? 0} subtitle="Upcoming/Active/Checked-in/Overstayed" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Status Breakdown</h2>
              <p className="text-sm text-gray-400 mt-1">Counts by booking status.</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(computed.countsByStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs text-gray-400">{k}</p>
                      <p className="text-2xl font-bold mt-1">{v}</p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Top Parkings</h2>
              <p className="text-sm text-gray-400 mt-1">Top 5 by net revenue.</p>

              {computed.topParkings.length === 0 ? (
                <p className="text-gray-400 mt-4">No data yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {computed.topParkings.map((p) => (
                    <div key={p.parkingId} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold truncate" title={p.name}>{p.name}</p>
                        <p className="font-bold">{fmtMoney(p.net)}</p>
                      </div>
                      <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Gross: {fmtMoney(p.gross)}</span>
                        <span>Refunds: {fmtMoney(p.refunds)}</span>
                        <span>Bookings: {p.bookings}</span>
                        <span>Overstays: {p.overstays}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
