// START_MODULE_CONTRACT
// PURPOSE: Экран 31 «Группа „Мы“»: шесть блоков одной компании — люди, общий бюджет, ближайшие события, места, брони, маршрут дня и фотографии — под общей шапкой с названием и меню.
// SCOPE: Data via apiClient.getWeGroup/addWeGroupEvent/addWeGroupPlace/archiveWeGroup plus listEvents/listPlaces for the pickers; writes replace the screen with the returned aggregate; presentational rendering; money comes from the API budget aggregate and the agreed ceiling, never from the screen.
// DEPENDS: ../api/client.js (apiClient, ApiError, WeGroupCard), ../auth/AuthContext.js (useAuth), ./WeGroupsPage.js (WeGroupFaces, formatRub, weGroupMembersLabel), ../max/bridge.js (openExternalLink), ../routing/router.js, @max-events/api-contracts (Event, Place), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MONTH_GENITIVE - ru month in the genitive, indexed by Date#getMonth (backs «с августа 2026»)
// - weGroupSinceLabel - «с апреля 2025» — the month the company started
// - weGroupPeopleLabel - «5 участников · с апреля 2025»
// - weGroupGoingLabel - «идут все» / «идут четверо» / «пока никто не идёт» under an event
// - weGroupEventWhen - «Сегодня 20:00» / «Сб 14:00» for an event of the group
// - weGroupBookingMeta - «Сб 14:00–17:00 · оплачено» under a booking
// - WeGroupBudgetLine - what the budget hero prints: the spent-of-agreed line, the bar fill, the big number and its caption
// - weGroupBudgetLine - budget aggregate + agreed ceiling -> WeGroupBudgetLine; without a ceiling the hero shows what was spent and no bar
// - nameOf - member id -> display name («Ты» for the viewer, «Участник» for unknown)
// - WeGroupState - union of the screen fetch states (loading / error / forbidden / ready)
// - PickerKind - which catalog the picker is showing, null when closed
// - WeGroupSection - section rhythm of the screen: title plus up to two inline actions
// - WeGroupPicker - presentational catalog picker for binding an event/place
// - WeGroupView - presentational screen: topbar, people, budget, events, places, bookings, route, photos, archive
// - WeGroupPage - route container: loads the screen, wires pickers, chat, vote and archive
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import type { Event, Place } from "@max-events/api-contracts";
import { ApiError, apiClient, type WeGroupCard } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { openExternalLink } from "../max/bridge";
import { useRoute } from "../routing/router";
import { EventPicker } from "../ui/EventPicker";
import { ActionIcon } from "../ui/icons";
import { PlacePicker } from "../ui/PlacePicker";
import { pictured } from "../ui/photos";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { WeGroupFaces, formatRub, weGroupMembersLabel } from "./WeGroupsPage";

