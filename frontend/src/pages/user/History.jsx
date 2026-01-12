import { useEffect, useState } from "react";
import api from "../../api/api";
import { downloadReceipt } from "../../utils/receipt";
import UserNavbar from "../../components/UserNavbar";

export default function History() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchBookings();
    }, []);

    async function fetchBookings() {
        try {
            const res = await api.get("/booking/my");
            setBookings(Array.isArray(res.data) ? res.data : []);
            setError("");
        } catch (err) {
            console.error("Failed to fetch bookings", err);
            setError(
                err?.response?.data?.message ||
                "Failed to fetch bookings."
            );
        } finally {
            setLoading(false);
        }
    }

    async function cancelBooking(id) {
        if (!confirm("Cancel this booking?")) return;

        try {
            await api.put(`/booking/${id}/cancel`);
            fetchBookings();
        } catch {
            alert("Failed to cancel booking");
        }
    }

    function openDirections(lat, lng) {
        if (lat === undefined || lng === undefined) return;
        window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
            "_blank"
        );
    }

    if (loading) {
        return (
            <p className="text-gray-400 p-6">
                Loading bookings...
            </p>
        );
    }

    return (
        <>
            <UserNavbar />

            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-8">
                        My Bookings
                    </h2>

                    {error ? (
                        <p className="text-red-400">{error}</p>
                    ) : bookings.length === 0 ? (
                        <p className="text-gray-400">
                            No bookings yet.
                        </p>
                    ) : (
                        bookings.map((b) => (
                            (() => {
                                const parkingName =
                                    b?.parkingId?.name ||
                                    b?.parking?.name ||
                                    (typeof b?.parkingId === "string" ? "Parking" : "Parking");
                                const parkingLat = b?.parkingId?.lat;
                                const parkingLng = b?.parkingId?.lng;
                                const canDirections =
                                    typeof parkingLat === "number" &&
                                    typeof parkingLng === "number" &&
                                    !Number.isNaN(parkingLat) &&
                                    !Number.isNaN(parkingLng);

                                return (
                            <div
                                key={b._id}
                                className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 mb-6"
                            >
                                {/* HEADER */}
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                    <div>
                                        <h3 className="text-xl font-semibold">
                                            {parkingName}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            Vehicle: {b.vehicleNumber}
                                        </p>
                                    </div>

                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-medium
                    ${b.status === "ACTIVE"
                                                ? "bg-green-500/20 text-green-400"
                                                : b.status === "COMPLETED"
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "bg-red-500/20 text-red-400"
                                            }
                  `}
                                    >
                                        {b.status}
                                    </span>
                                </div>

                                {/* DETAILS */}
                                <div className="mt-4 text-sm text-gray-300 space-y-1">
                                    <p>
                                        Date:{" "}
                                        {new Date(
                                            b.bookingDate || b.createdAt
                                        ).toLocaleDateString()}
                                    </p>
                                    <p>
                                        Time: {b.startTime} – {b.endTime}
                                    </p>
                                    <p>Duration: {b.duration} hrs</p>
                                    <p className="text-white font-semibold">
                                        Total Paid: ₹{b.totalPrice}
                                    </p>
                                </div>

                                {/* ACTIONS */}
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        onClick={() =>
                                            openDirections(
                                                parkingLat,
                                                parkingLng
                                            )
                                        }
                                        disabled={!canDirections}
                                        className="px-4 py-2 border border-white/20 rounded-xl hover:bg-white/10"
                                    >
                                        Directions
                                    </button>

                                    <button
                                        onClick={() => downloadReceipt(b)}
                                        className="px-4 py-2 border border-white/20 rounded-xl hover:bg-white/10"
                                    >
                                        Receipt
                                    </button>

                                    {b.status === "ACTIVE" && (
                                        <button
                                            onClick={() => cancelBooking(b._id)}
                                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                                );
                            })()
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
