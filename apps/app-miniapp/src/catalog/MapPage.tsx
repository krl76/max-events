// START_MODULE_CONTRACT
// PURPOSE: Экран 16 «Карта» as a screen: the full-bleed event/place map (MapScreen) fed by the unfiltered event list, entered from Поиск.
// SCOPE: One-shot apiClient.listEvents({}) fetch + navigation wiring; map internals, chrome and the selection card live in MapScreen.
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js (useRoute), ./MapScreen.js (MapScreen), ../ui/primitives.js (AppState)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapEventsState - union of the event list fetch states (loading / error / ready)
// - MapPageView - presentational switch: loading/error AppState or the MapScreen
// - MapPage - container: fetches events once, wires back to Поиск and navigates to event/place pages from the map
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { AppState } from "../ui/primitives";
import { MapScreen } from "./MapScreen";

export type MapEventsState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

export function MapPageView({ state, onOpenEvent, onOpenPlace, onBack, onDiscuss }: { state: MapEventsState; onOpenEvent: (id: string) => void; onOpenPlace: (id: string) => void; onBack?: () => void; onDiscuss?: () => void }) {
  if (state.status === "loading") return <AppState>Загружаем события для карты…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить события для карты.</AppState>;
  return <MapScreen events={state.events} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} onBack={onBack} onDiscuss={onDiscuss} />;
}

export function MapPage() {
  const { navigate, back } = useRoute();
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

  return <MapPageView state={state} onOpenEvent={openEvent} onOpenPlace={openPlace} onBack={back} onDiscuss={discuss} />;
}
