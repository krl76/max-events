// START_MODULE_CONTRACT
// PURPOSE: Экран 24 «Микро-события»: neighbourly gatherings of other users, grouped by how soon they start, each card in one of the four states of the design (можно присоединиться / ты в деле / мест нет / отменено).
// SCOPE: Data via apiClient.listMicroEvents + listPlaces (venue titles) + listFriends (the faces behind participantIds); the «Собрать» pill opens the creation form, a card opens экран 25; join/leave happen on the card screen, the feed only shows the state. The row and the bucket helpers are exported, because the home section and the calendar block draw the same card.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ../friends/avatar.js, ./MicroEvents.js (microWhere), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microTime - "19:00" of a micro-event start
// - MicroBucket - how soon a gathering is: soon / today / evening / tomorrow / later
// - MICRO_BUCKET_LABELS - the ru section headers of the design, one per bucket
// - microBucket - bucket of one start time against a given now
// - MicroGroup - one bucket with its label and the gatherings inside it
// - groupMicroEvents - upcoming open gatherings split into the buckets of the design, soonest first
// - MicroCtaState - which of the four card states a gathering is in for this viewer
// - microCtaState - state from the event, its counter and whether the viewer joined
// - MicroFaces - overlapping participant faces of a card (up to three, as the design draws)
// - MicroRow - the card itself: title, clock, venue, faces, «2 из 6» and the state CTA
// - MicroEventsState - union of the feed fetch states (loading / error / ready)
// - MicroEventsView - presentational экран 24: topbar with «Собрать», the lead-in line and the bucket sections
// - MicroEventsPage - route container: loads gatherings, venues and faces, wires the create and card navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend, MicroEvent, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PersonAvatar } from "../friends/avatar";
import { microWhere } from "./MicroEvents";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppSkeletonList, AppState } from "../ui/primitives";

export function microTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export type MicroBucket = "soon" | "today" | "evening" | "tomorrow" | "later";

export const MICRO_BUCKET_LABELS: Record<MicroBucket, string> = {
  soon: "ЧЕРЕЗ ЧАС",
  today: "СЕГОДНЯ",
  evening: "СЕГОДНЯ ВЕЧЕРОМ",
  tomorrow: "ЗАВТРА",
  later: "ПОЗЖЕ",
};

const MICRO_BUCKET_ORDER: readonly MicroBucket[] = ["soon", "today", "evening", "tomorrow", "later"];

/** «ЧЕРЕЗ ЧАС» covers the next hour and a half: the design puts 19:00 and 19:30 under it at once. */
const MICRO_SOON_MS = 90 * 60 * 1000;

/** Everything from five in the evening is «СЕГОДНЯ ВЕЧЕРОМ»; earlier today is just «СЕГОДНЯ». */
const MICRO_EVENING_HOUR = 17;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, so «сегодня» means the viewer's day rather than a UTC one. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function microBucket(startsAt: string, now: Date): MicroBucket {
  const start = new Date(startsAt);
  if (start.getTime() - now.getTime() < MICRO_SOON_MS) return "soon";
  const startDay = dayKey(start);
  if (startDay === dayKey(now)) return start.getHours() >= MICRO_EVENING_HOUR ? "evening" : "today";
  if (startDay === dayKey(new Date(now.getTime() + DAY_MS))) return "tomorrow";
  return "later";
}

export interface MicroGroup {
  bucket: MicroBucket;
  label: string;
  events: MicroEvent[];
}

/**
 * Only open gatherings that have not started yet: a cancelled one is not an invitation, and one that
 * began an hour ago would sit at the top of «ЧЕРЕЗ ЧАС» pretending it is still ahead.
 */
