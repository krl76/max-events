// START_MODULE_CONTRACT
// PURPOSE: Экран 27 «Друзья открыли»: how many places friends have been to and the viewer has not, per friend, with «История посещений скрыта» drawn as a normal state rather than an error.
// SCOPE: Data via apiClient.getDiscovery (mock or live); a friend row opens their route (экран 28), a place chip opens экран 34; loading/error/empty states. Privacy is backend-driven: a friend who hid their routes keeps the counter and loses the chips, a friend who hid the visit history keeps neither.
// DEPENDS: ../api/client.js (apiClient, DiscoveryFriendCard, DiscoveryScreen), ../friends/avatar.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - discoveryHeadline - «мест, где были твои друзья, а ты ещё нет» agreed with the number above it
// - friendPlacesLine - «7 новых для тебя мест» under a friend name
// - DiscoveryState - summary fetch union (loading / error / ready)
// - DiscoveryFriendRow - one friend card: face, name, the line under it and either place chips or the lock
// - DiscoveryView - presentational экран 27: gradient counter, friend cards, the privacy footnote
// - DiscoveryPage - route container: loads the summary, wires the route and place navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type DiscoveryFriendCard, type DiscoveryScreen } from "../api/client";
import { PersonAvatar } from "../friends/avatar";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";

/** The number lives in the hero on its own line, so the words under it agree with it and nothing else. */
export function discoveryHeadline(count: number): string {
  return `${pluralRu(count, "место", "места", "мест")}, где были твои друзья, а ты ещё нет`;
}

export function friendPlacesLine(count: number): string {
  return `${count} ${pluralRu(count, "новое для тебя место", "новых для тебя места", "новых для тебя мест")}`;
}

/** The design previews four venues under a name; the counter above carries the rest. */
const MAX_PLACE_CHIPS = 4;

export type DiscoveryState = { status: "loading" } | { status: "error" } | { status: "ready"; data: DiscoveryScreen };

export function DiscoveryFriendRow({ entry, onShowRoute, onOpenPlace }: { entry: DiscoveryFriendCard; onShowRoute: (userId: string) => void; onOpenPlace: (placeId: string) => void }) {
  return (
    <article className="app-disco-card">
      <div className="app-disco-head">
        <PersonAvatar id={entry.friend.id} name={entry.friend.name} size={40} />
        <div className="app-disco-person">
          <span className="app-disco-name">{entry.friend.name}</span>
          <span className="app-disco-line">{entry.visitHistoryHidden ? "История посещений скрыта" : friendPlacesLine(entry.newPlacesCount)}</span>
        </div>
        {entry.visitHistoryHidden ? (
          <span className="app-disco-lock" aria-hidden="true">
            <ActionIcon name="lock" size={20} strokeWidth={2.2} />
          </span>
        ) : (
          <button type="button" className="app-disco-route" onClick={() => onShowRoute(entry.friend.id)}>
            Маршрут
          </button>
        )}
      </div>
      {entry.places.length > 0 && (
        <div className="app-disco-chips">
          {entry.places.slice(0, MAX_PLACE_CHIPS).map((place) => (
            <button key={place.id} type="button" className="app-disco-chip" onClick={() => onOpenPlace(place.id)}>
              {place.title}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

interface DiscoveryViewProps {
  state: DiscoveryState;
  onShowRoute: (userId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onRetry: () => void;
}

export function DiscoveryView({ state, onShowRoute, onOpenPlace, onRetry }: DiscoveryViewProps) {
  return (
    <section className="app-disco">
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить открытия друзей.
        </AppState>
      )}
      {state.status === "ready" && (
        <>
          {/* Градиент — герой-карточка с коротким текстом: длинного текста на нём не бывает. */}
          <div className="app-disco-hero">
            <span className="app-disco-hero-count">{state.data.newPlacesCount}</span>
            <span className="app-disco-hero-text">{discoveryHeadline(state.data.newPlacesCount)}</span>
          </div>
          {state.data.byFriend.length === 0 && <AppState>Пока ничего нового — друзья ещё не открыли мест, где ты не был.</AppState>}
          {state.data.byFriend.map((entry) => (
            <DiscoveryFriendRow key={entry.friend.id} entry={entry} onShowRoute={onShowRoute} onOpenPlace={onOpenPlace} />
          ))}
          <p className="app-disco-note">Каждый решает сам, показывать ли свои места. Если история скрыта, мы не показываем ни счётчик, ни маршруты.</p>
        </>
      )}
    </section>
  );
}

export function DiscoveryPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<DiscoveryState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.getDiscovery().then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return <DiscoveryView state={state} onShowRoute={(id) => navigate({ name: "friend-route", id })} onOpenPlace={(id) => navigate({ name: "place", id })} onRetry={load} />;
}
