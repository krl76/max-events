// START_MODULE_CONTRACT
// PURPOSE: Экран 26 «Друзья»: the MAX contact list with the sync as an explicit action, the short «сейчас что-то делают» group and every friend below it.
// SCOPE: Data via apiClient.listFriends + getFriendsActivity + getFriendsSync, resync via apiClient.syncFriends (POST /friends/sync exists; only its timestamp is mock); entries to экран 27 and экран 29; a row opens the friend's route (экран 28), which answers with the closed-access state when the friend hid it.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (Friend, FriendActivityByFriend), ./avatar.js, ./friends-empty.js, ../auth/AuthContext.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - initials - "Анна Соколова" -> "АС" for the two-letter initials avatar
// - syncLabel - «Синхронизировано 2 часа назад» from the stamp, «Контакты ещё не синхронизированы» without one
// - friendNowLine - what a friend is up to, from the participation status and the start of their soonest event
// - activeFriends - friends with something on today or tomorrow, soonest first — the «сейчас что-то делают» group
// - FriendsState - union of the screen fetch states (loading / error / ready)
// - FriendsView - presentational экран 26: counter topbar, contacts row, the active group and the full list
// - FriendsPage - route container: loads friends, their activity and the sync stamp, wires resync and navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend, FriendActivityByFriend } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useProfileCityPoint } from "../geo/profile-city";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";
import { PersonAvatar } from "./avatar";
import { FRIENDS_GRAPH_EMPTY_TEXT } from "./friends-empty";

/** The people screen is «рядом» only when the viewer is in the city the list is measured from. */
export function friendsPeopleLabel(inCity: boolean): string {
  return inCity ? "Люди рядом" : "Люди в городе";
}

/** Two letters for the places that still draw the old initials avatar (the gathering flow, the vote screen). */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** «Синхронизировано 2 часа назад» — the design writes the age, not the date, so a stale graph is obvious. */
export function syncLabel(syncedAt: string | null, now: Date = new Date()): string {
  if (syncedAt === null) return "Контакты ещё не синхронизированы";
  const age = now.getTime() - Date.parse(syncedAt);
  if (!Number.isFinite(age) || age < 2 * MINUTE_MS) return "Синхронизировано только что";
  if (age < HOUR_MS) return `Синхронизировано ${Math.round(age / MINUTE_MS)} мин назад`;
  if (age < DAY_MS) {
    const hours = Math.round(age / HOUR_MS);
    const plural = hours % 10 === 1 && hours % 100 !== 11 ? "час" : hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 12 || hours % 100 > 14) ? "часа" : "часов";
    return `Синхронизировано ${hours} ${plural} назад`;
  }
  const days = Math.floor(age / DAY_MS);
  return days === 1 ? "Синхронизировано вчера" : `Синхронизировано ${days} дн назад`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * The line under a name in the «сейчас что-то делают» group. The backend has no status text — it has a
 * participation status and an event — so the line is built from those two, in the three shapes the design
 * writes: «На джаз-вечере…», «Идёт на … завтра», «Собирает компанию на …».
 */
export function friendNowLine(group: FriendActivityByFriend, now: Date = new Date()): string | null {
  const next = group.events[0];
  if (next === undefined) return null;
  const starts = new Date(next.event.startsAt);
  const today = dayKey(starts) === dayKey(now);
  const tomorrow = dayKey(starts) === dayKey(new Date(now.getTime() + DAY_MS));
  if (next.participationStatus === "looking_for_company" || next.participationStatus === "looking_for_travel_buddy" || next.participationStatus === "looking_for_after_event_company") return `Собирает компанию на «${next.event.title}»`;
  if (today && starts.getTime() <= now.getTime()) return `На «${next.event.title}»`;
  return `Идёт на «${next.event.title}»${today ? " сегодня" : tomorrow ? " завтра" : ""}`;
}

/**
 * Верхняя группа — витрина, а не второй список: в макете в ней три человека, а все остальные стоят
 * ниже под «ВСЕ ДРУЗЬЯ». Без предела активный день уводит в неё весь список, и экран теряет роcтер
 * целиком — остаются одни статусы. Срез идёт по ближайшему событию, так что видны самые срочные.
 */
const FRIENDS_NOW_LIMIT = 3;

/** «Сейчас что-то делают» is about today and tomorrow; a plan for next month is not something a friend is doing. */
export function activeFriends(groups: FriendActivityByFriend[], now: Date = new Date()): FriendActivityByFriend[] {
  const horizon = now.getTime() + 2 * DAY_MS;
  return groups
    .filter((group) => {
      const next = group.events[0];
      return next !== undefined && Date.parse(next.event.startsAt) <= horizon;
    })
    .sort((a, b) => a.events[0].event.startsAt.localeCompare(b.events[0].event.startsAt))
    .slice(0, FRIENDS_NOW_LIMIT);
}

export type FriendsState = { status: "loading" } | { status: "error" } | { status: "ready"; friends: Friend[]; groups: FriendActivityByFriend[]; syncedAt: string | null };

