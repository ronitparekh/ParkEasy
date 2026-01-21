import { useNavigate } from "react-router-dom";

export default function ParkingCard({ parking, selected, onSelect }) {
  const navigate = useNavigate();

  const { _id, name, price, totalSlots = 0, availableSlots = 0, lat, lng } =
    parking;

  const isFull = availableSlots <= 0;

  function openDirections(e) {
    e.stopPropagation();
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    );
  }

  function handleBook(e) {
    e.stopPropagation();
    if (isFull) return;
    navigate(`/user/booking?id=${_id}`);
  }

  return (
    <div
      onClick={onSelect}
      className={`
        bg-[#0f172a] rounded-2xl p-5 flex flex-col justify-between
        border transition-all duration-200 cursor-pointer
        ${
          selected
            ? "border-blue-400/70 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
            : "border-white/10 hover:border-white/20"
        }
      `}
    >
      <div>
        <h3 className="text-xl font-semibold">{name}</h3>

        <p className="text-gray-400 mt-1">₹{price} / hour</p>

        <div className="mt-3 text-sm">
          <p>
            Total slots: <span className="text-gray-300">{totalSlots}</span>
          </p>
          <p>
            Available:{" "}
            <span className={availableSlots > 0 ? "text-green-400" : "text-red-400"}>
              {availableSlots}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleBook}
          disabled={isFull}
          className={`
            w-full sm:flex-1 rounded-xl py-2 font-medium
            ${
              isFull
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-white text-black hover:bg-gray-200"
            }
          `}
        >
          {isFull ? "Full" : "Book"}
        </button>

        <button
          onClick={openDirections}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/20 text-sm hover:bg-white/10"
        >
          Directions
        </button>
      </div>
    </div>
  );
}
