// START_MODULE_CONTRACT
// PURPOSE: Catalog map view: Leaflet map with OSM tiles, event/place markers, the optional «друзья были здесь» layer, and popup mini-cards with navigation to the event and place pages.
// SCOPE: Places fetched via apiClient.listPlaces; the friends layer is fetched only when it is switched on, and a failure switches it back off instead of breaking the map; Leaflet loaded lazily (dynamic import) so it stays out of the main bundle; map is disposed on unmount or data change.
// DEPENDS: leaflet (dynamic import + css), ../api/client.js (apiClient), ./mapMarkers.js (buildMapMarkers, MapMarker), ../ui/primitives.js (AppChip, AppState)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOSCOW_CENTER - fixed Moscow city center coords (shared with the nearby screen)
// - MOSCOW_ZOOM - shared Leaflet initial zoom (imported by the MyCity map)
// - OSM_TILE_URL - shared OpenStreetMap tile URL (imported by the MyCity map)
// - initEventMap - create Leaflet map (Moscow center) + OSM tile layer without the attribution bar + markers with popup mini-cards (promoted events get the highlighted pin and the «Промо» chip, #205; the friends layer gets its own pin and a «Были: …» subtitle, #472); returns a dispose function
// - MapScreen - places loading state, the friends-layer toggle and container ref; wires initEventMap to the React lifecycle via useLeafletMap
// END_MODULE_MAP

import { useEffect, useMemo, useState } from "react";
import type { Event, FriendPlaceVisit, Place } from "@max-events/api-contracts";
import "leaflet/dist/leaflet.css";
import { apiClient } from "../api/client";
import { buildMapMarkers, type MapMarker } from "./mapMarkers";
import { useLeafletMap } from "./useLeafletMap";
import { AppChip, AppState } from "../ui/primitives";

/** Fixtures and P0 scope are Moscow-only, so the map opens on the city center; also the anchor point of the nearby screen. */
export const MOSCOW_CENTER: [number, number] = [55.7522, 37.6156];
export const MOSCOW_ZOOM = 11;
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function popupNode(marker: MapMarker, onOpenEvent: (id: string) => void, onOpenPlace: (id: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "app-map-popup";
  if (marker.promoted) {
    const chip = document.createElement("span");
    chip.className = "app-today-chip";
    chip.textContent = "Промо";
    root.append(chip);
  }
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

export async function initEventMap(container: HTMLElement, input: { events: Event[]; places: Place[]; friendVisits?: FriendPlaceVisit[]; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void }): Promise<() => void> {
  const L = await import("leaflet");
  const map = L.map(container, { center: MOSCOW_CENTER, zoom: MOSCOW_ZOOM, attributionControl: false });
  L.tileLayer(OSM_TILE_URL, { maxZoom: 19 }).addTo(map);
  for (const marker of buildMapMarkers(input.events, input.places, input.friendVisits ?? [])) {
    L.marker([marker.lat, marker.lng], { icon: L.divIcon({ className: `app-map-pin${marker.promoted ? " app-map-pin--promo" : ""}${marker.friends ? " app-map-pin--friends" : ""}`, iconSize: [18, 18] }) })
      .addTo(map)
      .bindPopup(popupNode(marker, input.onOpenEvent, input.onOpenPlace));
  }
  return () => map.remove();
}

const EMPTY_VISITS: FriendPlaceVisit[] = [];

type PlacesState = { status: "loading" } | { status: "error" } | { status: "ready"; places: Place[] };

export function MapScreen({ events, onOpenEvent, onOpenPlace }: { events: Event[]; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void }) {
  const [places, setPlaces] = useState<PlacesState>({ status: "loading" });
  const [friendsLayer, setFriendsLayer] = useState(false);
  const [friendVisits, setFriendVisits] = useState<FriendPlaceVisit[]>([]);

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
    if (!friendsLayer) return;
    let alive = true;
    apiClient.listFriendPlaces().then(
      (visits) => {
        if (alive) setFriendVisits(visits);
      },
      () => {
        // The layer is an extra, not the map: a failed load turns it back off rather than taking the screen down.
        if (alive) setFriendsLayer(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [friendsLayer]);

  const readyPlaces = places.status === "ready" ? places.places : [];
  // A fresh [] on every render would land in the map's dependency list and rebuild Leaflet each time.
  const visits = useMemo(() => (friendsLayer ? friendVisits : EMPTY_VISITS), [friendsLayer, friendVisits]);
  const containerRef = useLeafletMap(places.status === "ready", (container) => initEventMap(container, { events, places: readyPlaces, friendVisits: visits, onOpenEvent, onOpenPlace }), [events, places, visits, onOpenEvent, onOpenPlace]);

  if (places.status === "loading") return <AppState>Загружаем карту…</AppState>;
  if (places.status === "error") return <AppState error>Не удалось загрузить места для карты.</AppState>;
  return (
    <div className="app-map-wrap">
      <div className="app-map-layers">
        <AppChip pressed={friendsLayer} onClick={() => setFriendsLayer((current) => !current)}>
          Друзья были здесь
        </AppChip>
      </div>
      <div ref={containerRef} className="app-map" aria-label="Карта событий и мест" />
    </div>
  );
}
