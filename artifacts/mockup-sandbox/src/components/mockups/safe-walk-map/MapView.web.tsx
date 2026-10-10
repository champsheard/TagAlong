import { useEffect } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "./MapView.types";

function Fit({ center, routes, fitPadding }: MapViewProps) {
  const map = useMap();
  useEffect(() => {
    const points = routes?.flatMap(route =>
      route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
    if (points?.length) map.fitBounds(points, {
      paddingTopLeft: [fitPadding?.left ?? 30, fitPadding?.top ?? 30],
      paddingBottomRight: [fitPadding?.right ?? 30, fitPadding?.bottom ?? 30],
      maxZoom: 16,
      animate: false,
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
    <MapContainer
      center={[props.center.lat, props.center.lng]}
      zoom={15}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit {...props} />
      {props.routes?.map(route => <Polyline
        key={route.id}
        positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
        pathOptions={{ color: route.color, weight: 5, opacity: 0.9 }}
      />)}
      {props.markers?.map((point, index) => <CircleMarker
        key={index}
        center={[point.lat, point.lng]}
        radius={7}
        pathOptions={{ color: "#193c32", fillColor: "#f2f0e8", fillOpacity: 1 }}
      ><Tooltip>{point.label}</Tooltip></CircleMarker>)}
      {props.livePosition && <CircleMarker
        center={[props.livePosition.lat, props.livePosition.lng]}
        radius={9}
        pathOptions={{ color: "#fff", weight: 3, fillColor: "#236ce1", fillOpacity: 1 }}
      ><Tooltip>Your current location</Tooltip></CircleMarker>}
    </MapContainer>
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="OpenStreetMap attribution"
      onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      style={{
        position: "absolute",
        right: 6,
        bottom: (props.attributionBottom ?? 4) + 3,
        zIndex: 700,
        backgroundColor: "rgba(251,250,245,0.94)",
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 7,
      }}
    >
      <Text style={{ fontSize: 10, color: "#193c32", fontWeight: "700" }}>© OpenStreetMap</Text>
    </Pressable>
  </View>;
}
