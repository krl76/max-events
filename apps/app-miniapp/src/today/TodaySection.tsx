// START_MODULE_CONTRACT
// PURPOSE: "What to do today?" home block: digest summary counters and curated event cards with contextual typed labels.
// SCOPE: Data via apiClient.getToday (mock or live backend); label texts from the TodayCardLabel union; card click navigates to the event route; empty/loading/error states.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (TodayResponse, TodayCardLabel), ../catalog/CatalogPage.js (formatStartsAt, CATEGORY_LABELS), ../routing/router.js, ../ui/theme.css
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
import { useRoute } from "../routing/router";
import { AppTitle, AppState, AppSkeleton } from "../ui/primitives";

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
  if (state.status === "loading")
    return (
      <section className="app-today" aria-label="Что делать сегодня?">
        <AppTitle asChild>
          <h2 className="app-section-title">Что делать сегодня?</h2>
        </AppTitle>
        {[0, 1].map((row) => (
          <div key={row} className="app-card" aria-hidden="true">
            <div className="app-card-body">
              <AppSkeleton />
              <AppSkeleton variant="line-short" />
            </div>
          </div>
        ))}
      </section>
    );
  if (state.status === "error")
    return (
      <AppState error action={{ label: "Повторить", onClick: onRetry }}>
        Не удалось загрузить подборку.
      </AppState>
    );
  if (state.today.cards.length === 0) return <AppState>На сегодня пока ничего нет. Загляните позже!</AppState>;

  const { summary, cards } = state.today;
  return (
    <section className="app-today" aria-label="Что делать сегодня?">
      <AppTitle asChild>
        <h2 className="app-section-title">Что делать сегодня?</h2>
      </AppTitle>
      <p className="app-today-summary">
        {summary.nearbyCount} событий рядом, {summary.suitableCount} подходят тебе, на {summary.withFriendsCount} идут друзья
      </p>
      {cards.map(({ event, labels }) => (
        <button key={event.id} type="button" className="app-card app-card--link" onClick={() => onOpen(event.id)}>
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
    </section>
  );
}

export function TodaySection() {
  const { navigate } = useRoute();
  const [state, setState] = useState<TodayState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getToday().then(
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
  }, [attempt]);

  return <TodayView state={state} onOpen={(eventId) => navigate({ name: "event", id: eventId })} onRetry={() => setAttempt((n) => n + 1)} />;
}