function FriendRow({ friend, line, onOpen }: { friend: Friend; line?: string | null; onOpen: () => void }) {
  return (
    <button type="button" className="app-friend-row" onClick={onOpen}>
      <PersonAvatar id={friend.id} name={friend.name} size={44} />
      <span className="app-friend-body">
        <span className="app-friend-name">{friend.name}</span>
        {line !== null && line !== undefined && <span className="app-friend-line">{line}</span>}
      </span>
      <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
    </button>
  );
}

interface FriendsViewProps {
  state: FriendsState;
  syncing?: boolean;
  now?: Date;
  onSync: () => void;
  onOpenFriend: (userId: string) => void;
  onOpenDiscovery: () => void;
  onOpenPeople: () => void;
  onRetry: () => void;
  /** False when «Люди» opens a list measured from the city center. */
  peopleInCity?: boolean;
}

export function FriendsView({ state, now = new Date(), onOpenFriend, onOpenDiscovery, onOpenPeople, onRetry, peopleInCity = true }: FriendsViewProps) {
  const active = state.status === "ready" ? activeFriends(state.groups, now) : [];
  const activeIds = new Set(active.map((group) => group.friend.id));
  // Кто уже стоит в верхней группе, второй раз ниже не повторяется: макет показывает каждого один раз.
  const rest = state.status === "ready" ? state.friends.filter((friend) => !activeIds.has(friend.id)) : [];

  return (
    <section className="app-friends-screen">
      <div className="app-friends-bar">
        <h1 className="app-friends-bar-title">Друзья</h1>
        {state.status === "ready" && state.friends.length > 0 && <span className="app-friends-bar-count">{state.friends.length}</span>}
      </div>
      <div className="app-friends-entries">
        <button type="button" className="app-friends-entry" onClick={onOpenDiscovery}>
          <span className="app-friends-entry-mark" aria-hidden="true">
            <ActionIcon name="pin" size={22} />
          </span>
          <span className="app-friends-entry-copy">
            <span className="app-friends-entry-title">Друзья открыли</span>
            <span className="app-friends-entry-hint">Места, где друзья уже были, а ты ещё нет</span>
          </span>
          <ActionIcon name="chevron" size={18} />
        </button>
        <button type="button" className="app-friends-entry" onClick={onOpenPeople}>
          <span className="app-friends-entry-mark" aria-hidden="true">
            <ActionIcon name="users" size={22} />
          </span>
          <span className="app-friends-entry-copy">
            <span className="app-friends-entry-title">{friendsPeopleLabel(peopleInCity)}</span>
            <span className="app-friends-entry-hint">Кто из Афиши есть в твоём городе</span>
          </span>
          <ActionIcon name="chevron" size={18} />
        </button>
      </div>
      {state.status === "loading" && <AppSkeletonList rows={4} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить друзей.
        </AppState>
      )}
      <p className="app-friends-rule">Друзья — кто добавил вас в ответ, и люди по ссылке в MAX.</p>
      {state.status === "ready" && state.friends.length === 0 && <AppState hint="Позовите ссылкой в MAX или добавьте человека в профиле.">{FRIENDS_GRAPH_EMPTY_TEXT}</AppState>}
      {active.length > 0 && (
        <section className="app-friends-sec" aria-label="Сейчас что-то делают">
          <h2 className="app-friends-sec-label">Сейчас что-то делают · {active.length}</h2>
          {active.map((group) => (
            <FriendRow key={group.friend.id} friend={group.friend} line={friendNowLine(group, now)} onOpen={() => onOpenFriend(group.friend.id)} />
          ))}
        </section>
      )}
      {rest.length > 0 && (
        <section className="app-friends-sec" aria-label="Все друзья">
          <h2 className="app-friends-sec-label">Все друзья</h2>
          {rest.map((friend) => (
            <FriendRow key={friend.id} friend={friend} onOpen={() => onOpenFriend(friend.id)} />
          ))}
        </section>
      )}
    </section>
  );
}

export function FriendsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const point = useProfileCityPoint();
  const [state, setState] = useState<FriendsState>({ status: "loading" });
  const [syncing, setSyncing] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    // Only the friend list is load-bearing: without activity the screen still lists everyone, and
    // without the stamp it says so in words instead of blanking.
    Promise.all([apiClient.listFriends(), apiClient.getFriendsActivity(userId).catch(() => [] as FriendActivityByFriend[]), apiClient.getFriendsSync().catch(() => ({ syncedAt: null }))]).then(
      ([friends, groups, sync]) => {
        if (alive) setState({ status: "ready", friends, groups, syncedAt: sync.syncedAt });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId, reloads]);

  const sync = useCallback(() => {
    setSyncing(true);
    apiClient.syncFriends().then(
      () => {
        setSyncing(false);
        setReloads((value) => value + 1);
      },
      () => {
        setSyncing(false);
        setReloads((value) => value + 1);
      },
    );
  }, []);

  return <FriendsView state={state} syncing={syncing} peopleInCity={point.settled && point.fromViewer} onSync={sync} onOpenFriend={(id) => navigate({ name: "user", id })} onOpenDiscovery={() => navigate({ name: "discovery" })} onOpenPeople={() => navigate({ name: "people" })} onRetry={() => setReloads((value) => value + 1)} />;
}
