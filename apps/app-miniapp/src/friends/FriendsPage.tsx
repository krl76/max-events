// START_MODULE_CONTRACT
// PURPOSE: Экран 26 «Друзья»: the MAX contact list, the short «сейчас что-то делают» group and every friend below it.
// SCOPE: Data via apiClient.listFriends + getFriendsActivity; entries to экран 27 and экран 29; a row opens the friend's route (экран 28), which answers with the closed-access state when the friend hid it. «Пригласить в MAX» shares the viewer's profile into a chat (`user-` startapp). Resync is not offered here: the graph syncs on every authenticated request server-side, so a manual button would promise an action that changes nothing.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (Friend, FriendActivityByFriend), ./avatar.js, ./friends-empty.js, ../auth/AuthContext.js, ../max/bridge.js, ../max/links.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - initials - "Анна Соколова" -> "АС" for the two-letter initials avatar
// - friendNowLine - what a friend is up to, from the participation status and the start of their soonest event
// - activeFriends - friends with something on today or tomorrow, soonest first — the «сейчас что-то делают» group
// - friendsInvitePayload - sentence plus user- startapp for the MAX chat invite
// - FriendsState - union of the screen fetch states (loading / error / ready)
// - FriendsView - presentational экран 26: counter topbar, invite button, the active group and the full list
// - FriendsPage - route container: loads friends and their activity, wires navigation and the invite share
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend, FriendActivityByFriend } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useProfileCityPoint } from "../geo/profile-city";
import { announceShare, getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";
import { PersonAvatar } from "./avatar";
import { FRIENDS_GRAPH_EMPTY_TEXT } from "./friends-empty";

/** What the MAX share sheet puts in the chat, with a link that opens this person's profile. */
export function friendsInvitePayload(userId: string): { text: string; link?: string } {
  return sharePayload("Добавь меня в друзья в Афише MAX", `user-${userId}`);
}

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

const DAY_MS = 24 * 60 * 60 * 1000;

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
  if (next?.event?.startsAt === undefined) return null;
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
      const startsAt = group.events[0]?.event?.startsAt;
      return startsAt !== undefined && Date.parse(startsAt) <= horizon;
    })
    .sort((a, b) => (a.events[0]?.event?.startsAt ?? "").localeCompare(b.events[0]?.event?.startsAt ?? ""))
    .slice(0, FRIENDS_NOW_LIMIT);
}

export type FriendsState = { status: "loading" } | { status: "error" } | { status: "ready"; friends: Friend[]; groups: FriendActivityByFriend[] };

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
  now?: Date;
  onOpenFriend: (userId: string) => void;
  onOpenDiscovery: () => void;
  onOpenPeople: () => void;
  onInvite: () => void;
  onRetry: () => void;
  /** False when «Люди» opens a list measured from the city center. */
  peopleInCity?: boolean;
}

export function FriendsView({ state, now = new Date(), onOpenFriend, onOpenDiscovery, onOpenPeople, onInvite, onRetry, peopleInCity = true }: FriendsViewProps) {
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
      <button type="button" className="app-friends-invite" onClick={onInvite}>
        <ActionIcon name="share" size={18} />
        Пригласить в MAX
      </button>
      {state.status === "loading" && <AppSkeletonList rows={4} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить друзей.
        </AppState>
      )}
      {state.status === "ready" && state.friends.length === 0 && <AppState>{FRIENDS_GRAPH_EMPTY_TEXT}</AppState>}
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
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    // Only the friend list is load-bearing: without activity the screen still lists everyone.
    Promise.all([apiClient.listFriends(), apiClient.getFriendsActivity(userId).catch(() => [] as FriendActivityByFriend[])]).then(
      ([friends, groups]) => {
        if (alive) setState({ status: "ready", friends, groups });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId, reloads]);

  return (
    <FriendsView
      state={state}
      peopleInCity={point.settled && point.fromViewer}
      onOpenFriend={(id) => navigate({ name: "user", id })}
      onOpenDiscovery={() => navigate({ name: "discovery" })}
      onOpenPeople={() => navigate({ name: "people" })}
      onInvite={() => {
        if (userId === null) return;
        const payload = friendsInvitePayload(userId);
        void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
      }}
      onRetry={() => setReloads((value) => value + 1)}
    />
  );
}
