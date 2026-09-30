// START_MODULE_CONTRACT
// PURPOSE: Экран 16 «Карта» as a screen: the full-bleed event/place map (MapScreen) fed by the unfiltered event list, entered from Поиск.
// SCOPE: One-shot apiClient.listEvents({}) fetch + navigation wiring; map internals, chrome and the selection card live in MapScreen. The fetch never gates the canvas: while it runs and after it fails the map opens anyway, with an empty event list and a line saying so — «Карта» that answers with a full-screen error is the defect this screen was fixed for.
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js (useRoute), ./MapScreen.js (MapScreen)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapEventsState - union of the event list fetch states (loading / error / ready)
// - MapPageView - presentational shell: always the MapScreen, with the fetch state passed down as a hint
// - MapPage - container: fetches events once, wires back to Поиск and navigates to event/place pages from the map
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CityWalk, Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute, type MapTrail } from "../routing/router";
import { walkRouteLine, walkStopMarkers, walkTravelMinutes, type MapMarker } from "./mapMarkers";
import { MapScreen } from "./MapScreen";

export type MapEventsState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

const NO_EVENTS: Event[] = [];
const NO_WALK_MARKERS: MapMarker[] = [];

function defaultLoadEvents(): Promise<Event[]> {
  const requests = (["afisha", "tourism", "sport", "volunteering"] as const).map((category) => apiClient.listEvents({ category, limit: 100 }));
  return Promise.allSettled(requests).then((pages) => {
    const seen = new Set<string>();
    const events: Event[] = [];
    for (const page of pages) {
      if (page.status !== "fulfilled") continue;
      for (const event of page.value) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        events.push(event);
      }
    }
    if (events.length === 0 && pages.every((page) => page.status === "rejected")) {
      const first = pages[0];
      throw first.status === "rejected" ? first.reason : new Error("events failed");
    }
    return events;
  });
}

function defaultLoadWalk(id: string): Promise<CityWalk> {
  return apiClient.getCityWalk(id);
}

export function MapPageView({ state, onOpenEvent, onOpenPlace, onDiscuss, pin = null, focusPlaceId = null, drawRoute = false, walkMarkers = NO_WALK_MARKERS, walkPath = null, walkTitle = null, walkMinutes = null, walkFailed = false, focusPoint = null }: { state: MapEventsState; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void; onDiscuss?: () => void; pin?: { lat: number; lng: number } | null; focusPlaceId?: string | null; drawRoute?: boolean; walkMarkers?: readonly MapMarker[]; walkPath?: readonly [number, number][] | null; walkTitle?: string | null; walkMinutes?: number | null; walkFailed?: boolean; focusPoint?: { lat: number; lng: number } | null }) {
  return <MapScreen events={state.status === "ready" ? state.events : NO_EVENTS} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} onDiscuss={onDiscuss} eventsFailed={state.status === "error"} eventsLoading={state.status === "loading"} pin={pin} focusPlaceId={focusPlaceId} drawRoute={drawRoute} extraMarkers={walkMarkers} walkPath={walkPath} walkTitle={walkTitle} walkMinutes={walkMinutes} walkFailed={walkFailed} focusPoint={focusPoint} />;
}

export type MapPageProps = {
  readonly loadEvents?: () => Promise<Event[]>;
  readonly loadWalk?: (id: string) => Promise<CityWalk>;
  readonly walkId?: string | null;
  readonly trail?: MapTrail | null;
};

function trailStopMarkers(trail: MapTrail): MapMarker[] {
  return walkStopMarkers(
    trail.stops.map((stop, index) => ({
      order: index + 1,
      title: stop.title,
      address: "",
      latitude: stop.lat,
      longitude: stop.lng,
      placeId: stop.placeId ?? null,
    })),
  );
}

export function MapPage(props: MapPageProps = {}) {
  const { loadEvents = defaultLoadEvents, loadWalk = defaultLoadWalk, walkId: forcedWalkId, trail: forcedTrail } = props;
  const { route, navigate } = useRoute();
  const pin = route.name === "map" ? (route.pin ?? null) : null;
  const focusPlaceId = route.name === "map" ? (route.placeId ?? null) : null;
  const drawRoute = route.name === "map" && route.drawRoute === true;
  const routeWalkId = route.name === "map" ? (route.walkId ?? null) : null;
  const walkId = forcedWalkId === undefined ? routeWalkId : forcedWalkId;
  const routeTrail = route.name === "map" ? (route.trail ?? null) : null;
  const trail = forcedTrail === undefined ? routeTrail : forcedTrail;
  const [state, setState] = useState<MapEventsState>({ status: "loading" });
  const [walkMarkers, setWalkMarkers] = useState<readonly MapMarker[]>(NO_WALK_MARKERS);
  const [walkTitle, setWalkTitle] = useState<string | null>(null);
  const [walkMinutes, setWalkMinutes] = useState<number | null>(null);
  const [walkFailed, setWalkFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadEvents().then(
      (events) => {
        if (alive) setState({ status: "ready", events });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [loadEvents]);

  useEffect(() => {
    if (trail !== null) {
      setWalkMarkers(trailStopMarkers(trail));
      setWalkTitle(trail.title);
      setWalkMinutes(trail.minutes);
      setWalkFailed(false);
      return;
    }
    if (walkId === null) {
      setWalkMarkers(NO_WALK_MARKERS);
      setWalkTitle(null);
      setWalkMinutes(null);
      setWalkFailed(false);
      return;
    }
    let alive = true;
    loadWalk(walkId).then(
      (walk) => {
        if (!alive) return;
        setWalkMarkers(walkStopMarkers(walk.stops));
        setWalkTitle(walk.city);
        setWalkMinutes(walkTravelMinutes(walk));
        setWalkFailed(false);
      },
      () => {
        if (alive) setWalkFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [walkId, trail, loadWalk]);

  const walkPath = useMemo(() => {
    const line = walkRouteLine(walkMarkers);
    return line.length >= 2 ? line : null;
  }, [walkMarkers]);
  const focusPoint = useMemo(() => {
    const first = walkMarkers[0];
    return first === undefined ? null : { lat: first.lat, lng: first.lng };
  }, [walkMarkers]);
  const openEvent = useCallback((id: string) => navigate({ name: "event", id }), [navigate]);
  const openPlace = useCallback((id: string) => navigate({ name: "place", id }), [navigate]);
  return <MapPageView state={state} onOpenEvent={openEvent} onOpenPlace={openPlace} pin={pin} focusPlaceId={focusPlaceId} drawRoute={drawRoute} walkMarkers={walkMarkers} walkPath={walkPath} walkTitle={walkTitle} walkMinutes={walkMinutes} walkFailed={walkFailed} focusPoint={focusPoint} />;
}
