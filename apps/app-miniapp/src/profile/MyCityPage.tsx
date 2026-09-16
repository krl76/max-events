// START_MODULE_CONTRACT
// PURPOSE: "My city" screen: personal history counters (places/events/districts) and the memory map of impression points.
// SCOPE: Data via apiClient.getMyCity + listEvents + listPlaces (mock or live); Leaflet loaded lazily (dynamic import) like the catalog map; point->marker mapping is pure.
// DEPENDS: ../api/client.js (apiClient, MyCityPayload), ../auth/AuthContext.js, ../catalog/format.js (formatStartsAt), ../event/EventPage.js (DEMO_USER_ID), ../routing/router.js, leaflet (dynamic import), @max-events/api-contracts (Event, MemoryPoint, MyCitySummary, Place), ../ui/theme.css
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
// - MyCityLink - profile entry button to the my-city screen
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import type { Event, MemoryPoint, MyCitySummary, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { formatStartsAt } from "../catalog/format";
import { useAuth } from "../auth/AuthContext";
import { DEMO_USER_ID } from "../event/EventPage";
import { useRoute } from "../routing/router";

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

const MOSCOW_CENTER: [number, number] = [55.7522, 37.6156];
const MOSCOW_ZOOM = 11;
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || containerRef.current === null) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    initMemoryMap(containerRef.current, state.markers).then((created) => {
      if (disposed) created();
      else dispose = created;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [state]);

  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить «Мой город».</p>;
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
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const [state, setState] = useState<MyCityState>({ status: "loading" });
  useEffect(() => {
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

export function MyCityLink() {
  const { navigate } = useRoute();
  return (
    <button type="button" className="app-lists-link" onClick={() => navigate({ name: "my-city" })}>
      Мой город
    </button>
  );
}
