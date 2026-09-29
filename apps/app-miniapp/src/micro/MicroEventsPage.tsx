// START_MODULE_CONTRACT
// PURPOSE: Экран 24 «Микро-события» (вариант C): a horizontal day strip navigates the feed, compact rows carry the clock in a left column with «через N мин», each card in one of the four states of the design (можно присоединиться / ты идёшь / мест нет / отменено).
// SCOPE: Data via apiClient.listMicroEvents + listPlaces (venue titles) + listFriends (the faces behind participantIds); the «Собрать» pill opens the creation form, a row opens экран 25; join/leave happen on the card screen, the feed only shows the state. The row, day-strip and bucket helpers are exported, because the home section and the calendar block draw the same card.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ../friends/avatar.js, ./MicroEvents.js (microWhere), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microTime - "19:00" of a micro-event start
// - MicroBucket - how soon a gathering is: soon / today / evening / tomorrow / later
// - MICRO_BUCKET_LABELS - the ru section headers of the design, one per bucket
// - microBucket - bucket of one start time against a given now
// - MicroDay - one day of the strip: calendar key, «дд месяц» label, gathering count, is-today
// - microDays - days of the day strip from today forward, today first even when empty
// - microRelative - «через N мин» for a start within the next hour, empty otherwise
// - microSeatsLine - free seats said positively («4 места свободно»), never a raw «0 из 8»
// - MicroGroup - one bucket with its label and the gatherings inside it
// - groupMicroEvents - upcoming open gatherings split into the buckets of the design, soonest first
// - MicroCtaState - which of the four card states a gathering is in for this viewer
// - microCtaState - state from the event, its counter and whether the viewer joined
// - MicroFaces - overlapping participant faces of a card (up to three, as the design draws)
// - MicroRow - the compact row itself: clock column with relative minutes, title, venue, faces, free seats and the state CTA
// - DayStrip - the horizontal day strip: a pill per day, the chosen one highlighted, count per day
// - MicroEventsState - union of the feed fetch states (loading / error / ready)
// - MicroEventsView - presentational экран 24: topbar with «Собрать», the lead-in line, the day strip and the rows of the chosen day
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

/** One day of the strip: the calendar key, the «дд месяц» label, how many gatherings and whether it is today. */
export interface MicroDay {
  key: string;
  label: string;
  count: number;
  today: boolean;
}

const MICRO_DAY_LABEL = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

/**
 * Days of the strip from today forward. Today leads even when nothing is on it — the strip is the
 * navigation, and a day without a pill would hide «nothing today» behind a scroll; past days are
 * never listed, a gathering that already began is not reachable through the day strip.
 */
