import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { OWN_BASEMAP, STANDARD_BASEMAP } from "../catalog/basemaps";
import { mountVectorBasemap } from "../catalog/vectorBasemap";
import { resolveAddress, type NearbyPlace } from "./address-at";
import { useAppliedScheme } from "./theme";

export { pinLabel, parsePinLabel, placePinLabel, placePinTitle } from "./pin-label";

const CENTER: [number, number] = [55.7522, 37.6156];
const BRAND_PIN_HTML = '<span class="app-pin-marker-drop"></span>';

export interface PinChoice {
  address: string;
  latitude: number;
  longitude: number;
}

/** A point on the map. Confirm returns the street, not the latitude and longitude. */
export function PinPicker({ title, places = [], onConfirm, onClose }: { title: string; places?: readonly NearbyPlace[]; onConfirm: (choice: PinChoice) => void; onClose: () => void }) {
  const node = useRef<HTMLDivElement | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [looking, setLooking] = useState(false);
  const scheme = useAppliedScheme();

  useEffect(() => {
    const bag: { map: { remove: () => void } | null; vector: { remove: () => void } | null; alive: boolean } = { map: null, vector: null, alive: true };
    const host = node.current;
    void import("leaflet").then(async (leaflet) => {
      if (!bag.alive || host === null) return;
      const instance = leaflet.map(host, { zoomControl: true, attributionControl: false }).setView(CENTER, 13);
      bag.map = instance;
      const icon = leaflet.divIcon({ className: "app-pin-marker", iconSize: [28, 36], iconAnchor: [14, 34], html: BRAND_PIN_HTML });
      let marker: { setLatLng: (point: [number, number]) => void } | null = null;
      let raster = false;
      const useRaster = () => {
        if (raster || !bag.alive) return;
        raster = true;
        bag.vector?.remove();
        bag.vector = null;
        leaflet.tileLayer(STANDARD_BASEMAP.url, { maxZoom: STANDARD_BASEMAP.maxZoom, attribution: "" }).addTo(instance);
      };
      try {
        const layer = await mountVectorBasemap(instance, OWN_BASEMAP, scheme, { onTrouble: useRaster });
        if (!bag.alive) {
          layer.remove();
          instance.remove();
          return;
        }
        bag.vector = layer;
      } catch {
        useRaster();
      }
      if (!bag.alive) return;
      instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
        if (marker === null) marker = leaflet.marker([event.latlng.lat, event.latlng.lng], { icon }).addTo(instance);
        else marker.setLatLng([event.latlng.lat, event.latlng.lng]);
      });
      window.setTimeout(() => instance.invalidateSize(), 60);
    });
    return () => {
      bag.alive = false;
      bag.vector?.remove();
      bag.map?.remove();
    };
  }, [scheme]);

  useEffect(() => {
    if (point === null) return;
    let alive = true;
    setLooking(true);
    void resolveAddress(point.lat, point.lng, places).then((line) => {
      if (!alive) return;
      setLooking(false);
      if (line !== null) setAddress((current) => (current.trim() === "" ? line : current));
    });
    return () => {
      alive = false;
    };
  }, [point, places]);

  const named = address.trim();

  return (
    <div className="app-pin" role="dialog" aria-label={title}>
      <button type="button" className="app-pin-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-pin-sheet">
        <div className="app-pin-head">
          <span>{title}</span>
          <button type="button" aria-label="Закрыть карту" onClick={onClose}>
            ×
          </button>
        </div>
        <div ref={node} className="app-pin-map" />
        <p className="app-pin-hint">{point === null ? "Нажмите на карту" : looking ? "Определяем адрес…" : "Можно поправить адрес"}</p>
        <input className="app-pin-address" aria-label="Адрес точки" placeholder="Улица, дом или место" value={address} onChange={(change) => setAddress(change.target.value)} />
        <button type="button" className="app-pin-confirm" disabled={point === null || named === ""} onClick={() => point !== null && named !== "" && onConfirm({ address: named, latitude: point.lat, longitude: point.lng })}>
          Это место
        </button>
      </div>
    </div>
  );
}
