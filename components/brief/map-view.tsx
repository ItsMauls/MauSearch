"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Default Leaflet marker icons resolve to paths the bundler doesn't ship -
 * pointing them at the same CDN copy of the package Leaflet already vendors
 * is the standard fix, not a new dependency.
 */
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type MapPoint = { name: string; note: string; lat: number; lon: number };

export default function MapView({ points }: { points: MapPoint[] }) {
  const center: [number, number] = [points[0].lat, points[0].lon];
  return (
    <MapContainer
      center={center}
      zoom={points.length > 1 ? 5 : 11}
      scrollWheelZoom={false}
      style={{ height: 260, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <Marker key={p.name} position={[p.lat, p.lon]} icon={icon}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.note}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
