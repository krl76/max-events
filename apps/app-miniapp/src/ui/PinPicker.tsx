import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { OWN_BASEMAP, STANDARD_BASEMAP } from "../catalog/basemaps";
import { mountVectorBasemap } from "../catalog/vectorBasemap";
import { useAppliedScheme } from "./theme";
import { pinLabel } from "./pin-label";

export { pinLabel, parsePinLabel } from "./pin-label";

const CENTER: [number, number] = [55.7522, 37.6156];
const BRAND_PIN_HTML = '<span class="app-pin-marker-drop"></span>';

/** A point on the map, not a row from the catalog. Confirm returns "55.75220, 37.61560". */
export function PinPicker({ title, onConfirm, onClose }: { title: string; onConfirm: (label: string) => void; onClose: () => void }) {
  const node = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<string | null>(null);
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
        const next = pinLabel(event.latlng.lat, event.latlng.lng);
        setLabel(next);
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
        <p className="app-pin-hint">{label === null ? "Нажмите на карту, чтобы поставить точку" : label}</p>
        <button type="button" className="app-pin-confirm" disabled={label === null} onClick={() => label !== null && onConfirm(label)}>
          Поставить точку
        </button>
      </div>
    </div>
  );
}
