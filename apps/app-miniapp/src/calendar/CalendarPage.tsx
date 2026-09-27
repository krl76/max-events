// START_MODULE_CONTRACT
// PURPOSE: Экран 22 «Календарь планов»: два раздела — «Мои брони» (свои записи списком) и «Календарь» (сетка месяца со своими записями и записями друга, с которым календарь общий), напоминание о ближайшем, предупреждение о накладке, ссылка на календарь и приглашение друга. Раздел выбирает ряд пилюль вкладки «Планы», своей шапки у экрана нет.
// SCOPE: Свои записи — apiClient.listCalendar (брони) и apiClient.listPlans (планы); половина друга — apiClient.getSharedCalendar, «Пойду» — apiClient.joinSharedCalendarEntry, «Добавить друга» открывает FriendPicker и зовёт apiClient.addSharedCalendarPeer по каждому выбранному, список друзей — listFriends; отмена брони — apiClient.cancelBooking; «Поделиться» и «Ссылка на календарь» — shareResult из ../max/bridge.js. Микро-события идут отдельным блоком: они не брони и до GET /calendar не доходят.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry, SharedCalendar), ../auth/AuthContext.js, ../micro/MicroEvents.js (MyMicroEventsSection), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../max/bridge.js (shareResult, webApp), ./MonthCalendar.js, ../routing/router.js, ../ui/FriendPicker.js (FriendPicker), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarState - union of calendar fetch states (loading / error / ready)
// - splitCalendarEntries - split entries into upcoming (>= now, soonest first) and past (< now, latest first)
// - CalendarView - presentational: two sections with booking cards and empty states
// - CalendarTab - разделы экрана 22: мои брони | календарь; какой открыт, решает ряд пилюль вкладки «Планы»
// - SharedState - union of the shared-calendar fetch states (loading / error / absent when the backend has no such endpoint / ready)
// - instrumentalName - имя в творительном падеже по его же окончанию («Анна» -> «Анной»)
// - peersLabel - «Общий с Анной» под заголовком месяца
// - calendarShareText - что уходит в чат MAX по «Поделиться» и «Ссылка на календарь»
// - SharedCalendarView - презентационно: месяц, сетка, легенда, день со списком записей и низ экрана
// - CalendarPage - контейнер разделов «Мои брони» и «Календарь»: загрузка обеих половин, «Пойду», приглашение друзей через FriendPicker и отмена брони
// - filterCalendarScope - «Мой календарь» оставляет и свои записи, и записи друзей, чтобы день пересечения не пустел; календарь одного друга — только его строки
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Friend, PlanCard } from "@max-events/api-contracts";
import { apiClient, isEndpointMissing, type CalendarEntry, type SharedCalendar } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { shareResult, webApp } from "../max/bridge";
import { sharePayload, startParamFromSharedUrl } from "../max/links";
import { useRoute } from "../routing/router";
import { FriendPicker } from "../ui/FriendPicker";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState, AppSection, AppMedia } from "../ui/primitives";
import { buildCalendarIcs } from "./calendar-ics";
import { MonthGrid, calendarReminder, dayKey, dayTitle, entriesOn, entryTime, mergeCalendarEntries, monthTitle, overlapWarnings, type CalendarDayEntry } from "./MonthCalendar";

export type CalendarState = { status: "loading" } | { status: "error" } | { status: "ready"; entries: CalendarEntry[] };

/** Offers the bookings as a download: the webview hands an .ics file to the calendar app of the phone. */
function exportCalendarIcs(entries: CalendarEntry[]): void {
  const blob = new Blob([buildCalendarIcs(entries)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "max-events.ics";
  link.click();
  URL.revokeObjectURL(url);
}

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
  /** Hands the bookings over to the phone's own calendar as an .ics file; without a handler the button is not drawn. */
  onExport?: () => void;
}

export function CalendarView({ state, now, onCancel, onExplore, onExport }: CalendarViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить календарь.</AppState>;

  const { upcoming, past } = splitCalendarEntries(state.entries, now);
  return (
    <>
      <AppSection title="Запланированные" className="app-cards-flat">
        {upcoming.length === 0 ? <AppState action={{ label: "Найти событие", onClick: onExplore }}>Нет запланированных событий.</AppState> : upcoming.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={() => onCancel(entry.booking.id)} />)}
        {onExport !== undefined && upcoming.length > 0 && (
          <AppButton tone="secondary" onClick={onExport} stretched>
            Экспорт в календарь
          </AppButton>
        )}
      </AppSection>
      <AppSection title="Прошедшие" className="app-cards-flat">
        {past.length === 0 ? <AppState>Нет прошедших событий.</AppState> : past.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={null} />)}
      </AppSection>
    </>
  );
}

