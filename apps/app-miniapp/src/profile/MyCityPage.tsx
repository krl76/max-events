// START_MODULE_CONTRACT
// PURPOSE: "My city" screen: personal history counters (places/events/districts) and the memory map of impression points.
// SCOPE: Data via apiClient.getMyCity + listEvents + listPlaces (mock or live); Leaflet loaded lazily (dynamic import) like the catalog map; point->marker mapping is pure.
// DEPENDS: ../api/client.js (apiClient, MyCityPayload), ../auth/AuthContext.js, ../catalog/format.js (formatStartsAt), ../catalog/MapScreen.js (MOSCOW_CENTER, MOSCOW_ZOOM, OSM_TILE_URL, OSM_ATTRIBUTION), ../catalog/useLeafletMap.js, ../routing/router.js, leaflet (dynamic import), @max-events/api-contracts (Event, MemoryPoint, MyCitySummary, Place), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MemoryMarker - one personal impression point ready for the map popup
// - memoryMarkers - memory points + events/places -> popup markers, unresolvable points skipped
// - initMemoryMap - create Leaflet map (Moscow center) + OSM tiles + memory point markers; returns a dispose function
// - MyCityState - union of the my-city fetch states (loading / error / ready)
// - MyCityView - presentational: summary counters row + memory map container
// - MyCityPage - route container: loads summary, points and title sources, wires the map
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, MemoryPoint, MyCitySummary, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { formatStartsAt } from "../catalog/format";
import { MOSCOW_CENTER, MOSCOW_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from "../catalog/MapScreen";
import { useLeafletMap } from "../catalog/useLeafletMap";
import { useAuth } from "../auth/AuthContext";
import { AppState } from "../ui/primitives";

export interface MemoryMarker {
  key: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export function memoryMarkers(points: MemoryPoint[], events: Event[], places: Place[]): MemoryMarker[] {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const placeById = new Map(places.map((place) => [place.id, place]));
  return points.flatMap((point) => {
    const source = point.eventId !== null ? eventById.get(point.eventId) : placeById.get(point.placeId!);
    if (source === undefined) return [];
    return [{ key: `${point.eventId ?? point.placeId}-${point.visitedAt}`, title: source.title, subtitle: formatStartsAt(point.visitedAt), lat: point.latitude, lng: point.longitude }];
  });
}

export async function initMemoryMap(container: HTMLElement, markers: MemoryMarker[]): Promise<() => void> {
  const L = await import("leaflet");
  const map = L.map(container, { center: MOSCOW_CENTER, zoom: MOSCOW_ZOOM });
  L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
  for (const marker of markers) {
    L.marker([marker.lat, marker.lng], { icon: L.divIcon({ className: "app-map-pin", iconSize: [18, 18] }) })
      .addTo(map)
      .bindPopup(`<strong>${marker.title}</strong><br>${marker.subtitle}`);
  }
  return () => map.remove();
}

export type MyCityState = { status: "loading" } | { status: "error" } | { status: "ready"; summary: MyCitySummary; markers: MemoryMarker[] };

export function MyCityView({ state }: { state: MyCityState }) {
  const markers = state.status === "ready" ? state.markers : [];
  const containerRef = useLeafletMap(state.status === "ready", (container) => initMemoryMap(container, markers), [state]);

  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить «Мой город».</AppState>;
  return (
    <section className="app-mycity">
      <div className="app-profile-stats app-mycity-summary">
        <span className="app-profile-stat">
          <span className="app-profile-stat-value">{state.summary.placesCount}</span>
          <span className="app-profile-stat-label">Места</span>
        </span>
        <span className="app-profile-stat">
          <span className="app-profile-stat-value">{state.summary.eventsCount}</span>
          <span className="app-profile-stat-label">События</span>
        </span>
        <span className="app-profile-stat">
          <span className="app-profile-stat-value">{state.summary.districtsCount}</span>
          <span className="app-profile-stat-label">Районы</span>
        </span>
      </div>
      <div ref={containerRef} className="app-map" aria-label="Карта личных впечатлений" />
    </section>
  );
}

export function MyCityPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<MyCityState>({ status: "loading" });
  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    Promise.all([apiClient.getMyCity(userId), apiClient.listEvents(), apiClient.listPlaces()]).then(
      ([payload, events, places]) => {
        if (alive) setState({ status: "ready", summary: payload.summary, markers: memoryMarkers(payload.points, events, places) });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);
  return <MyCityView state={state} />;
}
