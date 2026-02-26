import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import { downloadReceipt } from "../../utils/receipt";
import { getDistanceKm } from "../../utils/distance";
import UserNavbar from "../../components/UserNavbar";

const ARRIVED_GATE_MAX_DISTANCE_KM = 0.05; // 50m

export default function History() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const activeWatchesRef = useRef({});

    useEffect(() => {
        fetchBookings();
    }, []);

    useEffect(() => {
        return () => {
            // cleanup geolocation watches
            try {
                const watches = activeWatchesRef.current || {};
                Object.values(watches).forEach((watchId) => {
                    if (typeof watchId === "number") navigator.geolocation.clearWatch(watchId);
                });
            } catch {
                // ignore
            }
            activeWatchesRef.current = {};
        };
    }, []);

    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported"));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            });
        });
    }

    async function markArrivedAtGate(bookingId, parkingLat, parkingLng) {
        try {
            if (typeof parkingLat !== "number" || typeof parkingLng !== "number") {
                alert("Parking location not available");
                return;
            }

            const pos = await getCurrentPosition();
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;

            const dKm = getDistanceKm(userLat, userLng, parkingLat, parkingLng);
            if (!Number.isFinite(dKm) || dKm > ARRIVED_GATE_MAX_DISTANCE_KM) {
                alert("You must be within 50m of the gate to use this option");
                return;
            }

            await api.post(`/booking/${bookingId}/arrive-at-gate`, {
                lat: userLat,
                lng: userLng,
            });

            await fetchBookings();
            startOutOfRangeWatcher(bookingId, parkingLat, parkingLng);
        } catch (err) {
            console.error("Arrived at gate failed", err);
            alert(err?.response?.data?.message || "Failed to record arrival");
        }
    }

    function startOutOfRangeWatcher(bookingId, parkingLat, parkingLng) {
        if (!navigator.geolocation) return;
        if (activeWatchesRef.current[bookingId]) return;

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                try {
                    const userLat = pos.coords.latitude;
                    const userLng = pos.coords.longitude;
                    const dKm = getDistanceKm(userLat, userLng, parkingLat, parkingLng);
                    if (!Number.isFinite(dKm) || dKm <= ARRIVED_GATE_MAX_DISTANCE_KM) return;

                    // moved out of range -> revoke hold
                    await api.post(`/booking/${bookingId}/arrive-at-gate/revoke`, {
                        lat: userLat,
                        lng: userLng,
                    });

                    await fetchBookings();
                } catch (e) {
                    // ignore transient failures; revocation can be retried on next update
                } finally {
                    const wid = activeWatchesRef.current[bookingId];
                    if (typeof wid === "number") navigator.geolocation.clearWatch(wid);
                    delete activeWatchesRef.current[bookingId];
                }
            },
            () => {
                // no-op
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
            }
        );

        activeWatchesRef.current[bookingId] = watchId;
    }

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
                        bookings
                            .filter((b) => {
                                if (!b) return false;

                                // Hide temporary slot-holds and unpaid payment attempts.
                                if (["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(b.status)) return false;

                                const paymentStatus = b?.payment?.status;
                                if (paymentStatus && paymentStatus !== "PAID") return false;

                                // Extra guard: hide holds that expired due to payment window.
                                if (b.status === "EXPIRED" && b?.payment?.failureReason === "PAYMENT_WINDOW_EXPIRED") return false;

                                return true;
                            })
                            .map((b) => {
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

                                const gate = b.gateStatus || "PENDING_ENTRY";
                                const queueHoldUntil = b.queueHoldUntil ? new Date(b.queueHoldUntil) : null;
                                const queueHoldActive = queueHoldUntil && queueHoldUntil.getTime() > Date.now();

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
                    ${b.status === "UPCOMING"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : b.status === "ACTIVE"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : b.status === "CHECKED_IN"
                                                        ? "bg-cyan-500/20 text-cyan-300"
                                                        : b.status === "OVERSTAYED"
                                                            ? "bg-amber-500/20 text-amber-300"
                                                            : b.status === "COMPLETED"
                                                                ? "bg-gray-500/20 text-gray-200"
                                                                : b.status === "CANCELLED"
                                                                    ? "bg-red-500/20 text-red-400"
                                                                    : "bg-gray-500/20 text-gray-300"
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

                                    {b.status === "CANCELLED" && Number(b.refundAmount || 0) > 0 ? (
                                        <p className="text-amber-300 font-semibold">
                                            Refund: ₹{Number(b.refundAmount || 0)}
                                            {typeof b.refundPercent === "number" ? ` (${Math.round(b.refundPercent * 100)}%)` : ""}
                                        </p>
                                    ) : null}

                                    {(Number(b.overstayFineDue || 0) > 0 || Number(b.overstayFine || 0) > 0) ? (
                                        <p className="text-amber-300 font-semibold">
                                            Overstay Fine: ₹{Number(b.overstayFineDue || b.overstayFine || 0)}
                                        </p>
                                    ) : null}

                                    {queueHoldActive ? (
                                        <p className="text-cyan-300 font-semibold">
                                            Queue hold active (10 min)
                                        </p>
                                    ) : null}
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

                                    {(["UPCOMING", "ACTIVE"].includes(b.status)) && (
                                        <button
                                            onClick={() => cancelBooking(b._id)}
                                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"
                                        >
                                            Cancel
                                        </button>
                                    )}

                                    {(b.status === "ACTIVE" && gate === "PENDING_ENTRY" && !queueHoldActive) ? (
                                        <button
                                            onClick={() => markArrivedAtGate(b._id, parkingLat, parkingLng)}
                                            disabled={!canDirections}
                                            className="px-4 py-2 border border-white/20 rounded-xl hover:bg-white/10 disabled:opacity-50"
                                        >
                                            Arrived at gate
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                                );
                            })
                    )}
                </div>
            </div>
        </>
    );
}