export function microDays(events: MicroEvent[], now: Date): MicroDay[] {
  const upcoming = events.filter((item) => item.status === "open" && Date.parse(item.startsAt) >= now.getTime());
  if (upcoming.length === 0) return [];
  const counts = new Map<string, number>();
  for (const item of upcoming) {
    const key = dayKey(new Date(item.startsAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const todayKey = dayKey(now);
  counts.set(todayKey, counts.get(todayKey) ?? 0);
  return [...counts.keys()]
    .sort((a, b) => {
      const [y1, m1, d1] = a.split("-").map(Number);
      const [y2, m2, d2] = b.split("-").map(Number);
      return new Date(y1, m1, d1).getTime() - new Date(y2, m2, d2).getTime();
    })
    .map((key) => {
      // «2026-9-19» parts back into a local date; the string key is sortable, the parts are the date.
      const [year, month, day] = key.split("-").map(Number);
      return { key, label: MICRO_DAY_LABEL.format(new Date(year, month - 1, day)), count: counts.get(key) ?? 0, today: key === todayKey };
    });
}

/** «через N мин» under the time of a row; only the next hour is urgent enough to say it out loud. */
export function microRelative(startsAt: string, now: Date): string {
  const minutes = Math.round((Date.parse(startsAt) - now.getTime()) / (60 * 1000));
  if (minutes <= 0 || minutes >= 60) return "";
  return `через ${minutes} мин`;
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
  return item.participantsLimit !== null && item.participantsCount >= item.participantsLimit ? "full" : "join";
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
  now?: Date;
  onOpen: () => void;
  onJoin?: () => void;
}

/** Free seats said positively: an empty gathering reads as an invitation, not as a dead «0 из 8». */
export function microSeatsLine(item: MicroEvent): string {
  if (item.participantsLimit === null) return "без лимита";
  const free = item.participantsLimit - item.participantsCount;
  if (free <= 0) return "мест нет";
  const form = free === 1 ? "место" : free < 5 ? "места" : "мест";
  return `${free} ${form} свободно`;
}

/** One gathering: what, when, where, who is already in and the single action its state allows. */
export function MicroRow({ item, places, people, joined, now = new Date(), onOpen, onJoin }: MicroRowProps) {
  const state = microCtaState(item, joined);
  const faces = item.participantIds.map((id) => people.find((person) => person.id === id)).filter((person): person is Friend => person !== undefined);
  const relative = microRelative(item.startsAt, now);
  const place = item.placeId ? places.find((p) => p.id === item.placeId) : null;
  const coverUrl = place?.logoUrl ?? null;
  const whereText = microWhere(item, places);

  return (
    <article className="app-micro-row app-micro-grid-card">
      <div
        className="app-micro-grid-media"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen();
        }}
      >
        {coverUrl ? <img src={coverUrl} className="app-micro-grid-img" alt="" /> : <div className="app-micro-grid-gradient" />}
        <div className="app-micro-grid-overlay-top">
          <span className="app-micro-time-chip">
            <span className="app-micro-clock">{microTime(item.startsAt)}</span>
            {relative !== "" && <span className="app-micro-clock-rel"> · {relative}</span>}
          </span>
          {state === "joined" && <span className="app-micro-badge-in">✓ Ты идёшь</span>}
        </div>
      </div>
      <div className="app-micro-grid-body">
        <button type="button" className="app-micro-row-open" onClick={onOpen}>
          <span className="app-micro-title">{item.title}</span>
          <span className="app-micro-where">
            <ActionIcon name="pin" size={12} strokeWidth={2.2} />
            {whereText}
          </span>
        </button>
        <div className="app-micro-grid-foot">
          <div className="app-micro-foot-meta">
            <MicroFaces people={faces} />
            <span className="app-micro-count">{microSeatsLine(item)}</span>
          </div>
          {state === "join" && (
            <button type="button" className="app-micro-cta app-micro-cta--join app-micro-cta-grid" onClick={onJoin}>
              Иду
            </button>
          )}
          {state === "joined" && (
            <span className="app-micro-cta app-micro-cta--in app-micro-cta-grid">
              <ActionIcon name="check" size={13} strokeWidth={2.6} />
              Ты идёшь
            </span>
          )}
          {state === "full" && <span className="app-micro-cta app-micro-cta--full app-micro-cta-grid">Мест нет</span>}
          {state === "cancelled" && <span className="app-micro-cta app-micro-cta--full app-micro-cta-grid">Отменено</span>}
        </div>
      </div>
    </article>
  );
}

export type MicroEventsState = { status: "loading" } | { status: "error" } | { status: "ready"; events: MicroEvent[] };

interface DayStripProps {
  days: MicroDay[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/** The day strip of the design: one pill per day, the chosen one highlighted, each with its count. */
export function DayStrip({ days, selectedKey, onSelect }: DayStripProps) {
  if (days.length === 0) return null;
  return (
    <div className="app-micro-daystrip" role="tablist" aria-label="Дни с микро-событиями">
      {days.map((day) => (
        <button key={day.key} type="button" role="tab" aria-selected={day.key === selectedKey} className={`app-micro-day${day.key === selectedKey ? " app-micro-day--on" : ""}`} onClick={() => onSelect(day.key)}>
          <span className="app-micro-day-label">{day.today ? "Сегодня" : day.label}</span>
          <span className="app-micro-daycount">{day.count > 0 ? `${day.count}` : "—"}</span>
        </button>
      ))}
    </div>
  );
}

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
  const events = state.status === "ready" ? state.events : [];
  const days = microDays(events, now);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = selectedKey !== null && days.some((day) => day.key === selectedKey) ? selectedKey : (days[0]?.key ?? null);
  const active = activeKey === null ? [] : events.filter((item) => item.status === "open" && Date.parse(item.startsAt) >= now.getTime() && dayKey(new Date(item.startsAt)) === activeKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
      {state.status === "ready" && days.length === 0 && <AppState hint="Время, место, лимит — и сбор в ленте.">Пока никто ничего не собирает.</AppState>}
      {state.status === "ready" && days.length > 0 && (
        <>
          <div className="app-micro-header-sticky">
            <DayStrip days={days} selectedKey={activeKey ?? ""} onSelect={setSelectedKey} />
          </div>
          {active.length === 0 ? (
            <AppState hint="Загляни в соседние дни или собери своё.">В этот день пока никто ничего не собирает.</AppState>
          ) : (
            <div className="app-micro-grid">
              {active.map((item) => (
                <MicroRow key={item.id} item={item} places={places} people={people} joined={viewerId !== null && item.participantIds.includes(viewerId)} now={now} onOpen={() => onOpen(item.id)} onJoin={() => onJoin?.(item.id)} />
              ))}
            </div>
          )}
          <button type="button" className="app-micro-floating-create" onClick={onCreate} aria-label="Собрать микро-событие">
            <ActionIcon name="plus" size={18} strokeWidth={2.8} />
            Собрать
          </button>
        </>
      )}
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
