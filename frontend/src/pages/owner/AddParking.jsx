import { useState } from "react";
import OwnerNavbar from "../../components/OwnerNavbar";
import api from "../../api/api";
import LocationPickerMap from "../../components/LocationPickerMap";


export default function AddParking() {
    const [form, setForm] = useState({
        name: "",
        lat: "",
        lng: "",
        price: "",
        totalSlots: "",
    });

    async function handleSubmit(e) {
        e.preventDefault();

        const payload = {
            name: form.name,
            lat: Number(form.lat),
            lng: Number(form.lng),
            price: Number(form.price),
            totalSlots: form.totalSlots === "" ? undefined : Number(form.totalSlots),
        };

        if (
            !payload.name ||
            Number.isNaN(payload.lat) ||
            Number.isNaN(payload.lng) ||
            Number.isNaN(payload.price) ||
            (payload.totalSlots !== undefined && Number.isNaN(payload.totalSlots))
        ) {
            alert("Please fill all fields correctly.");
            return;
        }

        try {
            await api.post("/owner/add-parking", payload);
            alert("Parking added");
            setForm({ name: "", lat: "", lng: "", price: "", totalSlots: "" });
        } catch (e) {
            alert(
                e?.response?.data?.message ||
                "Failed to add parking."
            );
        }
    }

    return (
        <>
            <OwnerNavbar />
            <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white flex items-start sm:items-center justify-center px-4 py-10">
                <form
                    onSubmit={handleSubmit}
                    className="bg-[#0f172a] border border-white/10 p-6 sm:p-8 rounded-2xl w-full max-w-lg"
                >
                    <h1 className="text-2xl font-bold mb-6">Add New Parking</h1>

                    <input
                        placeholder="NAME"
                        className="w-full mb-4 bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                        value={form.name}
                        onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                        }
                    />

                    <div className="mb-4">
                        <p className="text-sm text-gray-400 mb-2">
                            Pick exact location (click or drag pin)
                        </p>
                        <LocationPickerMap
                            lat={form.lat === "" ? NaN : Number(form.lat)}
                            lng={form.lng === "" ? NaN : Number(form.lng)}
                            onChange={({ lat, lng }) =>
                                setForm({
                                    ...form,
                                    lat: String(lat),
                                    lng: String(lng),
                                })
                            }
                            heightClassName="h-60"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            placeholder="LAT"
                            className="w-full mb-4 bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                            value={form.lat}
                            onChange={(e) =>
                                setForm({ ...form, lat: e.target.value })
                            }
                        />
                        <input
                            placeholder="LNG"
                            className="w-full mb-4 bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                            value={form.lng}
                            onChange={(e) =>
                                setForm({ ...form, lng: e.target.value })
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            placeholder="PRICE (₹/hr)"
                            className="w-full mb-4 bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                            value={form.price}
                            onChange={(e) =>
                                setForm({ ...form, price: e.target.value })
                            }
                        />
                        <input
                            placeholder="TOTAL SLOTS"
                            className="w-full mb-4 bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                            value={form.totalSlots}
                            onChange={(e) =>
                                setForm({ ...form, totalSlots: e.target.value })
                            }
                        />
                    </div>

                    <button className="w-full bg-white text-black py-3 rounded-xl hover:bg-gray-200">
                        Add Parking
                    </button>
                </form>
            </div>
        </>
    );
}
