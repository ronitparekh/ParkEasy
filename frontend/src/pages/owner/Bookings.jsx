import { useEffect, useState } from "react";
import OwnerNavbar from "../../components/OwnerNavbar";
import api from "../../api/api";
import { useSearchParams } from "react-router-dom";


export default function OwnerBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [searchParams] = useSearchParams();
    const parkingId = searchParams.get("parkingId");

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const res = await api.get("/booking/owner", {
                    params: parkingId ? { parkingId } : {},
                });
                if (!alive) return;
                setBookings(res.data ?? []);
            } catch (e) {
                if (!alive) return;
                setError(
                    e?.response?.data?.message ||
                    "Failed to load bookings."
                );
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, [parkingId]);

    function formatWhen(b) {
        const d = b.bookingDate ? new Date(b.bookingDate) : null;
        const dateStr = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "";
        const timeStr = b.startTime && b.endTime ? `${b.startTime} → ${b.endTime}` : "";
        return [dateStr, timeStr].filter(Boolean).join(" • ");
    }

    function statusClass(status) {
        switch (status) {
            case "UPCOMING":
                return "text-blue-400";
            case "ACTIVE":
                return "text-green-400";
            case "CHECKED_IN":
                return "text-cyan-300";
            case "OVERSTAYED":
                return "text-amber-300";
            case "COMPLETED":
                return "text-gray-200";
            case "CANCELLED":
                return "text-red-400";
            case "EXPIRED":
            case "PAYMENT_FAILED":
            case "PENDING_PAYMENT":
                return "text-gray-400";
            default:
                return "text-gray-300";
        }
    }

    return (
        <>
            <OwnerNavbar />
            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                    <h1 className="text-4xl font-bold mb-8">Bookings</h1>

                    {error ? (
                        <p className="text-gray-400">{error}</p>
                    ) : loading ? (
                        <p className="text-gray-400">Loading…</p>
                    ) : bookings.length === 0 ? (
                        <p className="text-gray-400">No bookings yet.</p>
                    ) : null}

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookings
                            .filter((b) => {
                                if (!b) return false;
                                if (["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(b.status)) return false;
                                const paymentStatus = b?.payment?.status;
                                if (paymentStatus && paymentStatus !== "PAID") return false;
                                if (b.status === "EXPIRED" && b?.payment?.failureReason === "PAYMENT_WINDOW_EXPIRED") return false;
                                return true;
                            })
                            .map((b) => {
                                const whenText = formatWhen(b) || "—";
                                const hasOverstay = Number(b.overstayFineDue || 0) > 0 || Number(b.overstayFine || 0) > 0;
                                const hasRefund = b.status === "CANCELLED" && Number(b.refundAmount || 0) > 0;
                                const inText = b.checkedInAt ? new Date(b.checkedInAt).toLocaleTimeString() : "";
                                const outText = b.checkedOutAt ? new Date(b.checkedOutAt).toLocaleTimeString() : "";

                                return (
                                    <div
                                        key={b._id ?? b.id}
                                        className="bg-[#0f172a] border border-white/10 p-5 rounded-2xl flex flex-col h-full min-w-0"
                                    >
                                        <div className="min-w-0">
                                            <h3
                                                className="font-semibold text-lg leading-snug min-w-0 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] min-h-13"
                                                title={b.parkingId?.name || "Parking"}
                                            >
                                                {b.parkingId?.name || "Parking"}
                                            </h3>

                                            <div className="mt-3 space-y-1">
                                                <p className="text-sm text-gray-400 wrap-break-word">
                                                    Customer: {b.userId?.email || "—"}
                                                </p>

                                                <p className="text-sm text-gray-500">
                                                    Vehicle: {b.vehicleNumber || "—"}
                                                </p>

                                                <p className="text-sm text-gray-500">
                                                    Gate: {b.gateStatus || "PENDING_ENTRY"}
                                                </p>

                                                <p className="text-sm text-gray-500">{whenText}</p>
                                            </div>

                                            {(hasOverstay || hasRefund || inText || outText) ? (
                                                <div className="mt-3 space-y-1">
                                                    {hasOverstay ? (
                                                        <p className="text-sm text-amber-300">
                                                            Overstay fine: ₹{Number(b.overstayFineDue || b.overstayFine || 0)}
                                                        </p>
                                                    ) : null}

                                                    {inText ? (
                                                        <p className="text-xs text-gray-600">In: {inText}</p>
                                                    ) : null}

                                                    {outText ? (
                                                        <p className="text-xs text-gray-600">Out: {outText}</p>
                                                    ) : null}

                                                    {hasRefund ? (
                                                        <p className="text-sm text-amber-300">
                                                            Refunded: ₹{Number(b.refundAmount || 0)}
                                                            {typeof b.refundPercent === "number" ? ` (${Math.round(b.refundPercent * 100)}%)` : ""}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="mt-auto pt-4 flex items-end justify-between gap-4">
                                            <p className="font-bold text-lg">₹{b.totalPrice ?? b.total ?? 0}</p>
                                            <span className={"text-sm font-semibold " + statusClass(b.status)}>
                                                {b.status}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>
        </>
    );
}
