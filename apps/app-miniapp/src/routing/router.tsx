// START_MODULE_CONTRACT
// PURPOSE: Minimal router (home / search / swipe / create / map / event / place / friends / calendar / profile / subscriptions / whereto / nearby / discovery / people / plans / organizer / we-groups / moderation) synced with window.history, with deep-link resolution from start_param.
// SCOPE: Route type, start_param parsing, history push/replace/popstate sync, back(); no URL path mapping (state-only history entries).
// DEPENDS: ../max/bridge.js (getStartParam, webApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Route - moderation | home | search | swipe | create | map | event(id) | place(id) | friends | calendar | profile | settings | subscriptions | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | plan-new | day-route | list(id) | achievements | micro-new | story-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - Route - moderation | home | search | create | map | event(id) | place(id) | friends | calendar | profile | settings | subscriptions | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | plan-new | day-route | lists | list(id) | achievements | micro-new | story-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - routeFromStartParam - map start_param (event-/place-/plan-/list-/gathering-/vote- prefixes) to a Route, home fallback
// - Route - moderation | home | search | create | map | event(id) | place(id) | friends | calendar | profile | settings | subscriptions | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | plan-new | day-route | list(id) | achievements | after-event(eventId) | micro-new | story-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - routeFromStartParam - map start_param (event-/place-/plan-/list-/gathering-/vote-/after- prefixes) to a Route, home fallback
// - Route - … | micro (макет, экран 24) | micro-event(id) (экран 25) | friend-route(id) (экран 28)
// - isTabRoute - the five tabbar routes (home/search/create/map/profile); tab-to-tab switches replace the history entry instead of pushing. Plans open from the profile and push.
// - RouteHistoryState - history entry payload: route + sequential idx (idx drives back/forward detection)
// - nextHistory - pure history decision: tab-to-tab -> replace (idx kept), anything else -> push (idx + 1)
// - routeFromHistoryState - validate a popstate payload back into a RouteHistoryState, null when malformed
// - NavTransition - push/pop/tab/none direction of the last navigation (drives screen animations)
// - transitionFromIdx - direction from history idx movement (forward -> push, backward -> pop, same -> tab)
// - RouteProvider - current route synced with window.history (replaceState seed, popstate listener), back() with home fallback, transition direction + navSeq for screen animations
// - useRoute - current route + navigate + back + canGoBack + transition + navSeq
// - Route - ... | vote-new(groupId): создание голосования (макет, экран 32), groupId непустой, когда экран открыт из группы
// - Route - ... | assist(ask): экран 10 «MAX AI ассистент», ask — вопрос, с которым его открыли (чипы экрана 15)
// - Route - … | slot-booking(placeId) экран 19 | slot-ticket(id) экран 20 | bookings экран 21; the «booking-» start_param opens the ticket of экран 20
// - Route - ... | companions(eventId) — экран 23 «С кем пойти», вход с карточки события
// - Route - ... | notifications — экран 07 «Умные уведомления», вход с колокольчика в шапке ленты
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getStartParam, getWebApp } from "../max/bridge";

export type BrowseList = "nearby" | "suitable" | "friends" | "results";

