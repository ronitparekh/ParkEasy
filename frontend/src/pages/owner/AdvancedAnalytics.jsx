import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";
import OwnerNavbar from "../../components/OwnerNavbar";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

function Panel({ title, subtitle, right, children, className = "" }) {
  return (
    <div
      className={
        "bg-[#0f172a] border border-white/10 rounded-2xl p-5 w-full min-w-0 flex flex-col " +
        className
      }
    >
      {(title || right) ? (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {subtitle ? (
              <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className={(title || right ? "mt-4 " : "") + "flex-1 min-w-0"}>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {hint ? <p className="text-xs text-gray-500 mt-2">{hint}</p> : null}
    </div>
  );
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return `₹${Number.isFinite(v) ? Math.round(v) : 0}`;
}

function toYmd(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDaysLabels(n) {
  const out = [];
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = n - 1; i >= 0; i -= 1) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - i);
    out.push(toYmd(cur));
  }
  return out;
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

    const trendDays = 14;
    const labels = lastNDaysLabels(trendDays);
    const bucket = labels.reduce((acc, k) => {
      acc[k] = { gross: 0, refunds: 0, net: 0, bookings: 0 };
      return acc;
    }, {});

    for (const b of all) {
      const dayKey = toYmd(b?.bookingDate || b?.createdAt);
      if (!dayKey || !bucket[dayKey]) continue;

      const gross = Number(b?.totalPrice || 0) + Number(b?.overstayFine || 0);
      const refunds = Number(b?.refundAmount || 0);
      const net = gross - refunds;

      bucket[dayKey].gross += gross;
      bucket[dayKey].refunds += refunds;
      bucket[dayKey].net += net;
      bucket[dayKey].bookings += 1;
    }

    const trend = {
      labels,
      gross: labels.map((k) => Math.round(bucket[k].gross)),
      refunds: labels.map((k) => Math.round(bucket[k].refunds)),
      net: labels.map((k) => Math.round(bucket[k].net)),
      bookings: labels.map((k) => bucket[k].bookings),
    };

    const statusPairs = Object.entries(countsByStatus)
      .map(([k, v]) => [String(k), Number(v || 0)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    const statusTop = statusPairs.slice(0, 6);
    const statusRest = statusPairs.slice(6);
    const otherCount = statusRest.reduce((sum, [, v]) => sum + v, 0);
    const statusChart = {
      labels: [...statusTop.map(([k]) => k), ...(otherCount ? ["OTHER"] : [])],
      values: [...statusTop.map(([, v]) => v), ...(otherCount ? [otherCount] : [])],
    };

    return {
      countsByStatus,
      overstayCollected,
      refundsTotal,
      grossTotal,
      netTotal,
      topParkings,
      trend,
      statusChart,
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
        <div className="max-w-6xl w-full min-w-0 mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div className="min-w-0">
              <h1 className="text-4xl sm:text-5xl font-bold">Advanced Analytics</h1>
              <p className="text-gray-400 mt-2">
                Revenue, refunds, and booking activity insights.
              </p>
            </div>
            <Link
              to="/owner/dashboard"
              className="self-start md:self-auto border border-white/20 rounded-xl px-4 py-2 hover:bg-white/5"
            >
              Back to Dashboard
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <KpiCard
              label="Total bookings"
              value={stats?.totalBookings ?? bookings.length}
              hint="All-time (from your bookings feed)"
            />
            <KpiCard
              label="Net revenue"
              value={fmtMoney(stats?.totalEarnings ?? computed.netTotal)}
              hint="Gross − refunds"
            />
            <KpiCard
              label="Gross"
              value={fmtMoney(stats?.grossEarnings ?? computed.grossTotal)}
              hint="Bookings + overstay fines"
            />
            <KpiCard
              label="Refunds"
              value={fmtMoney(stats?.totalRefunds ?? computed.refundsTotal)}
              hint="Cancelled refunds"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <KpiCard
              label="Overstay collected"
              value={fmtMoney(computed.overstayCollected)}
              hint="Collected at checkout"
            />
            <KpiCard
              label="Today net"
              value={fmtMoney(stats?.todayEarnings ?? 0)}
              hint="Payments + fines − refunds"
            />
            <KpiCard
              label="Active now"
              value={stats?.activeBookings ?? 0}
              hint="Upcoming/Active/Checked-in/Overstayed"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-10 items-start">
            <Panel
              className="lg:col-span-2"
              title="Net trend"
              subtitle="Last 14 days (net revenue + booking volume)"
            >
              <div className="h-72 sm:h-80">
                <Line
                  data={{
                    labels: computed.trend.labels,
                    datasets: [
                      {
                        label: "Net (₹)",
                        data: computed.trend.net,
                        borderColor: "rgba(34,197,94,0.95)",
                        backgroundColor: "rgba(34,197,94,0.12)",
                        pointRadius: 2,
                        tension: 0.35,
                        fill: true,
                        yAxisID: "y",
                      },
                      {
                        label: "Bookings",
                        data: computed.trend.bookings,
                        borderColor: "rgba(255,255,255,0.75)",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        pointRadius: 2,
                        tension: 0.35,
                        fill: false,
                        yAxisID: "y1",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { labels: { color: "rgba(255,255,255,0.75)" } },
                      tooltip: { mode: "index", intersect: false },
                    },
                    interaction: { mode: "index", intersect: false },
                    scales: {
                      x: {
                        ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 0 },
                        grid: { color: "rgba(255,255,255,0.06)" },
                      },
                      y: {
                        ticks: { color: "rgba(255,255,255,0.55)" },
                        grid: { color: "rgba(255,255,255,0.06)" },
                      },
                      y1: {
                        position: "right",
                        ticks: { color: "rgba(255,255,255,0.55)" },
                        grid: { drawOnChartArea: false },
                      },
                    },
                  }}
                />
              </div>
            </Panel>

            <Panel title="Status split" subtitle="Distribution by booking status">
              {computed.statusChart.values.length === 0 ? (
                <p className="text-gray-400">No data yet.</p>
              ) : (
                <div className="h-72 sm:h-80">
                  <Doughnut
                    data={{
                      labels: computed.statusChart.labels,
                      datasets: [
                        {
                          data: computed.statusChart.values,
                          backgroundColor: [
                            "rgba(59,130,246,0.70)",
                            "rgba(34,197,94,0.70)",
                            "rgba(245,158,11,0.70)",
                            "rgba(239,68,68,0.70)",
                            "rgba(168,85,247,0.70)",
                            "rgba(148,163,184,0.55)",
                            "rgba(255,255,255,0.18)",
                          ],
                          borderColor: "rgba(255,255,255,0.10)",
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: {
                            color: "rgba(255,255,255,0.75)",
                            boxWidth: 12,
                          },
                        },
                      },
                    }}
                  />
                </div>
              )}
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Panel
              className="lg:col-span-2"
              title="Top parkings"
              subtitle="Net revenue comparison (top 5)"
            >
              {computed.topParkings.length === 0 ? (
                <p className="text-gray-400">No data yet.</p>
              ) : (
                <div className="flex-1 min-h-72 sm:min-h-80">
                  <Bar
                    data={{
                      labels: computed.topParkings.map((p) => p.name),
                      datasets: [
                        {
                          label: "Net (₹)",
                          data: computed.topParkings.map((p) => Math.round(p.net)),
                          backgroundColor: "rgba(34,197,94,0.55)",
                          borderColor: "rgba(34,197,94,0.95)",
                          borderWidth: 1,
                          borderRadius: 10,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { labels: { color: "rgba(255,255,255,0.75)" } },
                        tooltip: { intersect: false },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "rgba(255,255,255,0.55)",
                            maxRotation: 0,
                            callback: function (value) {
                              const label = this.getLabelForValue(value);
                              return String(label).length > 18
                                ? String(label).slice(0, 18) + "…"
                                : label;
                            },
                          },
                          grid: { display: false },
                        },
                        y: {
                          ticks: { color: "rgba(255,255,255,0.55)" },
                          grid: { color: "rgba(255,255,255,0.06)" },
                        },
                      },
                    }}
                  />
                </div>
              )}
            </Panel>

            <Panel title="Status breakdown" subtitle="Quick counts">
              {Object.keys(computed.countsByStatus).length === 0 ? (
                <p className="text-gray-400">No data yet.</p>
              ) : (
                <div className="flex-1 min-h-72 sm:min-h-80 flex flex-col gap-2">
                  {Object.entries(computed.countsByStatus)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <p className="text-sm text-gray-200 break-all min-w-0">
                          {k}
                        </p>
                        <p className="text-sm font-semibold text-white shrink-0">
                          {v}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