export function groupMicroEvents(events: MicroEvent[], now: Date): MicroGroup[] {
  const upcoming = events.filter((item) => item.status === "open" && Date.parse(item.startsAt) >= now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return MICRO_BUCKET_ORDER.map((bucket) => ({ bucket, label: MICRO_BUCKET_LABELS[bucket], events: upcoming.filter((item) => microBucket(item.startsAt, now) === bucket) })).filter((group) => group.events.length > 0);
}

export type MicroCtaState = "join" | "joined" | "full" | "cancelled";

export function microCtaState(item: MicroEvent, joined: boolean): MicroCtaState {
  if (item.status === "cancelled") return "cancelled";
  if (joined) return "joined";
  return item.participantsCount >= item.participantsLimit ? "full" : "join";
}

/** The design stacks three faces at most; the counter next to them carries the rest. */
const MICRO_MAX_FACES = 3;

export function MicroFaces({ people }: { people: Friend[] }) {
  if (people.length === 0) return null;
  return (
    <span className="app-micro-faces" role="img" aria-label={people.map((person) => person.name).join(", ")}>
      {people.slice(0, MICRO_MAX_FACES).map((person) => (
        <PersonAvatar key={person.id} id={person.id} name={person.name} size={28} className="app-micro-face" />
      ))}
    </span>
  );
}

interface MicroRowProps {
  item: MicroEvent;
  places: Place[];
  people: Friend[];
  joined: boolean;
  onOpen: () => void;
  onJoin?: () => void;
}

/** One gathering: what, when, where, who is already in and the single action its state allows. */
export function MicroRow({ item, places, people, joined, onOpen, onJoin }: MicroRowProps) {
  const state = microCtaState(item, joined);
  const faces = item.participantIds.map((id) => people.find((person) => person.id === id)).filter((person): person is Friend => person !== undefined);
  return (
    <div className="app-micro-row">
      <button type="button" className="app-micro-row-open" onClick={onOpen}>
        <img className="app-micro-row-photo" alt="" src={pictured(item.id)} />
        <span className="app-micro-head">
          <span className="app-micro-title">{item.title}</span>
          <span className="app-micro-clock">{microTime(item.startsAt)}</span>
        </span>
        <span className="app-micro-where">
          <ActionIcon name="pin" size={14} strokeWidth={2.2} />
          {microWhere(item, places)}
        </span>
        <span className="app-micro-foot">
          <MicroFaces people={faces} />
          <span className="app-micro-count">
            {item.participantsCount} из {item.participantsLimit}
          </span>
        </span>
      </button>
      {state === "join" && (
        <button type="button" className="app-micro-cta app-micro-cta--join" onClick={onJoin}>
          Иду
        </button>
      )}
      {state === "joined" && (
        <span className="app-micro-cta app-micro-cta--in">
          <ActionIcon name="check" size={14} strokeWidth={2.6} />
          Ты в деле
        </span>
      )}
      {state === "full" && <span className="app-micro-cta app-micro-cta--full">Мест нет</span>}
      {state === "cancelled" && <span className="app-micro-cta app-micro-cta--full">Отменено</span>}
    </div>
  );
}

export type MicroEventsState = { status: "loading" } | { status: "error" } | { status: "ready"; events: MicroEvent[] };

interface MicroEventsViewProps {
  state: MicroEventsState;
  places: Place[];
  people: Friend[];
  viewerId: string | null;
  now?: Date;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onJoin?: (id: string) => void;
  onRetry: () => void;
}

export function MicroEventsView({ state, places, people, viewerId, now = new Date(), onCreate, onOpen, onJoin, onRetry }: MicroEventsViewProps) {
  const groups = state.status === "ready" ? groupMicroEvents(state.events, now) : [];
  return (
    <section className="app-micro-screen">
      <div className="app-micro-bar">
        <h1 className="app-micro-bar-title">Микро-события</h1>
        <button type="button" className="app-micro-new" onClick={onCreate}>
          <ActionIcon name="plus" size={16} strokeWidth={2.8} />
          Собрать
        </button>
      </div>
      <p className="app-micro-lead">Зовут соседи и такие же пользователи. Без билетов и организаторов — только время и место.</p>
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить микро-события.
        </AppState>
      )}
      {state.status === "ready" && groups.length === 0 && <AppState hint="Время, место, лимит — и сбор в ленте.">Пока никто ничего не собирает.</AppState>}
      {groups.map((group) => (
        <section key={group.bucket} className="app-micro-group" aria-label={group.label}>
          <h2 className="app-micro-group-label">{group.label}</h2>
          {group.events.map((item) => (
            <MicroRow key={item.id} item={item} places={places} people={people} joined={viewerId !== null && item.participantIds.includes(viewerId)} onOpen={() => onOpen(item.id)} onJoin={() => onJoin?.(item.id)} />
          ))}
        </section>
      ))}
    </section>
  );
}

export function MicroEventsPage() {
  const auth = useAuth();
  const viewer = auth.status === "authenticated" ? auth.user : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<MicroEventsState>({ status: "loading" });
  const [places, setPlaces] = useState<Place[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.listMicroEvents().then(
      (events) => setState({ status: "ready", events }),
      () => setState({ status: "error" }),
    );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    // Venues and faces only decorate the cards: their failure must not blank the feed.
    apiClient.listPlaces().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {},
    );
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  // The viewer is a face too — their own gathering would otherwise show a stack without them in it.
  const people = viewer === null ? friends : [...friends, { id: viewer.id, name: viewer.firstName, avatarUrl: viewer.avatarUrl }];

  const join = (id: string) => {
    if (viewer === null) return;
    void apiClient.joinMicroEvent(id, viewer.id).then(load, load);
  };

  return <MicroEventsView state={state} places={places} people={people} viewerId={viewer?.id ?? null} onCreate={() => navigate({ name: "micro-new" })} onOpen={(id) => navigate({ name: "micro-event", id })} onJoin={join} onRetry={load} />;
}