export type Route =
  | { name: "home" }
  | { name: "search"; focus?: boolean }
  // Отдельный список с поиска: рядом, под интересы, с друзьями или результаты запроса.
  | { name: "browse"; list: BrowseList; query?: string; city?: string; date?: string }
  | { name: "swipe" }
  | { name: "create" }
  | { name: "map"; pin?: { lat: number; lng: number }; placeId?: string; drawRoute?: boolean }
  | { name: "event"; id: string }
  | { name: "place"; id: string }
  | { name: "friends" }
  | { name: "calendar"; inviteToken?: string }
  | { name: "profile" }
  | { name: "user"; id: string }
  | { name: "settings" }
  | { name: "subscriptions" }
  | { name: "whereto" }
  | { name: "nearby" }
  | { name: "discovery" }
  | { name: "people" }
  | { name: "gathering-new"; eventId: string }
  | { name: "gathering"; id: string }
  | { name: "plans" }
  | { name: "plan"; id: string }
  | { name: "plan-new" }
  | { name: "day-route" }
  | { name: "walk"; city: string }
  | { name: "list"; id: string }
  | { name: "achievements" }
  | { name: "micro-new" }
  | { name: "story-new" }
  | { name: "feed-new"; eventId: string | null }
  | { name: "organizer" }
  | { name: "we-groups" }
  | { name: "we-group"; id: string }
  | { name: "vote"; id: string }
  | { name: "moderation" }
  | { name: "after-event"; eventId: string }
  | { name: "lists" }
  // Создание голосования (макет, экран 32): из группы приходит её id, из «с кем пойти» — ничего
  | { name: "vote-new"; groupId: string | null }
  | { name: "micro" }
  | { name: "micro-event"; id: string }
  | { name: "friend-route"; id: string }
  // Экран 10 «MAX AI ассистент»: ask непустой, когда его открыли чипом уточнения с экрана 15
  | { name: "assist"; ask: string | null }
  // Экран 19: бронирование окна площадки открывается от места, а не от своего id — окно выбирается уже внутри
  | { name: "slot-booking"; placeId: string }
  // Экран 20: подтверждённая бронь с кодом входа
  | { name: "slot-ticket"; id: string }
  // Экран 21: «Мои брони» — билеты, слоты и лист ожидания в одном списке
  | { name: "bookings" }
  // Экран 23 «С кем пойти»: список открывается от события, поэтому несёт его id, а не свой
  | { name: "companions"; eventId: string }
  // Экран 07 «Умные уведомления»: входящие пользователя, вход — колокольчик в шапке ленты
  | { name: "notifications" }
  // «Подписчики»: обратная сторона подписки, вход — счётчик в шапке профиля
  | { name: "followers" }
  | { name: "post"; id: string }
  // Повтор онбординга из настроек. Первый запуск по-прежнему решает OnboardingGate, этот маршрут его не включает.
  | { name: "onboarding" };

const START_PARAM_PREFIXES = [
  ["event-", "event"],
  ["place-", "place"],
  ["plan-", "plan"],
  ["list-", "list"],
  ["gathering-", "gathering"],
  ["vote-", "vote"],
  ["micro-", "micro-event"],
  // Пуш после брони ведёт на экран 20 с кодом входа
  ["booking-", "slot-ticket"],
  ["post-", "post"],
  ["user-", "user"],
] as const satisfies ReadonlyArray<readonly [string, Route["name"]]>;

/** Browser stand: ?startapp= or ?start= carries the same payload MAX puts in start_param. */
export function startParamFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = (params.get("startapp") ?? params.get("start"))?.trim();
  return value ? value : null;
}

export function routeFromStartParam(startParam: string | null): Route {
  // Экран 35 «После события» is opened by the push that follows an event, so its deep link carries
  // an eventId rather than an id of its own and cannot ride the prefix table above.
  if (startParam?.startsWith("after-") === true) {
    const eventId = startParam.slice("after-".length);
    if (eventId) return { name: "after-event", eventId };
  }
  // Calendar invite is a token, not an entity id, and the bare word opens the calendar itself.
  if (startParam === "calendar") return { name: "calendar" };
  if (startParam === "onboarding") return { name: "onboarding" };
  if (startParam?.startsWith("calendar-") === true) {
    const inviteToken = startParam.slice("calendar-".length);
    if (inviteToken) return { name: "calendar", inviteToken };
  }
  for (const [prefix, name] of START_PARAM_PREFIXES) {
    if (startParam?.startsWith(prefix)) {
      const id = startParam.slice(prefix.length);
      if (id) return { name, id } as Route;
    }
  }
  return { name: "home" };
}

