import { useEffect, useState, useRef } from "react";
import api from "../../api/api";
import SearchBar from "../../components/SearchBar";
import ParkingCard from "../../components/ParkingCard";
import ParkingMap from "../../components/ParkingMap";
import UserNavbar from "../../components/UserNavbar";

export default function UserDashboard() {
  const mapRef = useRef(null);

  // USER LOCATION
  const [userLocation, setUserLocation] = useState(null);

  // INPUT STATES
  const [searchText, setSearchText] = useState("");
  const [distance, setDistance] = useState(1);
  const [useDistanceFilter, setUseDistanceFilter] = useState(true);

  // DATA
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ SELECTED PARKING (MAP ↔ CARD SYNC)
  const [selectedParkingId, setSelectedParkingId] = useState(null);

  // ✅ store refs of each parking card for scroll
  const cardRefs = useRef({});

  // ✅ store refs of marker instances for popup open
  const markerRefs = useRef({});

  function zoomTo(lat, lng, zoom = 14) {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], zoom, { animate: true });
    }
  }

  // =========================
  // INITIAL LOAD → NEARBY 1KM
  // =========================
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserLocation(loc);

        fetchParkings({
          lat: loc.lat,
          lng: loc.lng,
          distance: 1,
          useDistance: true,
          search: "",
          zoomAfter: true,
        });
      },
      () => {
        alert("Location permission required to show nearby parking");
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userLocation) {
      zoomTo(userLocation.lat, userLocation.lng, 14);
    }
  }, [userLocation]);

  async function fetchParkings({
    lat,
    lng,
    distance,
    useDistance,
    search,
    zoomAfter = false,
  }) {
    try {
      setLoading(true);

      const params = {};
      if (search) params.search = search;

      if (useDistance && lat && lng) {
        params.lat = lat;
        params.lng = lng;
        params.distance = distance;
      }

      const res = await api.get("/parking/nearby", { params });
      setParkings(res.data);

      // reset selection when new data loads
      setSelectedParkingId(null);

      if (zoomAfter && useDistance && lat && lng) {
        zoomTo(lat, lng, 14);
      }
    } catch (err) {
      console.error("Failed to fetch parkings", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    fetchParkings({
      lat: userLocation?.lat,
      lng: userLocation?.lng,
      distance,
      useDistance: useDistanceFilter,
      search: searchText,
      zoomAfter: true,
    });
  }

  function handleUseMyLocation() {
    if (!userLocation) return;

    setSearchText("");
    setDistance(1);
    setUseDistanceFilter(true);

    fetchParkings({
      lat: userLocation.lat,
      lng: userLocation.lng,
      distance: 1,
      useDistance: true,
      search: "",
      zoomAfter: true,
    });

    zoomTo(userLocation.lat, userLocation.lng, 14);
  }

  // ✅ MARKER CLICK → highlight + scroll to card
  function handleMarkerSelect(parking) {
    setSelectedParkingId(parking._id);

    const el = cardRefs.current[parking._id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ✅ CARD CLICK → highlight + zoom to marker + open popup
  function handleCardSelect(parking) {
    setSelectedParkingId(parking._id);

    if (mapRef.current) {
      mapRef.current.setView([parking.lat, parking.lng], 16, {
        animate: true,
      });
    }

    // open popup of marker
    setTimeout(() => {
      markerRefs.current[parking._id]?.openPopup?.();
    }, 150);
  }

  return (
    <>
      <UserNavbar />
      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-4xl font-bold">Find Parking</h1>
          <p className="text-gray-400 mt-2 mb-8">
            Search and book parking spaces easily
          </p>

          {/* SEARCH PANEL */}
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 mb-8">
            <div className="grid md:grid-cols-3 gap-4">
              <SearchBar value={searchText} onChange={setSearchText} />

              <select
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                disabled={!useDistanceFilter}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white disabled:opacity-50"
              >
                <option value={1}>Within 1 km</option>
                <option value={3}>Within 3 km</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
              </select>

              <button
                onClick={handleSearch}
                className="w-full bg-white text-black rounded-xl px-6 py-3 font-medium hover:bg-gray-200"
              >
                Search
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={useDistanceFilter}
                  onChange={(e) => setUseDistanceFilter(e.target.checked)}
                />
                Filter by distance
              </label>

              <button
                onClick={handleUseMyLocation}
                className="text-sm text-blue-400 hover:underline"
              >
                Use my location
              </button>
            </div>
          </div>

          {/* MAP */}
          <div className="mb-10">
            <ParkingMap
              mapRef={mapRef}
              userLocation={userLocation}
              parkings={parkings}
              selectedParkingId={selectedParkingId}
              onMarkerSelect={handleMarkerSelect}
              markerRefs={markerRefs}
            />
          </div>

          {/* RESULTS */}
          {loading ? (
            <p className="text-gray-400">Loading parkings...</p>
          ) : parkings.length === 0 ? (
            <p className="text-gray-400">No parking spots found.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {parkings.map((p) => (
                <div
                  key={p._id}
                  ref={(el) => {
                    if (el) cardRefs.current[p._id] = el;
                  }}
                >
                  <ParkingCard
                    parking={p}
                    selected={selectedParkingId === p._id}
                    onSelect={() => handleCardSelect(p)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
