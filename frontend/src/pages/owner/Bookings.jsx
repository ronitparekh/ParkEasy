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
                        {bookings.map((b) => (
                            <div
                                key={b._id ?? b.id}
                                className="bg-[#0f172a] border border-white/10 p-5 rounded-2xl"
                            >
                                <h3 className="font-semibold">
                                    {b.parkingId?.name || "Parking"}
                                </h3>

                                <p className="text-sm text-gray-400 mt-1">
                                    Customer: {b.userId?.email || "—"}
                                </p>

                                <p className="text-sm text-gray-500 mt-1">
                                    Vehicle: {b.vehicleNumber || "—"}
                                </p>

                                <p className="text-sm text-gray-500 mt-1">
                                    Gate: {b.gateStatus || "PENDING_ENTRY"}
                                </p>

                                {b.checkedInAt ? (
                                    <p className="text-xs text-gray-600 mt-1">
                                        In: {new Date(b.checkedInAt).toLocaleTimeString()}
                                    </p>
                                ) : null}

                                {b.checkedOutAt ? (
                                    <p className="text-xs text-gray-600 mt-1">
                                        Out: {new Date(b.checkedOutAt).toLocaleTimeString()}
                                    </p>
                                ) : null}

                                <p className="text-sm text-gray-500 mt-1">
                                    {formatWhen(b) || ""}
                                </p>

                                <div className="mt-3 flex items-center justify-between">
                                    <p className="font-bold">₹{b.totalPrice ?? b.total ?? 0}</p>
                                    <span className={
                                        b.status === "ACTIVE"
                                            ? "text-green-400"
                                            : b.status === "CANCELLED"
                                                ? "text-red-400"
                                                : "text-gray-300"
                                    }>
                                        {b.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