const TAB_ROUTE_NAMES: ReadonlySet<Route["name"]> = new Set(["home", "search", "create", "map", "profile"]);

export function isTabRoute(name: Route["name"]): boolean {
  return TAB_ROUTE_NAMES.has(name);
}

export interface RouteHistoryState {
  route: Route;
  idx: number;
}

export function nextHistory(current: RouteHistoryState, next: Route): { state: RouteHistoryState; method: "push" | "replace" } {
  if (isTabRoute(current.route.name) && isTabRoute(next.name)) {
    return { state: { route: next, idx: current.idx }, method: "replace" };
  }
  return { state: { route: next, idx: current.idx + 1 }, method: "push" };
}

function toRoute(value: unknown): Route | null {
  if (typeof value !== "object" || value === null) return null;
  const { name } = value as { name?: unknown };
  if (typeof name !== "string") return null;
  switch (name) {
    case "home":
      return { name };
    case "search": {
      const { focus } = value as { focus?: unknown };
      return focus === true ? { name: "search", focus: true } : { name: "search" };
    }
    case "swipe":
    case "create":
      return { name };
    case "map": {
      const raw = value as { pin?: unknown; placeId?: unknown; drawRoute?: unknown };
      const pin = raw.pin;
      const point = typeof pin === "object" && pin !== null ? (pin as { lat?: unknown; lng?: unknown }) : null;
      const lat = point?.lat;
      const lng = point?.lng;
      const placeId = typeof raw.placeId === "string" && raw.placeId !== "" ? raw.placeId : undefined;
      const drawRoute = raw.drawRoute === true;
      const dropped = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
      if (!dropped && placeId === undefined && !drawRoute) return { name };
      return { name, ...(dropped ? { pin: dropped } : {}), ...(placeId ? { placeId } : {}), ...(drawRoute ? { drawRoute: true } : {}) };
    }
    case "friends":
    case "profile":
    case "settings":
    case "subscriptions":
    case "whereto":
    case "nearby":
    case "discovery":
    case "people":
    case "plans":
    case "plan-new":
    case "day-route":
    case "lists":
    case "achievements":
    case "micro-new":
    case "story-new":
    case "organizer":
    case "we-groups":
    case "moderation":
    case "bookings":
      return { name };
    case "walk": {
      const city = "city" in value && typeof value.city === "string" ? value.city.trim() : "";
      return { name: "walk", city: city !== "" ? city : "Москва" };
    }
    case "calendar": {
      const { inviteToken } = value as { inviteToken?: unknown };
      if (typeof inviteToken === "string" && inviteToken !== "") return { name: "calendar", inviteToken };
      return { name: "calendar" };
    }
    case "slot-booking": {
      const { placeId } = value as { placeId?: unknown };
      return typeof placeId === "string" ? { name, placeId } : null;
    }
    case "feed-new": {
      const { eventId } = value as { eventId?: unknown };
      if (eventId !== null && eventId !== undefined && typeof eventId !== "string") return null;
      return { name, eventId: eventId ?? null };
    }
    case "assist": {
      // Экран 10 can be opened cold or with a question already typed for it («Дешевле», «Без такси»).
      const { ask } = value as { ask?: unknown };
      if (ask !== null && ask !== undefined && typeof ask !== "string") return null;
      return { name, ask: ask ?? null };
    }
    case "after-event":
    case "gathering-new": {
      const { eventId } = value as { eventId?: unknown };
      return typeof eventId === "string" ? { name, eventId } : null;
    }
    case "event":
    case "place":
    case "gathering":
    case "plan":
    case "list":
    case "we-group":
    case "vote":
    case "slot-ticket":
    case "post": {
      const { id } = value as { id?: unknown };
      return typeof id === "string" ? ({ name, id } as Route) : null;
    }
    case "vote-new": {
      const { groupId } = value as { groupId?: unknown };
      if (groupId !== null && groupId !== undefined && typeof groupId !== "string") return null;
      return { name, groupId: groupId ?? null };
    }
    case "micro":
      return { name };
    case "micro-event":
    case "friend-route":
    case "user": {
      const { id } = value as { id?: unknown };
      return typeof id === "string" ? ({ name, id } as Route) : null;
    }
    // Экран 07 параметров не несёт; отдельным case, а не строкой в общем блоке — чтобы правка не легла в чужую
    case "notifications":
      return { name };
    case "browse": {
      const { list, query, city, date } = value as { list?: unknown; query?: unknown; city?: unknown; date?: unknown };
      if (list !== "nearby" && list !== "suitable" && list !== "friends" && list !== "results") return null;
      const text = typeof query === "string" && query.trim() !== "" ? query : undefined;
      const place = typeof city === "string" && city.trim() !== "" ? city : undefined;
      const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
      return { name, list, ...(text ? { query: text } : {}), ...(place ? { city: place } : {}), ...(day ? { date: day } : {}) };
    }
    // «Подписчики» параметров не несёт; отдельным case, а не строкой в общем блоке — чтобы правка не легла в чужую
    case "followers":
      return { name };
    case "onboarding":
      return { name };
    // Экран 23 живёт при событии: свой case, потому что ключ — eventId
    case "companions": {
      const { eventId } = value as { eventId?: unknown };
      return typeof eventId === "string" ? { name, eventId } : null;
    }
    default:
      return null;
  }
}

