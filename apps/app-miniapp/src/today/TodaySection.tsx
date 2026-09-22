// START_MODULE_CONTRACT
// PURPOSE: "What to do today?" home block: digest summary counters and curated event cards with contextual typed labels.
// SCOPE: Data via apiClient.getToday at useViewerOrigin; label texts from the TodayCardLabel union; card click navigates to the event route; empty/loading/error states.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (TodayResponse, TodayCardLabel), ../catalog/CatalogPage.js (formatStartsAt, CATEGORY_LABELS), ../geo/viewer-origin.js, ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TodayState - union of today digest fetch states (loading / error / ready)
// - todayLabel - TodayCardLabel -> ru text ("15 минут от тебя", "Идет Анна", "Свободный вход", "Осталось 12 мест")
// - TodayView - presentational: heading, summary line, labelled cards, empty state
// - TodaySection - home container: loads the digest and wires card navigation to the event route
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { TodayCardLabel, TodayResponse } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { useViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { AppState, AppSkeleton, AppSection, AppMedia } from "../ui/primitives";

export type TodayState = { status: "loading" } | { status: "error" } | { status: "ready"; today: TodayResponse };

export function todayLabel(label: TodayCardLabel): string {
  if (label.kind === "distance") return `${label.minutes} минут от тебя`;
  if (label.kind === "friend_attending") return `Идет ${label.friendName}`;
  if (label.kind === "free_entry") return "Свободный вход";
  if (label.kind === "after_me") return `После ${label.afterCount} посещений — тебе зайдёт`;
  return `Осталось ${label.count} мест`;
}

interface TodayViewProps {
  state: TodayState;
  onOpen: (eventId: string) => void;
  onRetry: () => void;
}

export function TodayView({ state, onOpen, onRetry }: TodayViewProps) {
  return (
    <AppSection title="Что делать сегодня?" className="app-cards-flat">
      {state.status === "loading" ? (
        [0, 1].map((row) => (
          <div key={row} className="app-card" aria-hidden="true">
            <div className="app-card-body">
              <AppSkeleton />
              <AppSkeleton variant="line-short" />
            </div>
          </div>
        ))
      ) : state.status === "error" ? (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить подборку.
        </AppState>
      ) : state.today.cards.length === 0 ? (
        <AppState>На сегодня пока ничего нет. Загляните позже!</AppState>
      ) : (
        <>
          <p className="app-today-summary">
            {state.today.summary.nearbyCount} событий рядом, {state.today.summary.suitableCount} подходят тебе, на {state.today.summary.withFriendsCount} идут друзья
          </p>
          {state.today.cards.map(({ event, labels }) => (
            <button key={event.id} type="button" className="app-card app-card--link" onClick={() => onOpen(event.id)}>
              <AppMedia category={event.category} />
              <div className="app-card-body">
                <span className="app-card-title">{event.title}</span>
                <span className="app-card-subtitle">
                  {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
                </span>
                <span className="app-today-labels">
                  {labels.map((label, index) => (
                    <span key={index} className="app-today-chip">
                      {todayLabel(label)}
                    </span>
                  ))}
                </span>
              </div>
            </button>
          ))}
        </>
      )}
    </AppSection>
  );
}

export function TodaySection() {
  const { navigate } = useRoute();
  const origin = useViewerOrigin();
  const [state, setState] = useState<TodayState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getToday({ latitude: origin.latitude, longitude: origin.longitude }).then(
      (today) => {
        if (alive) setState({ status: "ready", today });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt, origin.latitude, origin.longitude]);

  return <TodayView state={state} onOpen={(eventId) => navigate({ name: "event", id: eventId })} onRetry={() => setAttempt((n) => n + 1)} />;
}
