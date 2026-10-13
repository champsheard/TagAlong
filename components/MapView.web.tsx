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
    if (!routes?.length) {
      const visibleCenterOffset = ((fitPadding?.top ?? 0) - (fitPadding?.bottom ?? 0)) / 2;
      const targetPixel = map.project([center.lat, center.lng], 15);
      const adjustedCenter = map.unproject([targetPixel.x, targetPixel.y - visibleCenterOffset], 15);
      map.setView(adjustedCenter, 15);
    }
  }, [center.lat, center.lng, routes?.length, map, fitPadding?.top, fitPadding?.bottom]);
  return null;
}
export default function MapView(props: MapViewProps) {
  return <View style={{ flex: 1 }}>
    <MapContainer center={[props.center.lat, props.center.lng]} zoom={15} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} attributionControl={false} className="safe-walk-map" aria-label="OpenStreetMap walking route map" style={{ height: "100%", width: "100%", background: "#e5e8dc" }} scrollWheelZoom={false}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Fit {...props} />
    {props.routes?.map(r => <Fragment key={r.id}>
      <Polyline positions={r.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: "#f9f7ef", weight: 13, opacity: 0.96, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={r.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: r.color, weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }} />
    </Fragment>)}
    {props.markers?.map((p, i) => <Fragment key={`${p.label}-${i}`}>
      <CircleMarker center={[p.lat, p.lng]} radius={12} pathOptions={{ color: "#fbfaf4", weight: 4, fillColor: p.label.toLowerCase().includes("destination") ? "#a7bd59" : "#234b3d", fillOpacity: 1 }}>
        <Tooltip>{p.label}</Tooltip>
      </CircleMarker>
    </Fragment>)}
    {props.livePosition && <>
      <CircleMarker center={[props.livePosition.lat, props.livePosition.lng]} radius={20} interactive={false} pathOptions={{ stroke: false, fillColor: "#c58a4c", fillOpacity: 0.2 }} />
      <CircleMarker center={[props.livePosition.lat, props.livePosition.lng]} radius={9} pathOptions={{ color: "#fffdf6", weight: 3, fillColor: "#bd7740", fillOpacity: 1 }}><Tooltip>{props.livePositionLabel ?? "Your current location"}</Tooltip></CircleMarker>
    </>}
    </MapContainer>
    <style>{`
      .safe-walk-map { background: #e5e8dc; font-family: system-ui, sans-serif; }
      .safe-walk-map .leaflet-tile { filter: saturate(.72) sepia(.08) contrast(1.025); }
      .safe-walk-map .leaflet-tile-pane { opacity: .98; }
      .safe-walk-map .leaflet-tooltip { border: 1px solid rgba(35,75,61,.14); border-radius: 9px; color: #234b3d; background: #fbfaf4; box-shadow: 0 5px 16px rgba(28,50,37,.16); font-size: 12px; font-weight: 750; padding: 6px 9px; }
      .safe-walk-map .leaflet-tooltip:before { border-top-color: #fbfaf4; }
    `}</style>
    <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      style={{ position: "absolute", right: 8, bottom: (props.attributionBottom ?? 4) + 5, minHeight: 32, justifyContent: "center", backgroundColor: "rgba(251,250,245,0.97)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "rgba(35,75,61,.10)", shadowColor: "#234b3d", shadowOpacity: .1, shadowRadius: 9, shadowOffset: { width: 0, height: 2 } }}>
      <Text style={{ fontSize: 10, color: "#193c32", fontWeight: "700" }}>© OpenStreetMap</Text>
    </Pressable>
  </View>;
}
