import { useEffect, useState } from "react";
import api from "../../api/api";
import OwnerNavbar from "../../components/OwnerNavbar";
import LocationPickerMap from "../../components/LocationPickerMap";
import { useNavigate } from "react-router-dom";

export default function OwnerParkings() {
  const [parkings, setParkings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    lat: "",
    lng: "",
    price: "",
    totalSlots: "",
  });

  const navigate = useNavigate();

  async function fetchParkings() {
    const res = await api.get("/owner/parkings");
    setParkings(res.data || []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParkings();
  }, []);

  function startEdit(p) {
    setEditingId(p._id);
    setEditForm({
      name: p.name ?? "",
      lat: String(p.lat ?? ""),
      lng: String(p.lng ?? ""),
      price: String(p.price ?? ""),
      totalSlots: String(p.totalSlots ?? ""),
    });
    setEditOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditOpen(false);
    setEditForm({ name: "", lat: "", lng: "", price: "", totalSlots: "" });
  }

  async function saveEdit(id) {
    const payload = {
      name: editForm.name,
      lat: Number(editForm.lat),
      lng: Number(editForm.lng),
      price: Number(editForm.price),
      totalSlots: editForm.totalSlots === "" ? undefined : Number(editForm.totalSlots),
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
      const res = await api.put(`/owner/parkings/${id}`, payload);
      setParkings((prev) => prev.map((p) => (p._id === id ? res.data : p)));
      cancelEdit();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to update parking.");
    }
  }

  async function deleteParking(id) {
    const ok = window.confirm("Delete this parking?");
    if (!ok) return;
    try {
      await api.delete(`/owner/parkings/${id}`);
      setParkings((prev) => prev.filter((p) => p._id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to delete parking.");
    }
  }

  const editingParking = editingId
    ? parkings.find((p) => p._id === editingId)
    : null;

  return (
    <>
      <OwnerNavbar />

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto"
          onMouseDown={cancelEdit}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl max-h-[calc(100vh-3rem)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">Edit Parking</h3>
                <p className="text-sm text-gray-400">
                  {editingParking?.name || ""}
                </p>
              </div>
              <button
                className="text-white/70 hover:text-white px-2 py-1 rounded"
                onClick={cancelEdit}
                type="button"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                  placeholder="Name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
                <input
                  className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                  placeholder="Price"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm({ ...editForm, price: e.target.value })
                  }
                />

                <input
                  className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                  placeholder="Lat"
                  value={editForm.lat}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lat: e.target.value })
                  }
                />
                <input
                  className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                  placeholder="Lng"
                  value={editForm.lng}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lng: e.target.value })
                  }
                />
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/10">
                <LocationPickerMap
                  lat={editForm.lat === "" ? NaN : Number(editForm.lat)}
                  lng={editForm.lng === "" ? NaN : Number(editForm.lng)}
                  onChange={({ lat, lng }) =>
                    setEditForm({
                      ...editForm,
                      lat: String(lat),
                      lng: String(lng),
                    })
                  }
                  heightClassName="h-48 sm:h-64"
                />
              </div>

              <input
                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white"
                placeholder="Total slots"
                value={editForm.totalSlots}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    totalSlots: e.target.value,
                  })
                }
              />

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
                <button
                  onClick={cancelEdit}
                  type="button"
                  className="w-full sm:w-auto px-5 py-2 rounded-xl border border-white/20 text-gray-200 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveEdit(editingId)}
                  type="button"
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-white text-black hover:bg-gray-200"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
        <div className="max-w-6xl w-full min-w-0 mx-auto">
          <h1 className="text-3xl font-bold mb-8">My Parking Spaces</h1>

          {parkings.length === 0 ? (
            <p className="text-gray-400">No parking spaces added yet.</p>
          ) : (
            <div className="grid w-full min-w-0 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parkings.map((p) => (
                <div
                  key={p._id}
                  className="w-full max-w-full min-w-0 bg-[#0f172a] border border-white/10 rounded-xl p-5 flex flex-col min-h-48"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold truncate" title={p.name}>
                        {p.name}
                      </h3>
                      <p className="text-gray-400 mt-1">₹{p.price} / hr</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Slots: {p.availableSlots} / {p.totalSlots}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteParking(p._id)}
                      className="self-start sm:self-auto shrink-0 border border-white/20 rounded-lg px-3 py-2 text-red-300"
                      title="Delete parking"
                      aria-label="Delete parking"
                    >
                      Del
                    </button>
                  </div>

                  <div className="mt-auto pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={() => startEdit(p)}
                      className="w-full sm:flex-1 border border-white/20 rounded-lg py-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/owner/bookings?parkingId=${p._id}`)}
                      className="w-full sm:flex-1 border border-white/20 rounded-lg py-2"
                    >
                      View bookings
                    </button>
                    <button
                      onClick={() => navigate(`/owner/gate-scan?parkingId=${p._id}`)}
                      className="w-full sm:flex-1 bg-white text-black rounded-lg py-2"
                    >
                      Gate scan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
