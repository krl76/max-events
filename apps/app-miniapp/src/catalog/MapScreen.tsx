// START_MODULE_CONTRACT
// PURPOSE: Catalog map view: Leaflet map with OSM tiles, event/place markers and popup mini-cards with navigation to the event and place pages.
// SCOPE: Places fetched via apiClient.listPlaces; Leaflet loaded lazily (dynamic import) so it stays out of the main bundle; map is disposed on unmount or data change.
// DEPENDS: leaflet (dynamic import + css), ../api/client.js (apiClient), ./mapMarkers.js (buildMapMarkers, MapMarker)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOSCOW_CENTER - fixed Moscow city center coords (shared with the nearby screen)
// - initEventMap - create Leaflet map (Moscow center) + OSM tile layer with the required attribution + markers with popup mini-cards; returns a dispose function
// - MapScreen - places loading state + container ref; wires initEventMap to the React lifecycle
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import type { Event, Place } from "@max-events/api-contracts";
import "leaflet/dist/leaflet.css";
import { apiClient } from "../api/client";
import { buildMapMarkers, type MapMarker } from "./mapMarkers";

/** Fixtures and P0 scope are Moscow-only, so the map opens on the city center; also the anchor point of the nearby screen. */
export const MOSCOW_CENTER: [number, number] = [55.7522, 37.6156];
const MOSCOW_ZOOM = 11;
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function popupNode(marker: MapMarker, onOpenEvent: (id: string) => void, onOpenPlace: (id: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "app-map-popup";
  const title = document.createElement("span");
  title.className = "app-map-popup-title";
  title.textContent = marker.title;
  const subtitle = document.createElement("span");
  subtitle.className = "app-map-popup-subtitle";
  subtitle.textContent = marker.subtitle;
  root.append(title, subtitle);
  if (marker.eventId !== null) {
    const eventId = marker.eventId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-map-popup-open";
    button.textContent = "Открыть";
    button.addEventListener("click", () => onOpenEvent(eventId));
    root.append(button);
  } else if (marker.placeId !== null) {
    const placeId = marker.placeId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-map-popup-open";
    button.textContent = "Открыть место";
    button.addEventListener("click", () => onOpenPlace(placeId));
    root.append(button);
  }
  return root;
}

export async function initEventMap(container: HTMLElement, input: { events: Event[]; places: Place[]; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void }): Promise<() => void> {
  const L = await import("leaflet");
  const map = L.map(container, { center: MOSCOW_CENTER, zoom: MOSCOW_ZOOM });
  L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
  for (const marker of buildMapMarkers(input.events, input.places)) {
    L.marker([marker.lat, marker.lng], { icon: L.divIcon({ className: "app-map-pin", iconSize: [18, 18] }) })
      .addTo(map)
      .bindPopup(popupNode(marker, input.onOpenEvent, input.onOpenPlace));
  }
  return () => map.remove();
}

type PlacesState = { status: "loading" } | { status: "error" } | { status: "ready"; places: Place[] };

export function MapScreen({ events, onOpenEvent, onOpenPlace }: { events: Event[]; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [places, setPlaces] = useState<PlacesState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    apiClient.listPlaces().then(
      (data) => {
        if (alive) setPlaces({ status: "ready", places: data });
      },
      () => {
        if (alive) setPlaces({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (places.status !== "ready" || containerRef.current === null) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    initEventMap(containerRef.current, { events, places: places.places, onOpenEvent, onOpenPlace }).then((created) => {
      if (disposed) created();
      else dispose = created;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [events, places, onOpenEvent, onOpenPlace]);

  if (places.status === "loading") return <p className="app-state">Загружаем карту…</p>;
  if (places.status === "error") return <p className="app-state app-state--error">Не удалось загрузить места для карты.</p>;
  return <div ref={containerRef} className="app-map" aria-label="Карта событий и мест" />;
}
