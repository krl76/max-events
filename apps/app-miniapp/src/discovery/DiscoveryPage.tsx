// START_MODULE_CONTRACT
// PURPOSE: Reverse discovery screen (#189) «Твои люди открыли N мест»: per-friend cards of places the viewer has not visited, expandable place lists and a «Посмотреть маршрут» friend timeline.
// SCOPE: Data via apiClient.getDiscovery/getFriendRoute (mock or live); route timeline local state; CTAs navigate to the place route; loading/error/empty states. Privacy is backend-driven: friends with hidden routes show only counts, without place lists and route CTAs.
// DEPENDS: ../api/client.js (apiClient, ApiError), @max-events/api-contracts (DiscoveryFriendPlaces, DiscoveryResponse, FriendRoute), ../friends/FriendsPage.js (initials), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - placesLabel - ru plural of «новое место» for the discovery counters
// - DiscoveryState - summary fetch union (loading / error / ready)
// - RouteState - friend route union (idle / loading / error / ready)
// - routeErrorMessage - ApiError 403 -> hidden-route text, otherwise the fallback
// - DiscoveryView - presentational: summary line, friend cards with expandable place lists, route timeline
// - DiscoveryPage - route container: loads the summary, wires route loading and place navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { DiscoveryFriendPlaces, DiscoveryResponse, FriendRoute } from "@max-events/api-contracts";
import { ApiError, apiClient } from "../api/client";
import { initials } from "../friends/FriendsPage";
import { useRoute } from "../routing/router";
import { AppAvatar, AppButton, AppTitle, AppState } from "../ui/primitives";

export function placesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} новое место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} новых места`;
  return `${count} новых мест`;
}

export type DiscoveryState = { status: "loading" } | { status: "error" } | { status: "ready"; data: DiscoveryResponse };

export type RouteState = { status: "idle" } | { status: "loading"; friendId: string } | { status: "error"; friendId: string; message: string } | { status: "ready"; friendId: string; route: FriendRoute };

export function routeErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "Друг скрыл свой маршрут.";
  return "Не удалось загрузить маршрут.";
}

function PlaceRow({ placeId, title, subtitle, onOpenPlace }: { placeId: string; title: string; subtitle: string | null; onOpenPlace: (id: string) => void }) {
  return (
    <li className="app-nearby-stop">
      <span aria-hidden>📍</span>
      <span className="app-nearby-stop-title">
        {title}
        {subtitle === null ? "" : ` · ${subtitle}`}
      </span>
      <button type="button" className="app-nearby-stop-open" onClick={() => onOpenPlace(placeId)}>
        Открыть
      </button>
    </li>
  );
}

interface FriendDiscoveryCardProps {
  entry: DiscoveryFriendPlaces;
  route: RouteState;
  onShowRoute: (friendId: string) => void;
  onOpenPlace: (placeId: string) => void;
}

function FriendDiscoveryCard({ entry, route, onShowRoute, onOpenPlace }: FriendDiscoveryCardProps) {
  const firstName = entry.friend.name.split(" ")[0];
  const routeMine = route.status !== "idle" && route.friendId === entry.friend.id;
  return (
    <section className="app-friends-group">
      <div className="app-friends-person">
        <AppAvatar size={44}>{initials(entry.friend.name)}</AppAvatar>
        <span className="app-friends-name">{entry.friend.name}</span>
      </div>
      <p className="app-today-summary">
        {firstName}: {placesLabel(entry.newPlacesCount)}
      </p>
      {entry.places.length > 0 && (
        <details className="app-card app-nearby-option">
          <summary className="app-card-body">
            <span className="app-card-title">
              Где побывал{/[ая]$/.test(firstName) ? "а" : ""} {firstName}
            </span>
          </summary>
          <ol className="app-nearby-stops">
            {entry.places.map((place) => (
              <PlaceRow key={place.id} placeId={place.id} title={place.title} subtitle={place.address} onOpenPlace={onOpenPlace} />
            ))}
          </ol>
        </details>
      )}
      {entry.places.length > 0 && (
        <AppButton tone="secondary" size="small" disabled={route.status === "loading" && route.friendId === entry.friend.id} onClick={() => onShowRoute(entry.friend.id)}>
          Посмотреть маршрут
        </AppButton>
      )}
      {routeMine && route.status === "loading" && <AppState>Загружаем маршрут…</AppState>}
      {routeMine && route.status === "error" && <AppState error>{route.message}</AppState>}
      {routeMine && route.status === "ready" && route.route.places.length === 0 && <AppState>Все места из маршрута ты уже видел.</AppState>}
      {routeMine && route.status === "ready" && route.route.places.length > 0 && (
        <ol className="app-nearby-stops" aria-label={`Маршрут: ${entry.friend.name}`}>
          {route.route.places.map((place) => (
            <PlaceRow key={place.id} placeId={place.id} title={place.title} subtitle={place.address} onOpenPlace={onOpenPlace} />
          ))}
        </ol>
      )}
    </section>
  );
}

interface DiscoveryViewProps {
  state: DiscoveryState;
  route: RouteState;
  onShowRoute: (friendId: string) => void;
  onOpenPlace: (placeId: string) => void;
}

export function DiscoveryView({ state, route, onShowRoute, onOpenPlace }: DiscoveryViewProps) {
  return (
    <>
      <AppTitle asChild>
        <h2 className="app-section-title">Открытия твоих людей</h2>
      </AppTitle>
      {state.status === "loading" && <AppState>Загружаем открытия…</AppState>}
      {state.status === "error" && <AppState error>Не удалось загрузить открытия друзей.</AppState>}
      {state.status === "ready" && state.data.byFriend.length === 0 && <AppState>Пока ничего нового — друзья ещё не открыли мест, где ты не был.</AppState>}
      {state.status === "ready" && state.data.byFriend.length > 0 && (
        <>
          <p className="app-today-summary">Твои люди открыли {placesLabel(state.data.newPlacesCount)}</p>
          {state.data.byFriend.map((entry) => (
            <FriendDiscoveryCard key={entry.friend.id} entry={entry} route={route} onShowRoute={onShowRoute} onOpenPlace={onOpenPlace} />
          ))}
        </>
      )}
    </>
  );
}

export function DiscoveryPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<DiscoveryState>({ status: "loading" });
  const [route, setRoute] = useState<RouteState>({ status: "idle" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getDiscovery().then(
      (data) => {
        if (alive) setState({ status: "ready", data });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const showRoute = (friendId: string) => {
    setRoute({ status: "loading", friendId });
    apiClient.getFriendRoute(friendId).then(
      (data) => setRoute({ status: "ready", friendId, route: data }),
      (error: unknown) => setRoute({ status: "error", friendId, message: routeErrorMessage(error) }),
    );
  };

  return <DiscoveryView state={state} route={route} onShowRoute={showRoute} onOpenPlace={(id) => navigate({ name: "place", id })} />;
}