export function routeFromHistoryState(value: unknown): RouteHistoryState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { route?: unknown; idx?: unknown };
  if (typeof candidate.idx !== "number") return null;
  const route = toRoute(candidate.route);
  return route === null ? null : { route, idx: candidate.idx };
}

export type NavTransition = "push" | "pop" | "tab" | "none";

export function transitionFromIdx(currentIdx: number, nextIdx: number): NavTransition {
  if (nextIdx > currentIdx) return "push";
  if (nextIdx < currentIdx) return "pop";
  return "tab";
}

interface Router {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
  transition: NavTransition;
  navSeq: number;
}

const RouteContext = createContext<Router>({ route: { name: "home" }, navigate: () => {}, back: () => {}, canGoBack: false, transition: "none", navSeq: 0 });

function writeHistory(state: RouteHistoryState, method: "push" | "replace"): void {
  if (typeof window === "undefined") return;
  if (method === "replace") window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}

const HOME_STATE: RouteHistoryState = { route: { name: "home" }, idx: 0 };

interface NavState {
  history: RouteHistoryState;
  transition: NavTransition;
  seq: number;
}

export function RouteProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavState>(() => {
    const fromMax = getStartParam(getWebApp());
    const fromUrl = typeof window === "undefined" ? null : startParamFromSearch(window.location.search);
    const initial: RouteHistoryState = { route: routeFromStartParam(fromMax ?? fromUrl), idx: 0 };
    writeHistory(initial, "replace");
    return { history: initial, transition: "none", seq: 0 };
  });

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const next = routeFromHistoryState(event.state) ?? HOME_STATE;
      setNav((current) => ({ history: next, transition: transitionFromIdx(current.history.idx, next.idx), seq: current.seq + 1 }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      const { state, method } = nextHistory(nav.history, next);
      writeHistory(state, method);
      setNav({ history: state, transition: method === "push" ? "push" : "tab", seq: nav.seq + 1 });
    },
    [nav],
  );

  const back = useCallback(() => {
    if (nav.history.idx > 0 && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    writeHistory(HOME_STATE, "replace");
    setNav((current) => ({ history: HOME_STATE, transition: "pop", seq: current.seq + 1 }));
  }, [nav.history.idx]);

  const value = useMemo<Router>(() => ({ route: nav.history.route, navigate, back, canGoBack: nav.history.idx > 0, transition: nav.transition, navSeq: nav.seq }), [nav, navigate, back]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute(): Router {
  return useContext(RouteContext);
}
