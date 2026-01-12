import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import UserNavbar from "../../components/UserNavbar";

export default function Booking() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const parkingId = params.get("id");

    const [vehicleNumber, setVehicleNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [bookingDate, setBookingDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const [parking, setParking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        let isActive = true;
        async function fetchParking() {
            if (!parkingId) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const res = await api.get(`/parking/${parkingId}`);
                if (isActive) setParking(res.data);
            } catch (e) {
                console.error("Failed to fetch parking", e);
            } finally {
                if (isActive) setLoading(false);
            }
        }
        fetchParking();
        return () => {
            isActive = false;
        };
    }, [parkingId]);

    useEffect(() => {
        let alive = true;

        async function fetchProfile() {
            try {
                setLoadingProfile(true);
                const res = await api.get("/auth/me");
                if (!alive) return;
                setCustomerName(res.data?.name ?? "");
                setCustomerEmail(res.data?.email ?? "");
                setCustomerPhone(res.data?.phone ?? "");
            } catch {
                // Non-fatal; user can still type manually.
            } finally {
                if (alive) setLoadingProfile(false);
            }
        }

        fetchProfile();
        return () => {
            alive = false;
        };
    }, []);

    const duration = useMemo(() => {
        if (!startTime || !endTime) return 0;
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        if (!Number.isFinite(hours) || hours <= 0) return 0;
        return Math.ceil(hours);
    }, [startTime, endTime]);

    const pricePerHour = Number(parking?.price || 0);
    const totalPrice = duration * pricePerHour;

    function handleConfirm() {
        if (!parkingId) {
            alert("Parking not found. Please go back and select again.");
            return;
        }

        if (!vehicleNumber || !bookingDate || !startTime || !endTime) {
            alert("Please fill all fields");
            return;
        }

        if (!customerName || !customerEmail || !customerPhone) {
            alert("Please fill your contact details");
            return;
        }

        if (duration <= 0) {
            alert("Please select a valid time range");
            return;
        }

        navigate("/user/payment", {
            state: {
                parking,
                parkingId,
                vehicleNumber,
                customerName,
                customerEmail,
                customerPhone,
                bookingDate,
                startTime,
                endTime,
                duration,
                total: totalPrice,
            },
        });
    }

    return (
        <>
            <UserNavbar />
            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
                <div className="max-w-xl mx-auto bg-[#0f172a] border border-white/10 rounded-2xl p-6">
                    <h2 className="text-2xl font-semibold mb-6">
                        Book Parking
                    </h2>

                    {!parkingId ? (
                        <p className="text-gray-400">Parking not found.</p>
                    ) : loading ? (
                        <p className="text-gray-400">Loading parking...</p>
                    ) : null}

                    <div className="space-y-4">
                        <div className="rounded-xl border border-white/10 p-4 bg-black/20">
                            <p className="text-sm text-gray-300 mb-3">
                                Your details {loadingProfile ? "(loading…)" : ""}
                            </p>

                            <input
                                type="text"
                                placeholder="Full name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 mb-3"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                                />
                            </div>
                        </div>

                        <input
                            type="text"
                            placeholder="Vehicle Number"
                            value={vehicleNumber}
                            onChange={(e) =>
                                setVehicleNumber(e.target.value)
                            }
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                        />

                        <input
                            type="date"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white scheme-dark"
                            value={bookingDate}
                            onChange={(e) => setBookingDate(e.target.value)}
                        />


                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) =>
                                    setStartTime(e.target.value)
                                }
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 scheme-dark"
                            />
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) =>
                                    setEndTime(e.target.value)
                                }
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 scheme-dark"
                            />
                        </div>
                    </div>

                    {/* SUMMARY */}
                    <div className="mt-6 border-t border-white/10 pt-4 text-sm text-gray-300">
                        <p>Duration: {duration} hrs</p>
                        <p>Price / hr: ₹{pricePerHour}</p>
                        <p className="text-white font-semibold">
                            Total: ₹{totalPrice}
                        </p>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={!parkingId || loading}
                        className="mt-6 w-full bg-white text-black py-3 rounded-xl font-medium hover:bg-gray-200"
                    >
                        Confirm Booking
                    </button>
                </div>
            </div>
        </>
    );
}
