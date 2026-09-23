// START_MODULE_CONTRACT
// PURPOSE: Экран 28 «Маршрут друга»: the ordered stops of one friend's day and the «доступ закрыт» state when they keep their routes to themselves.
// SCOPE: Data via apiClient.getFriendRoute (mock or live) plus apiClient.listFriends for the name behind a closed route; a stop opens экран 34, «Повторить маршрут как план» opens the plan builder, the closed state offers to invite the friend to an event instead. 403 is a state of this screen, not an error of it.
// DEPENDS: ../api/client.js (ApiError, apiClient, FriendRouteScreen), @max-events/api-contracts (Friend), ../friends/avatar.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - firstName - "Анна Кравцова" -> "Анна"
// - genitiveName - "Анна" -> "Анны" for the «Маршрут Анны» title
// - accusativeName - "Олег" -> "Олега", "Анна" -> "Анну" for «Позвать … на событие»
// - routeDayLabel - «Суббота, 13 сентября» from the first stop, null when the stops carry no clock
// - routeStopMeta - «11:20 · завтрак» of one stop, «11:20» or the note alone when only one of them is known
// - routeStopsLine - «Суббота, 13 сентября · 4 места» under the friend name
// - FriendRouteState - route fetch union (loading / closed / error / ready)
// - FriendRouteView - presentational экран 28: topbar, friend row, the numbered timeline, the plan CTA, the closed-access card
// - FriendRoutePage - route container: loads the route, maps 403 to the closed state, wires navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { ApiError, apiClient, type FriendRouteScreen } from "../api/client";
import { PersonAvatar } from "../friends/avatar";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";

export function firstName(name: string): string {
  return name.trim().split(" ")[0] ?? name;
}

/**
 * «Маршрут Анны», «Маршрут Олега» — the title of the design declines the name. Russian genitive of a
 * first name is regular enough to write down: -ия -> -ии, -а -> -ы (-и after a hushing or velar stem),
 * -я -> -и, -й/-ь -> -я, otherwise a consonant takes -а. A name the rules do not fit stays as it is,
 * which reads as a slightly stiff title and never as a wrong word.
 */
export function genitiveName(name: string): string {
  const word = firstName(name);
  if (word.length < 3) return word;
  const last = word.slice(-1).toLowerCase();
  const stem = word.slice(0, -1);
  const beforeLast = stem.slice(-1).toLowerCase();
  if (word.toLowerCase().endsWith("ия")) return `${word.slice(0, -1)}и`;
  if (last === "а") return `${stem}${"гкхжчшщ".includes(beforeLast) ? "и" : "ы"}`;
  if (last === "я") return `${stem}и`;
  if (last === "й" || last === "ь") return `${stem}я`;
  if ("бвгдежзклмнпрстфхцчшщ".includes(last)) return `${word}а`;
  return word;
}

/** «Позвать Олега», «Позвать Анну»: for an animate masculine name the accusative copies the genitive, a feminine one takes -у/-ю. */
export function accusativeName(name: string): string {
  const word = firstName(name);
  if (word.length < 3) return word;
  const last = word.slice(-1).toLowerCase();
  if (last === "а") return `${word.slice(0, -1)}у`;
  if (last === "я") return `${word.slice(0, -1)}ю`;
  return genitiveName(word);
}

