import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { Doughnut, Line } from "react-chartjs-2";

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
            <div className={(title || right ? "mt-4 " : "") + "flex-1 min-w-0"}>
                {children}
            </div>
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

export default function ParkingAnalytics() {
    const { parkingId } = useParams();

    const [parking, setParking] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                setLoading(true);
                setError("");

                const [parkingsRes, bookingsRes] = await Promise.all([
                    api.get("/owner/parkings"),
                    api.get("/booking/owner"),
                ]);

                if (!alive) return;

                const ownerParkings = Array.isArray(parkingsRes.data) ? parkingsRes.data : [];
                const p = ownerParkings.find((x) => String(x?._id) === String(parkingId));
                setParking(p || null);

                const allBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
                const filtered = allBookings.filter((b) => {
                    const pid = b?.parkingId?._id || b?.parkingId;
                    return String(pid || "") === String(parkingId || "");
                });
                setBookings(filtered);
            } catch (e) {
                if (!alive) return;
                setError(e?.response?.data?.message || "Failed to load parking analytics");
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, [parkingId]);

    const computed = useMemo(() => {
        const all = bookings || [];

        const countsByStatus = all.reduce((acc, b) => {
            const s = String(b?.status || "UNKNOWN");
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});

        const overstayCollected = all.reduce(
            (sum, b) => sum + Number(b?.overstayFine || 0),
            0
        );
        const refundsTotal = all.reduce(
            (sum, b) => sum + Number(b?.refundAmount || 0),
            0
        );

        const grossTotal = all.reduce((sum, b) => {
            return sum + Number(b?.totalPrice || 0) + Number(b?.overstayFine || 0);
        }, 0);

        const netTotal = grossTotal - refundsTotal;

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
                        <p className="text-gray-400">Loading parking analytics…</p>
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
                            <h1 className="text-3xl font-bold">Parking Analytics</h1>
                            <Link
                                to="/owner/parkings"
                                className="border border-white/20 rounded-lg px-4 py-2"
                            >
                                Back
                            </Link>
                        </div>
                        <p className="text-red-400">{error}</p>
                    </div>
                </div>
            </>
        );
    }

    const titleName = parking?.name || "Parking";

    return (
        <>
            <OwnerNavbar />
            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
                <div className="max-w-6xl w-full min-w-0 mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                        <div className="min-w-0">
                            <h1 className="text-4xl sm:text-5xl font-bold truncate" title={titleName}>
                                {titleName}
                            </h1>
                            <p className="text-gray-400 mt-2">Parking-wise analytics and booking activity.</p>
                        </div>
                        <Link
                            to="/owner/parkings"
                            className="self-start md:self-auto border border-white/20 rounded-xl px-4 py-2 hover:bg-white/5"
                        >
                            Back to My Parking Spaces
                        </Link>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                        <KpiCard label="Total bookings" value={bookings.length} hint="All-time" />
                        <KpiCard label="Net revenue" value={fmtMoney(computed.netTotal)} hint="Gross − refunds" />
                        <KpiCard label="Gross" value={fmtMoney(computed.grossTotal)} hint="Bookings + overstay fines" />
                        <KpiCard label="Refunds" value={fmtMoney(computed.refundsTotal)} hint="Cancelled refunds" />
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                        <KpiCard
                            label="Overstay collected"
                            value={fmtMoney(computed.overstayCollected)}
                            hint="Collected at checkout"
                        />
                        <KpiCard
                            label="Statuses"
                            value={Object.keys(computed.countsByStatus).length}
                            hint="Distinct status values"
                        />
                        <KpiCard
                            label="Avg net / booking"
                            value={fmtMoney(bookings.length ? computed.netTotal / bookings.length : 0)}
                            hint="Net ÷ bookings"
                        />
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6 items-start">
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
                                                ticks: {
                                                    color: "rgba(255,255,255,0.55)",
                                                    maxRotation: 0,
                                                },
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
                </div>
            </div>
        </>
    );
}
