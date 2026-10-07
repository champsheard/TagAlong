import { useEffect, useRef } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import NativeMap, { UrlTile, Marker, Polyline } from "react-native-maps";
import type { MapViewProps } from "./MapView.types";

export default function MapView({ center, routes, markers, livePosition }: MapViewProps) {
  const ref = useRef<NativeMap>(null);
  useEffect(() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })));
    if (points?.length) setTimeout(() => ref.current?.fitToCoordinates(points, { edgePadding: { top: 35, bottom: 35, left: 35, right: 35 }, animated: false }), 200);
  }, [routes]);
  return <View style={{ flex: 1 }}><NativeMap ref={ref} style={{ flex: 1 }} mapType="none" initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }} onMapReady={() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })));
    if (points?.length) ref.current?.fitToCoordinates(points, { edgePadding: { top: 35, bottom: 35, left: 35, right: 35 }, animated: false });
  }}>
    <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
    {routes?.map(r => <Polyline key={r.id} coordinates={r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))} strokeColor={r.color} strokeWidth={5} />)}
    {markers?.map((p, i) => <Marker key={i} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.label} pinColor="#193c32" />)}
    {livePosition && <Marker coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }} title="Live location" pinColor="#236ce1" />}
  </NativeMap><Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")} style={{ position: "absolute", right: 4, bottom: 4, backgroundColor: "#ffffffdd", padding: 4 }}><Text style={{ fontSize: 11, color: "#193c32" }}>© OpenStreetMap contributors</Text></Pressable></View>;
}
