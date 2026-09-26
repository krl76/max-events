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

import { useCallback, useEffect, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { MapScreen } from "./MapScreen";

export type MapEventsState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

const NO_EVENTS: Event[] = [];

export function MapPageView({ state, onOpenEvent, onOpenPlace, onBack, onDiscuss, pin = null, focusPlaceId = null }: { state: MapEventsState; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void; onBack?: () => void; onDiscuss?: () => void; pin?: { lat: number; lng: number } | null; focusPlaceId?: string | null }) {
  return <MapScreen events={state.status === "ready" ? state.events : NO_EVENTS} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} onBack={onBack} onDiscuss={onDiscuss} eventsFailed={state.status === "error"} eventsLoading={state.status === "loading"} pin={pin} focusPlaceId={focusPlaceId} />;
}

export function MapPage() {
  const { route, navigate, back } = useRoute();
  const pin = route.name === "map" ? (route.pin ?? null) : null;
  const focusPlaceId = route.name === "map" ? (route.placeId ?? null) : null;
  const [state, setState] = useState<MapEventsState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    apiClient.listEvents({}).then(
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
  }, []);

  const openEvent = useCallback((id: string) => navigate({ name: "event", id }), [navigate]);
  const openPlace = useCallback((id: string) => navigate({ name: "place", id }), [navigate]);
  // Обсуждение объекта начинается с плана: план несёт чат, отдельного чата у объекта на карте нет.
  const discuss = useCallback(() => navigate({ name: "plan-new" }), [navigate]);

  return <MapPageView state={state} onOpenEvent={openEvent} onOpenPlace={openPlace} onBack={back} onDiscuss={discuss} pin={pin} focusPlaceId={focusPlaceId} />;
}
