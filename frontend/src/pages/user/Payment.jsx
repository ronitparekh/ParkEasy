import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserNavbar from "../../components/UserNavbar";
import api from "../../api/api";

function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function Payment() {
    const { state } = useLocation();
    const navigate = useNavigate();

    const [keyId, setKeyId] = useState(null);
    const [orderId, setOrderId] = useState(null);
    const [bookingId, setBookingId] = useState(null);
    const [amount, setAmount] = useState(null);
    const [currency, setCurrency] = useState("INR");
    const [holdExpiresAt, setHoldExpiresAt] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState("");

    const parkingId = useMemo(
        () => state?.parkingId || state?.parking?._id,
        [state]
    );

    useEffect(() => {
        let alive = true;

        async function init() {
            try {
                setError("");
                setLoadingOrder(true);

                if (!state?.parking) {
                    throw new Error("Payment not found. Please complete a booking first.");
                }

                if (!parkingId) {
                    throw new Error("Parking ID missing. Please go back.");
                }

                if (!state.vehicleNumber || !state.bookingDate || !state.startTime || !state.endTime) {
                    throw new Error("Booking details missing. Please go back and fill all fields.");
                }

                const [keyRes, orderRes] = await Promise.all([
                    api.get("/payment/razorpay/key"),
                    api.post("/payment/razorpay/create-order", {
                        parkingId,
                        vehicleNumber: state.vehicleNumber,
                        bookingDate: state.bookingDate,
                        startTime: state.startTime,
                        endTime: state.endTime,
                        customerName: state.customerName,
                        customerEmail: state.customerEmail,
                        customerPhone: state.customerPhone,
                    }),
                ]);

                if (!alive) return;

                setKeyId(keyRes.data?.keyId || null);
                setOrderId(orderRes.data?.orderId || null);
                setBookingId(orderRes.data?.bookingId || null);
                setAmount(orderRes.data?.amount ?? null);
                setCurrency(orderRes.data?.currency || "INR");
                setHoldExpiresAt(orderRes.data?.holdExpiresAt || null);
            } catch (e) {
                if (!alive) return;
                setError(e?.response?.data?.message || e?.message || "Failed to initialize payment");
            } finally {
                if (alive) setLoadingOrder(false);
            }
        }

        init();
        return () => {
            alive = false;
        };
    }, [parkingId, state]);

    if (!state?.parking) {
        return (
            <div className="ui-page">
                <div className="ui-container">
                    <div className="ui-card ui-card-pad">
                        <h1 className="ui-title">Payment not found</h1>
                        <p className="ui-subtitle">Please complete a booking first.</p>
                    </div>
                </div>
            </div>
        );
    }

    async function handlePayment() {
        try {
            setError("");
            setPaying(true);

            if (!keyId || !orderId || !bookingId || !amount) {
                throw new Error("Payment is not ready yet. Please wait.");
            }

            const ok = await loadRazorpayScript();
            if (!ok) {
                throw new Error("Failed to load Razorpay. Please check your internet.");
            }

            const options = {
                key: keyId,
                amount,
                currency,
                name: "ParkEasy",
                description: `Parking booking: ${state.parking?.name || ""}`,
                order_id: orderId,
                prefill: {
                    name: state.customerName,
                    email: state.customerEmail,
                    contact: state.customerPhone,
                },
                notes: {
                    bookingId,
                    parkingId,
                },
                handler: async function (response) {
                    try {
                        await api.post("/payment/razorpay/verify", {
                            bookingId,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        navigate("/user/history");
                    } catch (e) {
                        setError(e?.response?.data?.message || "Payment verification failed");
                    } finally {
                        setPaying(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setPaying(false);
                        setError("Payment cancelled. Slot will be released in ~2 minutes.");
                    },
                },
                theme: {
                    color: "#22c55e",
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function () {
                setPaying(false);
                setError("Payment failed. Slot will be released in ~2 minutes.");
            });
            rzp.open();
        } catch (e) {
            setError(e?.response?.data?.message || e?.message || "Payment failed");
            setPaying(false);
        }
    }

    return (
        <>
            <UserNavbar />
            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black flex items-start sm:items-center justify-center text-white px-4 py-10">
                <div className="bg-[#0f172a] border border-white/10 p-6 sm:p-8 rounded-2xl w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center">
                        Payment
                    </h1>

                    <div className="text-gray-400 space-y-2 mb-6">
                        <p><b className="text-white">Parking:</b> {state.parking.name}</p>
                        <p><b className="text-white">Total:</b> ₹{typeof amount === "number" ? (amount / 100).toFixed(0) : state.total}</p>
                        <p><b className="text-white">Name:</b> {state.customerName}</p>
                        <p><b className="text-white">Email:</b> {state.customerEmail}</p>
                        <p><b className="text-white">Phone:</b> {state.customerPhone}</p>
                        {holdExpiresAt ? (
                            <p><b className="text-white">Slot hold till:</b> {new Date(holdExpiresAt).toLocaleTimeString()}</p>
                        ) : null}
                    </div>

                    {error ? (
                        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                            {error}
                        </div>
                    ) : null}

                    <button
                        onClick={handlePayment}
                        disabled={loadingOrder || paying || !orderId}
                        className="w-full bg-green-500 disabled:opacity-60 text-black py-3 rounded-xl hover:bg-green-400"
                    >
                        {loadingOrder ? "Reserving slot…" : paying ? "Opening Razorpay…" : "Pay Now"}
                    </button>
                </div>
            </div>
        </>
    );


}