export type CalendarTab = "bookings" | "month";

export type SharedState = { status: "loading" } | { status: "error" } | { status: "absent" } | { status: "ready"; shared: SharedCalendar };

const HUSHING = new Set(["ж", "ч", "ш", "щ", "ц"]);

/**
 * Творительный падеж имени для «Общий с Анной». Падеж выводится из окончания самого имени, а не
 * из пола: пола в контракте Friend нет, а окончание есть у любой строки. Имена, которые в русском
 * не склоняются (кончаются на -о, -е, -и, -у, -ю, -э) и всё нерусское остаются как есть — «Общий
 * с Николь» верно ровно потому, что ничего не сделано.
 */
export function instrumentalName(name: string): string {
  if (!/^[а-яё]+$/i.test(name)) return name;
  const stem = name.slice(0, -1);
  const last = name.slice(-1).toLowerCase();
  const beforeLast = stem.slice(-1).toLowerCase();
  if (last === "а") return `${stem}${HUSHING.has(beforeLast) ? "ей" : "ой"}`;
  if (last === "я") return `${stem}ей`;
  if (last === "й") return `${stem}ем`;
  if (last === "ь") return `${stem}ем`;
  if ("оеиуюэы".includes(last)) return name;
  return `${name}${HUSHING.has(last) ? "ем" : "ом"}`;
}

/** «Общий с Анной»: имена тех, кому календарь открыт; пустой календарь про совместность молчит. */
export function peersLabel(shared: SharedCalendar): string | null {
  const names = shared.peers.map((peer) => instrumentalName(peer.friend.name.split(" ")[0]));
  if (names.length === 0) return null;
  return `Общий с ${names.join(", ")}`;
}

/**
 * «Мой календарь» общего календаря — оба расписания сразу. Иначе событие друга на тот же день
 * пропадает, и пересечения не видно. Чип друга оставляет только его строки.
 */
export function filterCalendarScope(entries: CalendarDayEntry[], scope: "own" | string): CalendarDayEntry[] {
  if (scope === "own") return entries;
  const peerDays = new Set(entries.filter((entry) => entry.ownerId === scope).map((entry) => dayKey(entry.startsAt)));
  return entries.filter((entry) => entry.ownerId === scope || (entry.sources.includes("own") && peerDays.has(dayKey(entry.startsAt))));
}

export function calendarShare(shared: SharedCalendar): { text: string; link?: string } {
  const names = shared.peers.map((peer) => peer.friend.name).join(", ");
  const head = names === "" ? "Мой календарь планов в MAX Афише" : `Общий календарь планов: ${names}`;
  const param = shared.inviteUrl === null ? null : startParamFromSharedUrl(shared.inviteUrl);
  if (param !== null) return sharePayload(head, param);
  if (shared.inviteUrl !== null && /^https:\/\/([a-z0-9-]+\.)*max\.ru(\/|$)/i.test(shared.inviteUrl)) {
    return { text: `${head}\n${shared.inviteUrl}`, link: shared.inviteUrl };
  }
  return { text: head };
}

export function calendarShareText(shared: SharedCalendar): string {
  return calendarShare(shared).text;
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
  /** «Добавить друга» больше ничего не раскрывает внутри экрана — выбор живёт во всплывающем окне. */
  onAddFriend: () => void;
  notice?: string | null;
  /** Полноэкранный календарь: крест сверху и нижняя панель вместо таббара. */
  chrome?: boolean;
  onClose?: () => void;
  scope?: "own" | string;
  onSelectScope?: (scope: "own" | string) => void;
  onRemovePeer?: (userId: string) => void;
}

