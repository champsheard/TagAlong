import "./_group.css";
import MapView from "./MapView.web";

const route = {
  type: "LineString" as const,
  coordinates: [
    [-122.4194, 37.7749],
    [-122.4183, 37.7757],
    [-122.4167, 37.7765],
    [-122.4152, 37.7771],
    [-122.4135, 37.7786],
  ] as [number, number][],
};

export function Current() {
  return <main className="sw-map-current">
    <MapView
      center={{ lat: 37.7764, lng: -122.4165 }}
      routes={[{ id: "sample-route", geometry: route, color: "#567236" }]}
      markers={[
        { lat: 37.7749, lng: -122.4194, label: "Start" },
        { lat: 37.7786, lng: -122.4135, label: "Destination" },
      ]}
      livePosition={{ lat: 37.7757, lng: -122.4183 }}
    />
    <div className="sw-sample-label">SAMPLE ROUTE · NOT A LIVE WALK</div>
  </main>;
}
