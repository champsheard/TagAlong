import { Fragment, useEffect } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "./MapView.types";

function Fit({ center, routes, fitPadding }: MapViewProps) {
  const map = useMap();
  useEffect(() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]));
    if (points?.length) map.fitBounds(points, {
      paddingTopLeft: [fitPadding?.left ?? 30, fitPadding?.top ?? 30],
      paddingBottomRight: [fitPadding?.right ?? 30, fitPadding?.bottom ?? 30],
      maxZoom: 16, animate: false,
    });
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [routes, map, fitPadding?.top, fitPadding?.right, fitPadding?.bottom, fitPadding?.left]);
  useEffect(() => {
    if (!routes?.length) map.setView([center.lat, center.lng], 15);
  }, [center.lat, center.lng, routes?.length, map]);
  return null;
}
export default function MapView(props: MapViewProps) {
  return <View style={{ flex: 1 }}>
    <MapContainer center={[props.center.lat, props.center.lng]} zoom={15} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} attributionControl={false} className="safe-walk-map" aria-label="OpenStreetMap walking route map" style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Fit {...props} />
    {props.routes?.map(r => <Fragment key={r.id}>
      <Polyline positions={r.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: "#f5f3e9", weight: 11, opacity: 0.96, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={r.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: r.color, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }} />
    </Fragment>)}
    {props.markers?.map((p, i) => <Fragment key={`${p.label}-${i}`}>
      <CircleMarker center={[p.lat, p.lng]} radius={11} pathOptions={{ color: "#f5f3e9", weight: 3, fillColor: p.label.toLowerCase().includes("destination") ? "#426b49" : "#193b31", fillOpacity: 1 }}>
        <Tooltip>{p.label}</Tooltip>
      </CircleMarker>
    </Fragment>)}
    {props.livePosition && <>
      <CircleMarker center={[props.livePosition.lat, props.livePosition.lng]} radius={16} interactive={false} pathOptions={{ stroke: false, fillColor: "#236ce1", fillOpacity: 0.18 }} />
      <CircleMarker center={[props.livePosition.lat, props.livePosition.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#236ce1", fillOpacity: 1 }}><Tooltip>{props.livePositionLabel ?? "Your current location"}</Tooltip></CircleMarker>
    </>}
    </MapContainer>
    <style>{`.safe-walk-map .leaflet-tile { filter: saturate(.83) contrast(1.02); } .safe-walk-map .leaflet-tooltip { border: 1px solid rgba(25,59,49,.1); border-radius: 8px; color: #193b31; background: #f5f3e9; box-shadow: 0 4px 12px rgba(28,50,37,.13); font-weight: 700; }`}</style>
    <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      style={{ position: "absolute", right: 6, bottom: (props.attributionBottom ?? 4) + 3, minHeight: 32, justifyContent: "center", backgroundColor: "rgba(251,250,245,0.96)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 }}>
      <Text style={{ fontSize: 10, color: "#193c32", fontWeight: "700" }}>© OpenStreetMap</Text>
    </Pressable>
  </View>;
}