export function SharedCalendarView({
  shared,
  entries,
  month,
  selected,
  now,
  onSelect,
  onOpen,
  onGoing,
  onShare,
  onAddFriend,
  notice = null,
  chrome = false,
  onClose,
  scope = "own",
  onSelectScope,
  onRemovePeer,
}: SharedCalendarViewProps) {
  const dayEntries = entriesOn(entries, selected);
  const warnings = overlapWarnings(dayEntries);
  const reminder = calendarReminder(entries, now);
  const peers = shared.status === "ready" ? peersLabel(shared.shared) : null;
  const viewingOwn = scope === "own";
  const viewingPeer = shared.status === "ready" ? shared.shared.peers.find((peer) => peer.friend.id === scope) : undefined;
  return (
    <section className={chrome ? "app-cal app-cal--screen" : "app-cal"} aria-label="Календарь планов">
      {chrome && (
        <div className="app-cal-top">
          <button type="button" className="app-cal-close" aria-label="Закрыть" onClick={onClose}>
            <ActionIcon name="close" size={20} strokeWidth={2.2} />
          </button>
          <h1 className="app-cal-top-title">{viewingPeer ? viewingPeer.friend.name.split(" ")[0] : "Календарь"}</h1>
        </div>
      )}
      <div className="app-cal-scroll">
      <div className="app-cal-head">
        <h2 className="app-cal-month">{monthTitle(month)}</h2>
        <button type="button" className="app-cal-share" onClick={onShare}>
          <ActionIcon name="share" size={16} />
          Поделиться
        </button>
      </div>

      {shared.status === "error" && <AppState error>Не удалось загрузить общий календарь.</AppState>}
      {shared.status === "ready" && (shared.shared.peers.length > 0 || onSelectScope !== undefined) && (
        <div className="app-cal-peers">
          <div className="app-cal-peer-chips" role="group" aria-label="Чей календарь">
            <button type="button" className={viewingOwn ? "app-cal-peer-chip app-cal-peer-chip--on" : "app-cal-peer-chip"} aria-pressed={viewingOwn} onClick={() => onSelectScope?.("own")}>
              Мой календарь
            </button>
            {shared.shared.peers.map((peer) => (
              <span key={peer.friend.id} className={scope === peer.friend.id ? "app-cal-peer-chip app-cal-peer-chip--on" : "app-cal-peer-chip"}>
                <button type="button" className="app-cal-peer-chip-name" aria-pressed={scope === peer.friend.id} onClick={() => onSelectScope?.(peer.friend.id)}>
                  {peer.friend.name.split(" ")[0]}
                </button>
                {onRemovePeer !== undefined && (
                  <button type="button" className="app-cal-peer-drop" aria-label={`Убрать ${peer.friend.name.split(" ")[0]} из календаря`} onClick={() => onRemovePeer(peer.friend.id)}>
                    <ActionIcon name="close" size={12} strokeWidth={2.4} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {peers !== null && viewingOwn && <span className="app-cal-peers-label">{peers}</span>}
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

      {notice !== null && <p className="app-cal-reminder">{notice}</p>}
      </div>

      <div className="app-cal-cta">
        <button type="button" className="app-cal-cta-side" onClick={onShare}>
          Ссылка на календарь
        </button>
        {/* Общего календаря сервер может не уметь вовсе: тогда кнопка собирала бы нажатия ради 404. */}
        {shared.status !== "absent" && (
          <button type="button" className="app-cal-cta-main" onClick={onAddFriend}>
            Добавить друга
          </button>
        )}
      </div>
    </section>
  );
}

export function CalendarPage({ tab = "month", inviteToken, embedded = false }: { tab?: CalendarTab; inviteToken?: string; embedded?: boolean } = {}) {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<CalendarState>({ status: "loading" });
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [shared, setShared] = useState<SharedState>({ status: "loading" });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picking, setPicking] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<"own" | string>("own");

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
    const apply = (loaded: SharedCalendar) => {
      if (alive) setShared({ status: "ready", shared: loaded });
    };
    // Общего календаря на бэкенде нет вовсе — тогда блока просто нет; «не удалось» приберегаем
    // для запроса, который мог бы пройти.
    const fail = (error: unknown) => {
      if (alive) setShared({ status: isEndpointMissing(error) ? "absent" : "error" });
    };
    if (inviteToken) {
      apiClient.acceptSharedCalendarInvite(inviteToken).then(apply, () => {
        if (alive) setNotice("Приглашение не открылось. Показан твой календарь.");
        apiClient.getSharedCalendar().then(apply, fail);
      });
    } else {
      apiClient.getSharedCalendar().then(apply, fail);
    }
    apiClient.listFriends().then(
      (loaded) => {
        if (alive) setFriends(loaded);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [inviteToken]);

  const cancel = useCallback((bookingId: string) => {
    apiClient.cancelBooking(bookingId).then(
      () => setAttempt((n) => n + 1),
      () => setAttempt((n) => n + 1),
    );
  }, []);

  const entries = useMemo(() => {
    const merged = mergeCalendarEntries(state.status === "ready" ? state.entries : [], plans, shared.status === "ready" ? shared.shared : null);
    return filterCalendarScope(merged, scope);
  }, [state, plans, shared, scope]);

  const peerIds = new Set(shared.status === "ready" ? shared.shared.peers.map((peer) => peer.friend.id) : []);
  const invitable = friends.filter((friend) => !peerIds.has(friend.id));

  const going = (sharedId: string) => {
    setNotice(null);
    apiClient.joinSharedCalendarEntry(sharedId).then(
      (loaded) => setShared({ status: "ready", shared: loaded }),
      () => setNotice("Не удалось отметиться — попробуй ещё раз."),
    );
  };

  // Окно отдаёт список, потому что умеет и множественный выбор; здесь календарь открывают по одному
  // и подряд, а общий ответ сервера — последний: он и есть состояние календаря после всех приглашений.
  const invite = (friendIds: string[]) => {
    setNotice(null);
    setInviting(true);
    friendIds
      .reduce<Promise<SharedCalendar | null>>((chain, friendId) => chain.then(() => apiClient.addSharedCalendarPeer(friendId)), Promise.resolve(null))
      .then(
        (loaded) => {
          setInviting(false);
          setPicking(false);
          if (loaded !== null) setShared({ status: "ready", shared: loaded });
        },
        () => {
          setInviting(false);
          setPicking(false);
          setNotice("Не удалось открыть календарь другу.");
        },
      );
  };

  const share = () => {
    if (shared.status !== "ready") return;
    const payload = calendarShare(shared.shared);
    void shareResult(webApp, payload.text, payload.link).then(
      (channel) => setNotice(channel === "clipboard" ? "Ссылка скопирована — вставь её в чат MAX." : "Ссылка отправлена в чат MAX."),
      () => setNotice("Не удалось отправить ссылку."),
    );
  };

  const removePeer = (peerId: string) => {
    setNotice(null);
    apiClient.removeSharedCalendarPeer(peerId).then(
      (loaded) => {
        setShared({ status: "ready", shared: loaded });
        if (scope === peerId) setScope("own");
      },
      () => setNotice("Не удалось убрать друга из календаря."),
    );
  };

  return (
    <>
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
          onAddFriend={() => setPicking(true)}
          notice={notice}
          chrome={!embedded}
          onClose={() => navigate({ name: "plans" })}
          scope={scope}
          onSelectScope={setScope}
          onRemovePeer={removePeer}
        />
      ) : (
        <>
          <CalendarView state={state} now={new Date()} onCancel={cancel} onExplore={() => navigate({ name: "home" })} onExport={state.status === "ready" ? () => exportCalendarIcs(state.entries) : undefined} />
        </>
      )}
      {picking && <FriendPicker friends={invitable} title="Кого позвать в календарь" hint="Он увидит твои планы, ты — его." confirmLabel="Открыть календарь" emptyText="Все друзья уже в этом календаре." multiple busy={inviting} onConfirm={invite} onClose={() => setPicking(false)} />}
    </>
  );
}
