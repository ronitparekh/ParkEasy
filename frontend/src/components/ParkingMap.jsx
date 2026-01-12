import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function RecenterOnUser({ userLocation }) {
  const map = useMap();

  if (userLocation?.lat && userLocation?.lng) {
    map.setView([userLocation.lat, userLocation.lng], map.getZoom(), {
      animate: true,
    });
  }

  return null;
}

export default function ParkingMap({
  mapRef,
  userLocation,
  parkings,
}) {
  return (
    <MapContainer
      center={
        userLocation
          ? [userLocation.lat, userLocation.lng]
          : [23.0225, 72.5714]
      }
      zoom={13}
      className="w-full h-72 sm:h-96 lg:h-128 rounded-xl"
      whenCreated={(mapInstance) => {
        if (mapRef) {
          mapRef.current = mapInstance;
        }
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && <RecenterOnUser userLocation={userLocation} />}

      {userLocation && (
        <>
          {typeof userLocation.accuracy === "number" &&
            !Number.isNaN(userLocation.accuracy) &&
            userLocation.accuracy > 0 && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={Math.min(userLocation.accuracy, 500)}
                pathOptions={{ color: "#3b82f6" }}
                fillOpacity={0.15}
              />
            )}

          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={7}
            pathOptions={{ color: "#2563eb" }}
            fillColor="#3b82f6"
            fillOpacity={0.9}
          />

          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={11}
            pathOptions={{ color: "#93c5fd" }}
            fillOpacity={0.15}
          />
        </>
      )}

      {parkings.map((p) => (
        <Marker
          key={p._id}
          position={[p.lat, p.lng]}
        >
          <Popup>{p.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
