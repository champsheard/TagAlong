import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "./MapView.types";

function Fit({ center, routes }: MapViewProps) {
  const map = useMap();
  useEffect(() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]));
    if (points?.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 16, animate: false });
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [routes, map]);
  useEffect(() => {
    if (!routes?.length) map.setView([center.lat, center.lng], 15);
  }, [center.lat, center.lng, routes?.length, map]);
  return null;
}
export default function MapView(props: MapViewProps) {
  return <MapContainer center={[props.center.lat, props.center.lng]} zoom={15} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
    <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Fit {...props} />
    {props.routes?.map(r => <Polyline key={r.id} positions={r.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: r.color, weight: 5, opacity: 0.9 }} />)}
    {props.markers?.map((p, i) => <CircleMarker key={i} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: "#193c32", fillColor: "#f2f0e8", fillOpacity: 1 }}><Tooltip>{p.label}</Tooltip></CircleMarker>)}
    {props.livePosition && <CircleMarker center={[props.livePosition.lat, props.livePosition.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#236ce1", fillOpacity: 1 }}><Tooltip>Your walker's location</Tooltip></CircleMarker>}
  </MapContainer>;
}
