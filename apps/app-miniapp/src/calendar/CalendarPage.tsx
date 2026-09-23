// START_MODULE_CONTRACT
// PURPOSE: Экран 22 «Календарь планов»: два сегмента — «Мои брони» (свои записи списком) и «Календарь» (сетка месяца со своими записями и записями друга, с которым календарь общий), напоминание о ближайшем, предупреждение о накладке, ссылка на календарь и приглашение друга.
// SCOPE: Свои записи — apiClient.listCalendar (брони) и apiClient.listPlans (планы); половина друга — apiClient.getSharedCalendar, «Пойду» — apiClient.joinSharedCalendarEntry, «Добавить друга» — apiClient.addSharedCalendarPeer и listFriends (мок: понятия общей записи на бэкенде нет); отмена брони — apiClient.cancelBooking; «Поделиться» и «Ссылка на календарь» — shareResult из ../max/bridge.js. Микро-события идут отдельным блоком: они не брони и до GET /calendar не доходят.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry, SharedCalendar), ../auth/AuthContext.js, ../micro/MicroEvents.js (MyMicroEventsSection), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../max/bridge.js (shareResult, webApp), ./MonthCalendar.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarState - union of calendar fetch states (loading / error / ready)
// - splitCalendarEntries - split entries into upcoming (>= now, soonest first) and past (< now, latest first)
// - CalendarView - presentational: two sections with booking cards and empty states
// - CalendarTab - сегменты экрана 22: мои брони | календарь
// - SharedState - union of the shared-calendar fetch states (loading / error / ready)
// - peersLabel - «Общий с Анной» под заголовком месяца
// - calendarShareText - что уходит в чат MAX по «Поделиться» и «Ссылка на календарь»
// - SharedCalendarView - презентационно: месяц, сетка, легенда, день со списком записей и низ экрана
// - CalendarPage - контейнер вкладки «Календарь»: сегменты, загрузка обеих половин, «Пойду», приглашение и отмена брони
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Friend, PlanCard } from "@max-events/api-contracts";
import { apiClient, type CalendarEntry, type SharedCalendar } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { shareResult, webApp } from "../max/bridge";
import { MyMicroEventsSection } from "../micro/MicroEvents";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppChip, AppState, AppSection, AppMedia } from "../ui/primitives";
import { MonthGrid, calendarReminder, dayTitle, entriesOn, entryTime, mergeCalendarEntries, monthTitle, overlapWarnings, type CalendarDayEntry } from "./MonthCalendar";

export type CalendarState = { status: "loading" } | { status: "error" } | { status: "ready"; entries: CalendarEntry[] };

export function splitCalendarEntries(entries: CalendarEntry[], now: Date): { upcoming: CalendarEntry[]; past: CalendarEntry[] } {
  const byStartAsc = (a: CalendarEntry, b: CalendarEntry) => a.event.startsAt.localeCompare(b.event.startsAt);
  return {
    upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now.getTime()).sort(byStartAsc),
    past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now.getTime()).sort((a, b) => -byStartAsc(a, b)),
  };
}

function BookingCard({ entry, onCancel }: { entry: CalendarEntry; onCancel: (() => void) | null }) {
  const { event, place } = entry;
  return (
    <article className="app-card app-card--row">
      <AppMedia category={event.category} />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {place === null ? event.city : place.title}
        </span>
        <span className="app-card-subtitle">
          {CATEGORY_LABELS[event.category]} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
        </span>
        {onCancel !== null && (
          <AppButton className="app-calendar-cancel" size="small" tone="danger" onClick={onCancel}>
            Отменить запись
          </AppButton>
        )}
      </div>
    </article>
  );
}

interface CalendarViewProps {
  state: CalendarState;
  now: Date;
  onCancel: (bookingId: string) => void;
  onExplore: () => void;
}

export function CalendarView({ state, now, onCancel, onExplore }: CalendarViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить календарь.</AppState>;

  const { upcoming, past } = splitCalendarEntries(state.entries, now);
  return (
    <>
      <AppSection title="Запланированные" className="app-cards-flat">
        {upcoming.length === 0 ? <AppState action={{ label: "Найти событие", onClick: onExplore }}>Нет запланированных событий.</AppState> : upcoming.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={() => onCancel(entry.booking.id)} />)}
      </AppSection>
      <AppSection title="Прошедшие" className="app-cards-flat">
        {past.length === 0 ? <AppState>Нет прошедших событий.</AppState> : past.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={null} />)}
      </AppSection>
    </>
  );
}

export type CalendarTab = "bookings" | "month";

export type SharedState = { status: "loading" } | { status: "error" } | { status: "ready"; shared: SharedCalendar };

/** «Общий с Анной»: имя одного, счёт — когда их больше; пустой календарь про совместность молчит. */
export function peersLabel(shared: SharedCalendar): string | null {
  const names = shared.peers.map((peer) => peer.friend.name.split(" ")[0]);
  if (names.length === 0) return null;
  return `Общий с ${names.join(", ")}`;
}