export function routeDayLabel(visitedAt: string | null): string | null {
  if (visitedAt === null) return null;
  const day = new Date(visitedAt);
  if (Number.isNaN(day.getTime())) return null;
  const weekday = day.toLocaleDateString("ru-RU", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

export function routeStopMeta(visitedAt: string | null, note: string | null): string | null {
  const time = visitedAt === null ? null : new Date(visitedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return [time, note].filter((part): part is string => part !== null && part !== "").join(" · ") || null;
}

export function routeStopsLine(route: FriendRouteScreen): string {
  const count = `${route.stops.length} ${pluralRu(route.stops.length, "место", "места", "мест")}`;
  const day = routeDayLabel(route.stops[0]?.visitedAt ?? null);
  return day === null ? count : `${day} · ${count}`;
}

export type FriendRouteState = { status: "loading" } | { status: "closed" } | { status: "error" } | { status: "ready"; route: FriendRouteScreen };

interface FriendRouteViewProps {
  state: FriendRouteState;
  /** The name is needed even when the route is closed — that state is about a person, not about an id. */
  friend: Friend | null;
  onBack: () => void;
  onOpenPlace: (placeId: string) => void;
  onRepeatAsPlan: () => void;
  onInvite: () => void;
  onRetry: () => void;
}

export function FriendRouteView({ state, friend, onBack, onOpenPlace, onRepeatAsPlan, onInvite, onRetry }: FriendRouteViewProps) {
  const person = state.status === "ready" ? state.route.friend : friend;
  const title = person === null ? "Маршрут друга" : `Маршрут ${genitiveName(person.name)}`;
  return (
    <section className="app-froute">
      <div className="app-froute-topbar">
        <button type="button" className="app-froute-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={20} strokeWidth={2.4} />
        </button>
        <h1 className="app-froute-title">{title}</h1>
      </div>
      {state.status === "loading" && <AppSkeletonList rows={4} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить маршрут.
        </AppState>
      )}
      {state.status === "ready" && (
        <>
          <div className="app-froute-person">
            <PersonAvatar id={state.route.friend.id} name={state.route.friend.name} size={48} />
            <div className="app-froute-person-body">
              <span className="app-froute-person-name">{state.route.friend.name}</span>
              <span className="app-froute-person-line">{routeStopsLine(state.route)}</span>
            </div>
          </div>
          {state.route.stops.length === 0 ? (
            <AppState>Все места из этого маршрута ты уже видел.</AppState>
          ) : (
            <>
              <ol className="app-froute-stops">
                {state.route.stops.map((stop, index) => {
                  const meta = routeStopMeta(stop.visitedAt, stop.note);
                  return (
                    <li key={stop.place.id} className={index === state.route.stops.length - 1 ? "app-froute-stop app-froute-stop--last" : "app-froute-stop"}>
                      <span className="app-froute-rail" aria-hidden="true">
                        <span className="app-froute-dot">{index + 1}</span>
                        <span className="app-froute-line" />
                      </span>
                      <span className="app-froute-stop-body">
                        <span className="app-froute-stop-title">{stop.place.title}</span>
                        {meta !== null && <span className="app-froute-stop-meta">{meta}</span>}
                      </span>
                      {/* «В список» ведёт на карточку места: списки принимают только события (см. отчёт). */}
                      <button type="button" className="app-froute-save" onClick={() => onOpenPlace(stop.place.id)}>
                        В список
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="app-froute-repeat" onClick={onRepeatAsPlan}>
                Повторить маршрут как план
              </button>
            </>
          )}
        </>
      )}
      {state.status === "closed" && (
        <div className="app-froute-closed">
          <span className="app-froute-closed-mark" aria-hidden="true">
            <ActionIcon name="lock" size={22} strokeWidth={2.2} />
          </span>
          <span className="app-froute-closed-title">{person === null ? "Друг не показывает свои маршруты" : `${firstName(person.name)} не показывает свои маршруты`}</span>
          <span className="app-froute-closed-text">Это его настройка приватности, а не ошибка. Вы всё так же видите друг друга в общих планах и событиях.</span>
          <button type="button" className="app-froute-invite" onClick={onInvite}>
            {person === null ? "Позвать на событие" : `Позвать ${accusativeName(person.name)} на событие`}
          </button>
        </div>
      )}
    </section>
  );
}

export function FriendRoutePage({ id }: { id: string }) {
  const { navigate, back } = useRoute();
  const [state, setState] = useState<FriendRouteState>({ status: "loading" });
  const [friend, setFriend] = useState<Friend | null>(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.getFriendRoute(id).then(
      (route) => setState({ status: "ready", route }),
      // 403 is the privacy switch of the friend, and the design gives it a card of its own.
      (error: unknown) => setState({ status: error instanceof ApiError && error.status === 403 ? "closed" : "error" }),
    );
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (friends) => {
        if (alive) setFriend(friends.find((person) => person.id === id) ?? null);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [id]);

  return <FriendRouteView state={state} friend={friend} onBack={back} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} onRepeatAsPlan={() => navigate({ name: "plan-new" })} onInvite={() => navigate({ name: "search" })} onRetry={load} />;
}
