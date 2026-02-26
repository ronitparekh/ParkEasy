import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import UserNavbar from "../../components/UserNavbar";

function pad2(n) {
    return String(n).padStart(2, "0");
}

function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowTimeHHMM() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseTimeToParts(t) {
    const [hh, mm] = String(t || "").split(":");
    const h = Number(hh);
    const m = Number(mm);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h, m };
}

function timeFromParts(h, m) {
    return `${pad2(h)}:${pad2(m)}`;
}

function addHoursToTimeStr(startTime, hoursToAdd) {
    const parts = parseTimeToParts(startTime);
    if (!parts) return "";
    const endH = parts.h + Number(hoursToAdd || 0);
    if (!Number.isFinite(endH) || endH < 0 || endH > 23) return "";
    return timeFromParts(endH, parts.m);
}

export default function Booking() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const parkingId = params.get("id");

    const [vehicleNumber, setVehicleNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [bookingDate, setBookingDate] = useState(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    });
    const [startTime, setStartTime] = useState("");
    const [durationHours, setDurationHours] = useState(1);

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

    const minDate = useMemo(() => todayYmd(), []);

    const isToday = bookingDate === todayYmd();
    const minStartTime = isToday ? nowTimeHHMM() : undefined;

    const maxDuration = useMemo(() => {
        const parts = parseTimeToParts(startTime);
        if (!parts) return 0;
        // keep booking within the same day; end hour cannot exceed 23
        return Math.max(0, 23 - parts.h);
    }, [startTime]);

    const durationOptions = useMemo(() => {
        const max = Math.min(12, maxDuration || 0);
        return Array.from({ length: max }, (_, i) => i + 1);
    }, [maxDuration]);

    useEffect(() => {
        // Keep duration inside allowed bounds when start time changes.
        if (!durationOptions.length) {
            setDurationHours(1);
            return;
        }
        if (!durationOptions.includes(durationHours)) {
            setDurationHours(durationOptions[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTime, durationOptions.join(",")]);

    const endTime = useMemo(() => {
        if (!startTime || !durationHours) return "";
        return addHoursToTimeStr(startTime, durationHours);
    }, [startTime, durationHours]);

    const duration = durationHours;

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

        if (bookingDate < minDate) {
            alert("Please select a valid booking date");
            return;
        }

        if (isToday && minStartTime && startTime < minStartTime) {
            alert("Please select a start time that is not in the past");
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
                            min={minDate}
                        />


                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                min={minStartTime}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 scheme-dark"
                            />

                            <select
                                value={durationHours}
                                onChange={(e) => setDurationHours(Number(e.target.value))}
                                disabled={!durationOptions.length}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white disabled:opacity-50"
                            >
                                {durationOptions.length ? (
                                    durationOptions.map((h) => (
                                        <option key={h} value={h}>
                                            {h} hr
                                        </option>
                                    ))
                                ) : (
                                    <option value={1}>No slots</option>
                                )}
                            </select>
                        </div>

                        <input
                            type="text"
                            value={endTime ? `End time: ${endTime}` : "End time"}
                            readOnly
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-gray-300"
                        />
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
                        disabled={!parkingId || loading || !startTime || !endTime || duration <= 0}
                        className="mt-6 w-full bg-white text-black py-3 rounded-xl font-medium hover:bg-gray-200"
                    >
                        Confirm Booking
                    </button>
                </div>
            </div>
        </>
    );
}
