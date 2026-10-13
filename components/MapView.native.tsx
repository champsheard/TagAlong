import { Fragment, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import NativeMap, { UrlTile, Marker, Polyline } from "react-native-maps";
import type { MapViewProps } from "./MapView.types";

export default function MapView({ center, routes, markers, livePosition, livePositionLabel, fitPadding, attributionBottom }: MapViewProps) {
  const ref = useRef<NativeMap>(null);
  const [mapHeight, setMapHeight] = useState(0);
  useEffect(() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })));
    if (points?.length) setTimeout(() => ref.current?.fitToCoordinates(points, {
      edgePadding: fitPadding ?? { top: 35, bottom: 35, left: 35, right: 35 }, animated: false,
    }), 200);
  }, [routes, fitPadding?.top, fitPadding?.bottom, fitPadding?.left, fitPadding?.right]);
  useEffect(() => {
    if (!routes?.length && mapHeight > 0) {
      const visibleCenterOffset = ((fitPadding?.top ?? 0) - (fitPadding?.bottom ?? 0)) / 2;
      const boundedOffset = Math.max(-mapHeight / 2, Math.min(visibleCenterOffset, mapHeight / 2));
      const latitudeDelta = 0.012;
      ref.current?.animateToRegion({
        latitude: center.lat + boundedOffset / mapHeight * latitudeDelta,
        longitude: center.lng,
        latitudeDelta,
        longitudeDelta: 0.012,
      }, 250);
    }
  }, [center.lat, center.lng, routes?.length, mapHeight, fitPadding?.top, fitPadding?.bottom]);
  return <View style={{ flex: 1 }} onLayout={event => setMapHeight(event.nativeEvent.layout.height)}><NativeMap ref={ref} style={{ flex: 1 }} mapType={Platform.OS === "android" ? "none" : "standard"} accessibilityLabel={Platform.OS === "ios" ? "Apple Maps walking route map" : "OpenStreetMap walking route map"} initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }} onMapReady={() => {
    const points = routes?.flatMap(r => r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })));
    if (points?.length) ref.current?.fitToCoordinates(points, { edgePadding: fitPadding ?? { top: 35, bottom: 35, left: 35, right: 35 }, animated: false });
  }}>
    {Platform.OS === "android" && <UrlTile
      urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maximumZ={19}
      tileCacheMaxAge={86400}
    />}
    {routes?.map(r => <Fragment key={`${r.id}-route`}>
      <Polyline coordinates={r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))} strokeColor="#f5f3e9" strokeWidth={11} lineCap="round" lineJoin="round" />
      <Polyline coordinates={r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))} strokeColor={r.color} strokeWidth={5} lineCap="round" lineJoin="round" />
    </Fragment>)}
    {markers?.map((p, i) => <Marker
      key={`${p.label}-${i}`}
      coordinate={{ latitude: p.lat, longitude: p.lng }}
      title={p.label}
      accessibilityLabel={p.label}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: "#f5f3e9", backgroundColor: p.label.toLowerCase().includes("destination") ? "#426b49" : "#193b31", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#f5f3e9" }} />
      </View>
    </Marker>)}
    {livePosition && <Marker
      coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }}
      title={livePositionLabel ?? "Your current location"}
      accessibilityLabel={livePositionLabel ?? "Your current location"}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(35,108,225,0.18)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: "#fff", backgroundColor: "#236ce1" }} />
      </View>
    </Marker>}
  </NativeMap>{Platform.OS === "android" && <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")} style={{ position: "absolute", right: 6, bottom: (attributionBottom ?? 4) + 3, minHeight: 32, justifyContent: "center", backgroundColor: "#fbfaf5f5", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 }}><Text style={{ fontSize: 10, color: "#193c32", fontWeight: "700" }}>© OpenStreetMap</Text></Pressable>}</View>;
}