export function calendarShareText(shared: SharedCalendar): string {
  const names = shared.peers.map((peer) => peer.friend.name).join(", ");
  const head = names === "" ? "Мой календарь планов в MAX Афише" : `Общий календарь планов: ${names}`;
  return shared.inviteUrl === null ? head : `${head} — ${shared.inviteUrl}`;
}

function DayRow({ entry, onOpen, onGoing }: { entry: CalendarDayEntry; onOpen: () => void; onGoing: () => void }) {
  return (
    <li className="app-cal-row">
      <span className={entry.sources.includes("peer") && !entry.sources.includes("own") ? "app-cal-row-dot app-cal-row-dot--peer" : "app-cal-row-dot"} aria-hidden="true" />
      <button type="button" className="app-cal-row-body" onClick={onOpen}>
        <span className="app-cal-row-title">
          {entry.title} · {entryTime(entry.startsAt)}
        </span>
        <span className="app-cal-row-note">{entry.note}</span>
      </button>
      {entry.needsResponse ? (
        <button type="button" className="app-cal-row-going" onClick={onGoing}>
          Пойду
        </button>
      ) : (
        <span className="app-cal-faces" role="img" aria-label={entry.note}>
          {entry.faces.map((face, index) => (
            <span key={`${face}-${index}`} className={index === 0 ? "app-cal-face" : "app-cal-face app-cal-face--alt"}>
              {face}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

interface SharedCalendarViewProps {
  shared: SharedState;
  entries: CalendarDayEntry[];
  month: Date;
  selected: Date;
  now: Date;
  onSelect: (day: Date) => void;
  onOpen: (entry: CalendarDayEntry) => void;
  onGoing: (sharedId: string) => void;
  onShare: () => void;
  onAddFriend: () => void;
  /** Список друзей раскрыт: кого ещё можно позвать в общий календарь. */
  invitable?: Friend[];
  onInvite?: (userId: string) => void;
  notice?: string | null;
}

export function SharedCalendarView({ shared, entries, month, selected, now, onSelect, onOpen, onGoing, onShare, onAddFriend, invitable, onInvite = () => {}, notice = null }: SharedCalendarViewProps) {
  const dayEntries = entriesOn(entries, selected);
  const warnings = overlapWarnings(dayEntries);
  const reminder = calendarReminder(entries, now);
  const peers = shared.status === "ready" ? peersLabel(shared.shared) : null;
  return (
    <section className="app-cal" aria-label="Календарь планов">
      <div className="app-cal-head">
        <h2 className="app-cal-month">{monthTitle(month)}</h2>
        <button type="button" className="app-cal-share" onClick={onShare}>
          <ActionIcon name="share" size={16} />
          Поделиться
        </button>
      </div>

      {shared.status === "error" && <AppState error>Не удалось загрузить общий календарь.</AppState>}
      {peers !== null && shared.status === "ready" && (
        <div className="app-cal-peers">
          <span className="app-cal-faces" role="img" aria-label={peers}>
            <span className="app-cal-face">Я</span>
            {shared.shared.peers.map((peer) => (
              <span key={peer.friend.id} className="app-cal-face app-cal-face--alt">
                {peer.friend.name.charAt(0)}
              </span>
            ))}
          </span>
          <span className="app-cal-peers-label">{peers}</span>
          {shared.shared.peers.every((peer) => peer.canEdit) && <span className="app-cal-peers-right">можно редактировать</span>}
        </div>
      )}

      <MonthGrid month={month} selected={selected} entries={entries} onSelect={onSelect} />

      <div className="app-cal-legend">
        <span className="app-cal-legend-item">
          <span className="app-cal-dot app-cal-dot--own" aria-hidden="true" />
          ваши
        </span>
        {shared.status === "ready" &&
          shared.shared.peers.map((peer) => (
            <span key={peer.friend.id} className="app-cal-legend-item app-cal-legend-item--peer">
              <span className="app-cal-dot app-cal-dot--peer" aria-hidden="true" />
              {peer.friend.name.split(" ")[0]}
            </span>
          ))}
      </div>

      {reminder !== null && <p className="app-cal-reminder">{reminder}</p>}

      <h3 className="app-cal-day-title">{dayTitle(selected)}</h3>
      {warnings.map((warning) => (
        <p key={warning} className="app-cal-warning">
          <ActionIcon name="alert" size={16} />
          {warning}
        </p>
      ))}
      {dayEntries.length === 0 ? (
        <AppState>В этот день ничего не запланировано.</AppState>
      ) : (
        <ul className="app-cal-rows">
          {dayEntries.map((entry) => (
            <DayRow key={entry.id} entry={entry} onOpen={() => onOpen(entry)} onGoing={() => entry.sharedId !== null && onGoing(entry.sharedId)} />
          ))}
        </ul>
      )}

      {invitable !== undefined &&
        (invitable.length === 0 ? (
          <p className="app-cal-reminder">Все друзья уже в этом календаре.</p>
        ) : (
          <ul className="app-cal-rows" aria-label="Кого позвать в календарь">
            {invitable.map((friend) => (
              <li key={friend.id} className="app-cal-row">
                <span className="app-cal-row-body app-cal-row-body--static">
                  <span className="app-cal-row-title">{friend.name}</span>
                </span>
                <button type="button" className="app-cal-row-going" onClick={() => onInvite(friend.id)}>
                  Позвать
                </button>
              </li>
            ))}
          </ul>
        ))}
      {notice !== null && <p className="app-cal-reminder">{notice}</p>}

      <div className="app-cal-cta">
        <button type="button" className="app-cal-cta-side" onClick={onShare}>
          Ссылка на календарь
        </button>
        <button type="button" className="app-cal-cta-main" onClick={onAddFriend}>
          {invitable === undefined ? "Добавить друга" : "Скрыть список"}
        </button>
      </div>
    </section>
  );
}

const CALENDAR_TABS: ReadonlyArray<{ id: CalendarTab; label: string }> = [
  { id: "bookings", label: "Мои брони" },
  { id: "month", label: "Календарь" },
];

export function CalendarPage() {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [tab, setTab] = useState<CalendarTab>("month");
  const [state, setState] = useState<CalendarState>({ status: "loading" });
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [shared, setShared] = useState<SharedState>({ status: "loading" });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    apiClient.listCalendar().then(
      (entries) => {
        if (alive) setState({ status: "ready", entries });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    apiClient.listPlans().then(
      (cards) => {
        if (alive) setPlans(cards);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  useEffect(() => {
    let alive = true;
    setShared({ status: "loading" });
    apiClient.getSharedCalendar().then(
      (loaded) => {
        if (alive) setShared({ status: "ready", shared: loaded });
      },
      () => {
        if (alive) setShared({ status: "error" });
      },
    );
    apiClient.listFriends().then(
      (loaded) => {
        if (alive) setFriends(loaded);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const cancel = useCallback((bookingId: string) => {
    apiClient.cancelBooking(bookingId).then(
      () => setAttempt((n) => n + 1),
      () => setAttempt((n) => n + 1),
    );
  }, []);

  const entries = useMemo(() => mergeCalendarEntries(state.status === "ready" ? state.entries : [], plans, shared.status === "ready" ? shared.shared : null), [state, plans, shared]);

  const peerIds = new Set(shared.status === "ready" ? shared.shared.peers.map((peer) => peer.friend.id) : []);

  const going = (sharedId: string) => {
    setNotice(null);
    apiClient.joinSharedCalendarEntry(sharedId).then(
      (loaded) => setShared({ status: "ready", shared: loaded }),
      () => setNotice("Не удалось отметиться — попробуй ещё раз."),
    );
  };

  const invite = (friendId: string) => {
    setNotice(null);
    apiClient.addSharedCalendarPeer(friendId).then(
      (loaded) => setShared({ status: "ready", shared: loaded }),
      () => setNotice("Не удалось открыть календарь другу."),
    );
  };

  const share = () => {
    if (shared.status !== "ready") return;
    void shareResult(webApp, calendarShareText(shared.shared)).then(
      (channel) => setNotice(channel === "clipboard" ? "Ссылка скопирована — вставь её в чат MAX." : "Ссылка отправлена в чат MAX."),
      () => setNotice("Не удалось отправить ссылку."),
    );
  };

  return (
    <>
      <div className="app-view-toggle" role="group" aria-label="Разделы календаря">
        {CALENDAR_TABS.map((item) => (
          <AppChip key={item.id} pressed={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </AppChip>
        ))}
      </div>
      {tab === "month" ? (
        <SharedCalendarView
          shared={shared}
          entries={entries}
          month={selected}
          selected={selected}
          now={new Date()}
          onSelect={setSelected}
          onOpen={(entry) => {
            if (entry.planId !== null) navigate({ name: "plan", id: entry.planId });
            else if (entry.eventId !== null) navigate({ name: "event", id: entry.eventId });
          }}
          onGoing={going}
          onShare={share}
          onAddFriend={() => setPicking((current) => !current)}
          invitable={picking ? friends.filter((friend) => !peerIds.has(friend.id)) : undefined}
          onInvite={invite}
          notice={notice}
        />
      ) : (
        <>
          <CalendarView state={state} now={new Date()} onCancel={cancel} onExplore={() => navigate({ name: "home" })} />
          {/* Below the bookings: a micro-event the viewer joined is a record of their own too, and it used to live nowhere but the feed. */}
          <MyMicroEventsSection />
        </>
      )}
    </>
  );
}
