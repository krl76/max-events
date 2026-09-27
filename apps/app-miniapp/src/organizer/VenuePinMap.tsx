// START_MODULE_CONTRACT
// PURPOSE: Small pin map for the organizer venue form: the project's own vector basemap, a tap sets the point.
// SCOPE: One Leaflet map. It never loads the OpenStreetMap raster tiles; if the own basemap cannot mount, the form says so.
// DEPENDS: leaflet (dynamic), ../catalog/basemaps.js (OWN_BASEMAP), ../catalog/vectorBasemap.js, ../ui/theme.js, leaflet css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { OWN_BASEMAP } from "../catalog/basemaps";
import { mountVectorBasemap } from "../catalog/vectorBasemap";
import { useAppliedScheme } from "../ui/theme";

export function VenuePinMap({ latitude, longitude, onPick }: { latitude: number; longitude: number; onPick: (latitude: number, longitude: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  const pointRef = useRef({ latitude, longitude });
  const scheme = useAppliedScheme();
  const [trouble, setTrouble] = useState(false);
  onPickRef.current = onPick;
  pointRef.current = { latitude, longitude };

  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    let alive = true;
    let removeLayer: (() => void) | null = null;
    const start = pointRef.current;
    void import("leaflet").then(async (leaflet) => {
      if (!alive || host.current === null) return;
      const L = leaflet;
      const map = L.map(host.current, { zoomControl: false, attributionControl: true }).setView([start.latitude, start.longitude], 13);
      mapRef.current = map;
      try {
        const layer = await mountVectorBasemap(map, OWN_BASEMAP, scheme, { onTrouble: () => alive && setTrouble(true) });
        removeLayer = () => layer.remove();
      } catch {
        if (alive) setTrouble(true);
        return;
      }
      if (!alive) return;
      const here = pointRef.current;
      markerRef.current = L.circleMarker([here.latitude, here.longitude], { radius: 9, color: "#ffffff", weight: 2, fillColor: "#471aff", fillOpacity: 1 }).addTo(map);
      map.on("click", (event) => {
        markerRef.current?.setLatLng(event.latlng);
        onPickRef.current(event.latlng.lat, event.latlng.lng);
      });
      window.setTimeout(() => map.invalidateSize(), 0);
    });
    return () => {
      alive = false;
      removeLayer?.();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [scheme]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map === null || marker === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    marker.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div className="app-org-pinmap">
      <div ref={host} className="app-org-pinmap-canvas" aria-label="Карта площадки" />
      {trouble && <p className="app-org-pinmap-note">Своя карта здесь не открылась. Адрес можно вписать вручную.</p>}
      {!trouble && <p className="app-org-pinmap-note">Нажмите на карту, чтобы поставить точку. Подложка — своя, Москва и область.</p>}
    </div>
  );
}