export const MONTH_GENITIVE: readonly string[] = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function weGroupSinceLabel(createdAt: string): string {
  const date = new Date(createdAt);
  return `с ${MONTH_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export function weGroupPeopleLabel(members: number, createdAt: string): string {
  return `${weGroupMembersLabel(members)} · ${weGroupSinceLabel(createdAt)}`;
}

/** Collective numerals up to seven, the way the design writes them; past that the digit reads better than the word. */
const COLLECTIVE_RU: readonly string[] = ["", "один", "двое", "трое", "четверо", "пятеро", "шестеро", "семеро"];

export function weGroupGoingLabel(going: number, members: number): string {
  if (going <= 0) return "пока никто не идёт";
  if (members > 0 && going >= members) return "идут все";
  if (going === 1) return "идёт один";
  return `идут ${COLLECTIVE_RU[going] ?? going}`;
}

function shortWeekday(date: Date): string {
  const short = date.toLocaleDateString("ru-RU", { weekday: "short" });
  return `${short.charAt(0).toUpperCase()}${short.slice(1)}`;
}

function clockTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function weGroupEventWhen(startsAt: string, now: Date): string {
  const date = new Date(startsAt);
  return `${sameDay(date, now) ? "Сегодня" : shortWeekday(date)} ${clockTime(date)}`;
}

/**
 * «Сб 14:00–17:00 · оплачено». The booking row carries no times and no payment of its own — it points
 * at an event, and the event owns both — so the line is read off the event the booking is for.
 */
export function weGroupBookingMeta(event: Event): string {
  const from = new Date(event.startsAt);
  const till = event.endsAt === null ? "" : `–${clockTime(new Date(event.endsAt))}`;
  return `${shortWeekday(from)} ${clockTime(from)}${till} · ${event.isPaid ? "оплачено" : "бесплатно"}`;
}

/** What the budget hero prints; `percent` is null when there is no agreed ceiling and therefore no bar to fill. */
export interface WeGroupBudgetLine {
  spent: string | null;
  percent: number | null;
  value: string;
  note: string;
}

/**
 * «потрачено 9 800 из 14 200 ₽» over a bar, then «4 400 ₽ свободно на ближайшие события».
 *
 * Without an agreed ceiling the same hero still works: it shows what the company already spent and
 * drops the bar, because a bar without a ceiling would be drawing a fraction of nothing.
 */
export function weGroupBudgetLine(spentRub: number, limitRub: number | null): WeGroupBudgetLine {
  if (limitRub === null || limitRub <= 0) return { spent: null, percent: null, value: formatRub(spentRub), note: "потрачено компанией" };
  const percent = Math.min(100, Math.round((spentRub / limitRub) * 100));
  return { spent: `потрачено ${spentRub.toLocaleString("ru-RU")} из ${formatRub(limitRub)}`, percent, value: formatRub(Math.max(0, limitRub - spentRub)), note: "свободно на ближайшие события" };
}

export function nameOf(members: WeGroupCard["members"], userId: string, ownId: string | null): string {
  if (ownId !== null && userId === ownId) return "Ты";
  return members.find((member) => member.id === userId)?.name ?? "Участник";
}

export type WeGroupState = { status: "loading" } | { status: "error" } | { status: "forbidden" } | { status: "ready"; card: WeGroupCard };

export type PickerKind = "event" | "place" | null;

export function WeGroupSection({ title, action, count, children }: { title: string; action?: ReactNode; count?: string; children: ReactNode }) {
  return (
    <section className="app-we-block" aria-label={title}>
      <div className="app-we-block-head">
        <h2 className="app-we-block-title">{title}</h2>
        {count !== undefined && <span className="app-we-block-count">{count}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

interface WeGroupPickerProps {
  title: string;
  options: { id: string; label: string }[];
  loading: boolean;
  failed: boolean;
  onPick: (id: string) => void;
}

/** @deprecated inline dump; the group screen uses EventPicker / PlacePicker sheets. Kept for older tests. */
export function WeGroupPicker({ title, options, loading, failed, onPick }: WeGroupPickerProps) {
  return (
    <div className="app-we-picker" role="group" aria-label={title}>
      {loading && <AppState>Загружаем каталог…</AppState>}
      {failed && <AppState error>Не удалось добавить.</AppState>}
      {!loading && options.length === 0 && <AppState>Нечего добавить.</AppState>}
      {options.map((option) => (
        <button key={option.id} type="button" className="app-we-picker-option" onClick={() => onPick(option.id)}>
          <ActionIcon name="plus" size={14} strokeWidth={2.8} />
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface WeGroupViewProps {
  state: WeGroupState;
  ownId: string | null;
  /** Injected so «Сегодня 20:00» is testable without freezing the clock. */
  now?: Date;
  menuOpen: boolean;
  picker: PickerKind;
  pickerEvents: Event[];
  pickerPlaces: Place[];
  pickerLoading: boolean;
  actionFailed: boolean;
  onBack: () => void;
  onToggleMenu: () => void;
  onTogglePicker: (kind: Exclude<PickerKind, null>) => void;
  onClosePicker: () => void;
  onPick: (id: string) => void;
  onArchive: () => void;
  onChat: (link: string) => void;
  onVote: () => void;
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
  onOpenMap: () => void;
  onAddPhoto?: () => void;
  onRetry?: () => void;
}

export function WeGroupView({ state, ownId, now = new Date(), menuOpen, picker, pickerEvents, pickerPlaces, pickerLoading, actionFailed, onToggleMenu, onTogglePicker, onClosePicker, onPick, onArchive, onChat, onVote, onOpenEvent, onOpenPlace, onOpenMap, onAddPhoto, onRetry }: WeGroupViewProps) {
  if (state.status !== "ready") {
    return (
      <section className="app-we-group" aria-label="Группа «Мы»">
        <div className="app-we-bar">
          <h1 className="app-we-bar-name">Группа</h1>
        </div>
        {state.status === "loading" && <AppSkeletonList rows={4} />}
        {state.status === "forbidden" && <AppState error>Нет доступа к группе.</AppState>}
        {state.status === "error" && (
          <AppState error action={onRetry === undefined ? undefined : { label: "Повторить", onClick: onRetry }}>
            Не удалось загрузить группу.
          </AppState>
        )}
      </section>
    );
  }

  const { card } = state;
  const { group } = card;
  const isOwner = ownId !== null && group.ownerUserId === ownId;
  const isActive = group.status === "active";
  const budget = card.budget !== null || card.budgetLimitRub !== null ? weGroupBudgetLine(card.budget?.totalRub ?? 0, card.budgetLimitRub) : null;
  const goingByEvent = new Map<string, number>();
  for (const booking of card.bookings) goingByEvent.set(booking.eventId, (goingByEvent.get(booking.eventId) ?? 0) + 1);
  const eventById = new Map(card.events.map((event) => [event.id, event]));
  const menuAvailable = isActive;

  return (
    <section className="app-we-group" aria-label="Группа «Мы»">
      <div className="app-we-bar">
        <h1 className="app-we-bar-name">{group.title}</h1>
        {menuAvailable && (
          <button type="button" className="app-we-round" aria-label="Действия группы" aria-expanded={menuOpen} onClick={onToggleMenu}>
            <ActionIcon name="dots" size={20} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {menuOpen && menuAvailable && (
        <div className="app-we-menu" role="group" aria-label="Действия группы">
          <button type="button" className="app-we-menu-item" onClick={() => onTogglePicker("event")}>
            Добавить событие
          </button>
          <button type="button" className="app-we-menu-item" onClick={() => onTogglePicker("place")}>
            Добавить место
          </button>
          {isOwner && (
            <button type="button" className="app-we-menu-item app-we-menu-item--archive" onClick={onArchive}>
              Архивировать группу
            </button>
          )}
        </div>
      )}

      {!isActive && <p className="app-we-archived">Группа в архиве: её история осталась, новые события в неё не добавить.</p>}

      <div className="app-we-people">
        <WeGroupFaces members={card.members} />
        <span className="app-we-people-text">{weGroupPeopleLabel(card.members.length, group.createdAt)}</span>
        {group.chatLink !== null && (
          <button type="button" className="app-we-chat" onClick={() => onChat(group.chatLink!)}>
            <span className="app-we-chat-mark" aria-hidden="true">
              M
            </span>
            Чат
          </button>
        )}
      </div>

      {budget !== null && (
        <section className="app-we-budget" aria-label="Общий бюджет">
          <div className="app-we-budget-head">
            <span className="app-we-budget-label">Общий бюджет</span>
            {budget.spent !== null && <span className="app-we-budget-spent">{budget.spent}</span>}
          </div>
          {budget.percent !== null && (
            <div className="app-we-budget-bar" role="img" aria-label={budget.spent ?? ""}>
              <span className="app-we-budget-fill" style={{ width: `${budget.percent}%` }} />
            </div>
          )}
          <p className="app-we-budget-value">{budget.value}</p>
          <p className="app-we-budget-note">{budget.note}</p>
        </section>
      )}

      <WeGroupSection
        title="Ближайшие события"
        action={
          <>
            {isActive && (
              <button type="button" className="app-we-block-action" onClick={onVote}>
                Голосование
              </button>
            )}
            {isActive && (
              <button type="button" className="app-we-block-action" onClick={() => onTogglePicker("event")}>
                Добавить
              </button>
            )}
          </>
        }
      >
        {picker === "event" && pickerLoading && <AppState>Загружаем каталог…</AppState>}
        {card.events.length === 0 && picker !== "event" && <p className="app-we-empty">Ещё ничего не запланировано.</p>}
        {card.events.map((event) => (
          <button key={event.id} type="button" className="app-we-row" onClick={() => onOpenEvent(event.id)}>
            <AppMedia category={event.category} src={pictured(event.id, event.coverUrl)} className="app-we-row-media" />
            <span className="app-we-row-text">
              <span className="app-we-row-title">{event.title}</span>
              <span className="app-we-row-meta">
                {weGroupEventWhen(event.startsAt, now)} · {weGroupGoingLabel(goingByEvent.get(event.id) ?? 0, card.members.length)}
              </span>
            </span>
          </button>
        ))}
      </WeGroupSection>

      <WeGroupSection
        title="Места компании"
        action={
          isActive ? (
            <button type="button" className="app-we-block-action" onClick={() => onTogglePicker("place")}>
              Добавить
            </button>
          ) : undefined
        }
      >
        {picker === "place" && pickerLoading && <AppState>Загружаем каталог…</AppState>}
        {card.places.length === 0 && picker !== "place" && <p className="app-we-empty">Сохранённых мест пока нет.</p>}
        {card.places.length > 0 && (
          <div className="app-we-pills">
            {card.places.map((place) => (
              <button key={place.id} type="button" className="app-we-pill" onClick={() => onOpenPlace(place.id)}>
                {place.title}
              </button>
            ))}
          </div>
        )}
      </WeGroupSection>

      {card.bookings.length > 0 && (
        <WeGroupSection title="Брони">
          {card.bookings.map((booking) => {
            const event = eventById.get(booking.eventId);
            return (
              <div key={booking.id} className="app-we-booking">
                <span className="app-we-booking-mark" aria-hidden="true">
                  <ActionIcon name="calendar" size={18} strokeWidth={2.2} />
                </span>
                <span className="app-we-booking-text">
                  <span className="app-we-row-title">{event?.title ?? "Бронь группы"}</span>
                  {event !== undefined && <span className="app-we-row-meta">{weGroupBookingMeta(event)}</span>}
                </span>
                <button type="button" className="app-we-block-action" onClick={() => onOpenEvent(booking.eventId)}>
                  Билет
                </button>
              </div>
            );
          })}
        </WeGroupSection>
      )}

      {card.route !== null && (
        <WeGroupSection title="Маршрут дня">
          <div className="app-we-route">
            {card.route.points.map((point, index) => (
              <span key={`${point.placeId ?? point.eventId ?? index}`} className="app-we-route-stop">
                {index > 0 && <span className="app-we-route-line" aria-hidden="true" />}
                <span className="app-we-route-name">{point.title}</span>
              </span>
            ))}
            <button type="button" className="app-we-block-action" onClick={onOpenMap}>
              Карта
            </button>
          </div>
        </WeGroupSection>
      )}

      <WeGroupSection title="Фотографии" count={card.photosTotal > 0 ? `Все ${card.photosTotal}` : undefined}>
        {card.photos.length === 0 ? (
          <AppState>Пока нет фотографий. Добавьте снимок из поездки.</AppState>
        ) : (
          <div className="app-we-photos">
            {card.photos.map((photo, index) => (
              <span key={photo.url} className={`app-we-photo app-we-photo--${(index % 5) + 1}`}>
                <img src={photo.url} alt="" loading="lazy" />
              </span>
            ))}
          </div>
        )}
        {onAddPhoto !== undefined && (
          <button type="button" className="app-we-block-action" onClick={onAddPhoto}>
            Добавить фото
          </button>
        )}
      </WeGroupSection>

      {isOwner && isActive && (
        <button type="button" className="app-we-archive" onClick={onArchive}>
          Архивировать группу
        </button>
      )}
      {actionFailed && picker === null && <AppState error>Действие не удалось.</AppState>}
      {picker === "event" && !pickerLoading && (
        <EventPicker title="События группы" events={pickerEvents} selectedId={null} onPick={(event) => onPick(event.id)} onClose={onClosePicker} />
      )}
      {picker === "place" && !pickerLoading && (
        <PlacePicker title="Места компании" places={pickerPlaces} selectedId={null} onPick={(place) => onPick(place.id)} onClose={onClosePicker} />
      )}
    </section>
  );
}

export function WeGroupPage({ id }: { id: string }) {
  const { navigate, back } = useRoute();
  const auth = useAuth();
  const ownId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<WeGroupState>({ status: "loading" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [catalog, setCatalog] = useState<{ events: Event[]; places: Place[] } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getWeGroup(id).then(
      (card) => {
        if (alive) setState({ status: "ready", card });
      },
      (error) => {
        if (!alive) return;
        setState(error instanceof ApiError && error.status === 403 ? { status: "forbidden" } : { status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const apply = (card: WeGroupCard) => {
    setState({ status: "ready", card });
    setPicker(null);
    setMenuOpen(false);
    setActionFailed(false);
  };

  const fail = () => setActionFailed(true);

  const togglePicker = (kind: Exclude<PickerKind, null>) => {
    setActionFailed(false);
    setMenuOpen(false);
    if (picker === kind) {
      setPicker(null);
      return;
    }
    setPicker(kind);
    if (catalog !== null) return;
    setPickerLoading(true);
    Promise.all([apiClient.listEvents(), apiClient.listPlaces()]).then(
      ([events, places]) => {
        setCatalog({ events, places });
        setPickerLoading(false);
      },
      () => {
        setPickerLoading(false);
        setActionFailed(true);
      },
    );
  };

  const pickerEvents = (): Event[] => {
    if (catalog === null || state.status !== "ready") return [];
    const bound = new Set(state.card.events.map((item) => item.id));
    return catalog.events.filter((item) => !bound.has(item.id));
  };

  const pickerPlaces = (): Place[] => {
    if (catalog === null || state.status !== "ready") return [];
    const bound = new Set(state.card.places.map((item) => item.id));
    return catalog.places.filter((item) => !bound.has(item.id));
  };

  const pick = (itemId: string) => {
    if (picker === null) return;
    const request = picker === "event" ? apiClient.addWeGroupEvent(id, itemId) : apiClient.addWeGroupPlace(id, itemId);
    request.then(apply, fail);
  };

  const addPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") apiClient.addWeGroupPhoto(id, reader.result).then(apply, fail);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <WeGroupView
      state={state}
      ownId={ownId}
      menuOpen={menuOpen}
      picker={picker}
      pickerEvents={pickerEvents()}
      pickerPlaces={pickerPlaces()}
      pickerLoading={pickerLoading}
      actionFailed={actionFailed}
      onBack={back}
      onToggleMenu={() => setMenuOpen((value) => !value)}
      onTogglePicker={togglePicker}
      onClosePicker={() => setPicker(null)}
      onPick={pick}
      onArchive={() => apiClient.archiveWeGroup(id).then(apply, fail)}
      onChat={openExternalLink}
      onVote={() => navigate({ name: "vote-new", groupId: id })}
      onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })}
      onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })}
      onOpenMap={() => navigate({ name: "map" })}
      onAddPhoto={addPhoto}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}
