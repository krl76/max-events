import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const CENTER: [number, number] = [55.7522, 37.6156];

export function pinLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** A point on the map, not a row from the catalog. Confirm returns "55.75220, 37.61560". */
export function PinPicker({ title, onConfirm, onClose }: { title: string; onConfirm: (label: string) => void; onClose: () => void }) {
  const node = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let alive = true;
    void import("leaflet").then((leaflet) => {
      if (!alive || node.current === null) return;
      const instance = leaflet.map(node.current).setView(CENTER, 13);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(instance);
      let marker: { setLatLng: (point: [number, number]) => void } | null = null;
      instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        const next = pinLabel(event.latlng.lat, event.latlng.lng);
        setLabel(next);
        if (marker === null) marker = leaflet.marker([event.latlng.lat, event.latlng.lng]).addTo(instance);
        else marker.setLatLng([event.latlng.lat, event.latlng.lng]);
      });
      map = instance;
      window.setTimeout(() => instance.invalidateSize(), 0);
    });
    return () => {
      alive = false;
      map?.remove();
    };
  }, []);

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
