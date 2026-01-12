import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = new L.Icon({
  iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
  iconSize: [32, 32],
});

function ClickToSetMarker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  heightClassName = "h-56",
  defaultCenter = [23.0225, 72.5714],
}) {
  const hasValue =
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng);

  const center = hasValue ? [lat, lng] : defaultCenter;

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-white/10 ${heightClassName}`}>
      <MapContainer center={center} zoom={13} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <ClickToSetMarker onPick={onChange} />

        {hasValue && (
          <Marker
            position={[lat, lng]}
            draggable
            icon={pinIcon}
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onChange({ lat: p.lat, lng: p.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
