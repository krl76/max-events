// START_MODULE_CONTRACT
// PURPOSE: «Управление событием» (макет, экран 47): the counters of the day, the participants, the waitlist, the venue slots and the check-in by entry code.
// SCOPE: Pure helpers plus OrganizerEventManageView (presentational) and OrganizerEventManage (container over apiClient.getOrganizerAttendance / checkInOrganizerGuest / inviteFromOrganizerWaitlist). The freed-seats card is itself the confirmation: it asks the question out loud and only its dark-filled verb sends the invitation, which cannot be recalled.
// DEPENDS: react, ../api/client.js (apiClient, OrganizerAttendance, OrganizerEvent, OrganizerParticipant, OrganizerSlot, OrganizerWaitlistEntry), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ManageScreen - hub | participants | tickets | checkin | stats | reviews
// - splitParticipants - the roster in the two groups the design names: «Отметились» and «Ждём»
// - fillPercent - booked against capacity, 0..100; 0 without a capacity, because an uncapped event has no fill
// - formatArrival - «на месте с 13:52» — neutral wording: the roster carries no gender
// - formatBookedAgo - «запись 2 дня назад», «запись сегодня»
// - formatSlot - «14:00–17:00 · занят»
// - participantInitial - the letter of the round avatar
// - guestsNote - «+1 гость» / «+2 гостя», empty string without companions
// - OrganizerEventManageView - hub plus participants, tickets, check-in and stats
// - OrganizerEventManage - container: attendance, options, check-in by code, publish and share
// END_MODULE_MAP

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { OrganizerEventStats } from "@max-events/api-contracts";
import { apiClient, organizerEntryCode, type EventRating, type EventMoodTag, type OrganizerAttendance, type OrganizerEvent, type OrganizerEventOptions, type OrganizerEventReview, type OrganizerParticipant, type OrganizerSlot, type OrganizerWaitlistEntry } from "../api/client";
import { pluralRu } from "../catalog/format";
import { EventMoodTags } from "../event/EventScreen";
import { CATEGORY_SCORE_LABELS, RatingView } from "../event/ReviewSection";
import { getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { SettingsGroup } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppButton, AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { ConfirmSheet } from "../ui/ConfirmSheet";

export type ManageScreen = "hub" | "participants" | "tickets" | "checkin" | "stats" | "reviews";

export const REVIEW_FACT_LABELS: Record<string, string> = {
  calm: "Спокойно",
  kids_ok: "С детьми ок",
  crowded: "Многолюдно",
  pricey: "Дорого",
  beginner_friendly: "Новичкам легко",
};

export function reviewVerdict(stars: number, wouldGoAgain: boolean): string {
  if (wouldGoAgain) return "Ещё раз";
  if (stars >= 5) return "Отлично";
  if (stars >= 3) return "Норм";
  return "Не моё";
}

export function reviewRecommendShare(rows: OrganizerEventReview[]): number | null {
  if (rows.length === 0) return null;
  return Math.round((rows.filter((row) => row.wouldGoAgain).length / rows.length) * 100);
}

export function splitParticipants(participants: OrganizerParticipant[]): { arrived: OrganizerParticipant[]; expected: OrganizerParticipant[] } {
  return { arrived: participants.filter((row) => row.checkedInAt !== null), expected: participants.filter((row) => row.checkedInAt === null) };
}

/** An event without a capacity has no fill to show: the bar would claim a limit the organizer never set. */
export function fillPercent(booked: number, capacity: number | null): number {
  if (capacity === null || capacity <= 0) return 0;
  return Math.min(Math.round((booked / capacity) * 100), 100);
}

function hhmm(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Neutral by design: the roster knows a name, never a gender, and «пришла/пришёл» would have to guess. */
export function formatArrival(checkedInAt: string): string {
  return `на месте с ${hhmm(checkedInAt)}`;
}

export function formatBookedAgo(bookedAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(bookedAt).getTime()) / 86_400_000);
  if (days <= 0) return "запись сегодня";
  if (days === 1) return "запись вчера";
  if (days < 7) return `запись ${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  return `запись ${new Date(bookedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

export function formatSlot(slot: OrganizerSlot): string {
  return `${hhmm(slot.startsAt)}–${hhmm(slot.endsAt)} · ${slot.busy ? "занят" : "свободен"}`;
}

export function participantInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function guestsNote(guests: number): string {
  return guests === 0 ? "" : `+${guests} ${pluralRu(guests, "гость", "гостя", "гостей")}`;
}

function PersonRow({ name, note, code, action }: { name: string; note: string; code?: string; action: ReactNode }) {
  return (
    <div className="app-org-person">
      <span className="app-org-person-avatar" aria-hidden="true">
        {participantInitial(name)}
      </span>
      <span className="app-org-person-body">
        <span className="app-org-person-name">{name}</span>
        {note !== "" && <span className="app-org-person-note">{note}</span>}
      </span>
      {code !== undefined && code !== "" && <span className="app-org-person-code">{code}</span>}
      {action}
    </div>
  );
}

type ParticipantFilter = "all" | "in" | "out" | "wait";

export function participantNote(row: OrganizerParticipant): string {
  if (row.checkedInAt !== null) return formatArrival(row.checkedInAt);
  return guestsNote(row.guests);
}

export function participantFilterCounts(attendance: OrganizerAttendance | null): Record<ParticipantFilter, number> {
  const people = attendance?.participants ?? [];
  const arrived = people.filter((row) => row.checkedInAt !== null).length;
  return { all: people.length, in: arrived, out: people.length - arrived, wait: attendance?.waitlist.length ?? 0 };
}

function sameDay(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function publicationLabel(event: OrganizerEvent, now = new Date()): string {
  if (event.draft) return "Черновик";
  const end = new Date(event.endsAt ?? event.startsAt).getTime();
  if (end < now.getTime() && !sameDay(event.startsAt, now)) return "Завершено";
  return "Опубликовано";
}

function metricLine(event: OrganizerEvent, attendance: OrganizerAttendance | null, options: OrganizerEventOptions | null): string {
  const booked = attendance?.bookedCount;
  const seats = booked === undefined ? "нет данных" : event.capacity === null ? String(booked) : `${booked} из ${event.capacity}`;
  if (event.isPaid) return `Записи: ${seats}. Оплата проходит на внешнем сайте, сумма заказа в кабинет не приходит.`;
  const waiting = options?.waitlistEnabled ? ` · в листе ожидания ${attendance?.waitlistCount ?? 0}` : "";
  return `Зарегистрировано: ${seats}${waiting}`;
}

interface OrganizerEventManageViewProps {
  event: OrganizerEvent;
  attendance: OrganizerAttendance | null;
  options: OrganizerEventOptions | null;
  stats: OrganizerEventStats | null;
  rating: EventRating | null;
  moods: EventMoodTag[];
  reviews: OrganizerEventReview[] | null;
  screen: ManageScreen;
  query: string;
  filter: ParticipantFilter;
  code: string;
  busy: boolean;
  publishing: boolean;
  unpublishing: boolean;
  confirmUnpublish: boolean;
  notice: string | null;
  failed: string | null;
  onScreen: (screen: ManageScreen) => void;
  onQuery: (query: string) => void;
  onFilter: (filter: ParticipantFilter) => void;
  onCode: (code: string) => void;
  onSubmitCode: () => void;
  onCheckIn: (row: OrganizerParticipant) => void;
  onInvite: () => void;
  onRefresh: () => void;
  onPromo: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onAskUnpublish: () => void;
  onCancelUnpublish: () => void;
  onShare: () => void;
}

function HubRow({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="app-set-row" onClick={onClick}>
      <span className="app-set-row-text">
        <span className="app-set-row-title">{title}</span>
        <span className="app-set-row-hint">{hint}</span>
      </span>
      <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
    </button>
  );
}

export function OrganizerEventManageView({ event, attendance, options, stats, rating, moods, reviews, screen, query, filter, code, busy, publishing, unpublishing, confirmUnpublish, notice, failed, onScreen, onQuery, onFilter, onCode, onSubmitCode, onCheckIn, onInvite, onRefresh, onPromo, onEdit, onPublish, onUnpublish, onAskUnpublish, onCancelUnpublish, onShare }: OrganizerEventManageViewProps) {
  const waitlist: OrganizerWaitlistEntry[] = attendance?.waitlist ?? [];
  const when = `${new Date(event.startsAt).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · ${hhmm(event.startsAt)}`;
  const now = new Date();
  const today = !event.draft && sameDay(event.startsAt, now);
  const past = !event.draft && !today && new Date(event.endsAt ?? event.startsAt).getTime() < now.getTime();
  const booked = attendance?.bookedCount;
  const needle = query.trim().toLowerCase();
  const participants = (attendance?.participants ?? []).filter((row) => {
    const codeText = organizerEntryCode(row.bookingId);
    const matches = needle === "" || row.name.toLowerCase().includes(needle) || codeText.toLowerCase().includes(needle);
    if (!matches) return false;
    if (filter === "in") return row.checkedInAt !== null;
    if (filter === "out") return row.checkedInAt === null;
    return filter !== "wait";
  });
  const waiting = waitlist.filter((row) => needle === "" || row.name.toLowerCase().includes(needle));
  return (
    <section className="app-gathering" aria-label="Управление событием">
      {screen === "hub" && (
        <>
          <article className="app-card app-card--row">
            <AppMedia category={event.category} src={pictured(event.id, event.coverUrl)} />
            <div className="app-card-body">
              <span className="app-micro-badge">{publicationLabel(event)}</span>
              <span className="app-card-title">{event.title}</span>
              <span className="app-card-subtitle">{when}</span>
              {event.city !== "" && <span className="app-card-subtitle">{event.city}</span>}
            </div>
          </article>
          <p className="app-gathering-hint">{metricLine(event, attendance, options)}</p>
          <SettingsGroup title="Гости">
            <HubRow title="Участники" hint={booked === undefined ? "Список загружается" : `${booked} ${pluralRu(booked, "регистрация", "регистрации", "регистраций")}`} onClick={() => onScreen("participants")} />
            <HubRow title="Билеты и регистрация" hint={event.isPaid ? "Оплата на внешнем сайте" : "Бесплатная запись в приложении"} onClick={() => onScreen("tickets")} />
            <HubRow
              title="Отзывы"
              hint={rating === null || rating.summary.reviewsCount === 0 ? "Гости оставляют их после события" : `${rating.summary.averageStars.toFixed(1).replace(".", ",")} · ${rating.summary.reviewsCount} ${pluralRu(rating.summary.reviewsCount, "отзыв", "отзыва", "отзывов")}`}
              onClick={() => onScreen("reviews")}
            />
          </SettingsGroup>
          <SettingsGroup title="Событие">
            <HubRow title="Редактировать" hint="Обложка, дата, место и способ участия" onClick={onEdit} />
            <HubRow title="Продвижение" hint="Лента, подборка, код, друг, ранний доступ" onClick={onPromo} />
            <HubRow title="Статистика" hint="Регистрации и отмены этого события" onClick={() => onScreen("stats")} />
            {!event.draft && <HubRow title="Поделиться" hint="Ссылка откроет карточку в афише" onClick={onShare} />}
            {event.chatLink !== null && <HubRow title="Чат события" hint="Открыть чат MAX" onClick={() => window.open(event.chatLink!, "_blank", "noopener")} />}
            {event.draft ? (
              <button type="button" className="app-set-row" disabled={publishing} onClick={onPublish}>
                <span className="app-set-row-text">
                  <span className="app-set-row-title">{publishing ? "Публикация…" : "Опубликовать"}</span>
                  <span className="app-set-row-hint">Сразу появится в афише</span>
                </span>
              </button>
            ) : (
              <button type="button" className="app-set-row" disabled={unpublishing} onClick={onAskUnpublish}>
                <span className="app-set-row-text">
                  <span className="app-set-row-title">Снять с публикации</span>
                  <span className="app-set-row-hint">Событие уйдёт в черновики</span>
                </span>
              </button>
            )}
          </SettingsGroup>
          {event.draft && (
            <AppButton stretched disabled={publishing} onClick={onEdit}>
              Продолжить подготовку
            </AppButton>
          )}
          {!event.draft && today && (
            <AppButton stretched onClick={() => onScreen("checkin")}>
              Контроль входа
            </AppButton>
          )}
          {!event.draft && past && (
            <AppButton stretched onClick={() => onScreen("reviews")}>
              Смотреть отзывы
            </AppButton>
          )}
          {!event.draft && !today && !past && (
            <AppButton stretched onClick={onShare}>
              Поделиться событием
            </AppButton>
          )}
          {notice !== null && <p className="app-org-notice">{notice}</p>}
          {failed !== null && <AppState error>{failed}</AppState>}
          {confirmUnpublish && <ConfirmSheet title="Снять событие с афиши?" confirmLabel="Да, снять" onConfirm={onUnpublish} onClose={onCancelUnpublish} />}
        </>
      )}
      {screen === "tickets" && (
        <>
          <SettingsGroup title="Участие">
            <div className="app-set-row">
              <span className="app-set-row-text">
                <span className="app-set-row-title">{event.isPaid ? "Покупка на другом сайте" : "Бесплатно по регистрации"}</span>
                <span className="app-set-row-hint">{event.isPaid ? "Гость уходит по вашей ссылке" : "Гость записывается в приложении"}</span>
              </span>
            </div>
            {event.isPaid ? (
              <>
                <div className="app-set-row">
                  <span className="app-set-row-text">
                    <span className="app-set-row-title">Цена</span>
                    <span className="app-set-row-hint">{event.priceRub === null ? "Указана на вашей стороне" : `${event.priceRub.toLocaleString("ru-RU")} ₽`}</span>
                  </span>
                </div>
                {event.paymentUrl !== null && (
                  <a className="app-set-row" href={event.paymentUrl} target="_blank" rel="noreferrer">
                    <span className="app-set-row-text">
                      <span className="app-set-row-title">Проверить ссылку</span>
                      <span className="app-set-row-hint">Переход не считается покупкой</span>
                    </span>
                    <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="app-set-row">
                  <span className="app-set-row-text">
                    <span className="app-set-row-title">Лимит</span>
                    <span className="app-set-row-hint">{event.capacity === null ? "без предела" : String(event.capacity)}</span>
                  </span>
                </div>
                <div className="app-set-row">
                  <span className="app-set-row-text">
                    <span className="app-set-row-title">Лист ожидания</span>
                    <span className="app-set-row-hint">{options?.waitlistEnabled ? "включён" : "выключен"}</span>
                  </span>
                </div>
              </>
            )}
          </SettingsGroup>
          <AppButton tone="secondary" stretched onClick={onEdit}>
            Изменить способ участия
          </AppButton>
        </>
      )}
      {screen === "participants" && (
        <>
          {today && (
            <div className="app-set-group">
              <HubRow title="Контроль входа" hint={attendance === null ? "Код с билета" : `Пришли ${attendance.checkedInCount} из ${attendance.bookedCount}`} onClick={() => onScreen("checkin")} />
            </div>
          )}
          {attendance !== null && attendance.freedSeats > 0 && waitlist.length > 0 && (
            <div className="app-org-offer">
              <span className="app-org-offer-title">
                Освободилось {attendance.freedSeats} {pluralRu(attendance.freedSeats, "место", "места", "мест")}
              </span>
              <AppButton stretched disabled={busy} onClick={onInvite}>
                Позвать {Math.min(attendance.freedSeats, waitlist.length)}
              </AppButton>
            </div>
          )}
          <input className="app-profile-input" aria-label="Поиск участника" placeholder="Имя или код" value={query} onChange={(change) => onQuery(change.target.value)} />
          <div className="app-evt-filters" role="tablist" aria-label="Статус входа">
            {(
              [
                ["all", "Все"],
                ["in", "Пришли"],
                ["out", "Не пришли"],
                ["wait", "Лист"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "app-evt-filter app-evt-filter--on" : "app-evt-filter"} onClick={() => onFilter(id)}>
                {label} {participantFilterCounts(attendance)[id]}
              </button>
            ))}
          </div>
          {attendance === null && <AppSkeletonList rows={3} />}
          {notice !== null && <p className="app-org-notice">{notice}</p>}
          {failed !== null && <AppState error>{failed}</AppState>}
          {attendance !== null && filter !== "wait" && participants.length === 0 && booked === 0 && (
            <>
              <AppState>Пока никто не зарегистрировался.</AppState>
              <AppButton tone="secondary" stretched onClick={onShare}>
                Поделиться событием
              </AppButton>
            </>
          )}
          {attendance !== null && filter !== "wait" && participants.length === 0 && (booked ?? 0) > 0 && <AppState>В этом фильтре никого нет.</AppState>}
          {filter !== "wait" &&
            participants.map((row) => (
              <PersonRow
                key={row.bookingId}
                name={row.name}
                note={participantNote(row)}
                code={organizerEntryCode(row.bookingId)}
                action={
                  row.checkedInAt === null ? (
                    <button type="button" className="app-org-person-action" disabled={busy} onClick={() => onCheckIn(row)}>
                      Отметить
                    </button>
                  ) : (
                    <span className="app-micro-badge">Пришёл</span>
                  )
                }
              />
            ))}
          {filter === "wait" && waiting.length === 0 && <AppState>Лист ожидания пуст.</AppState>}
          {filter === "wait" && waiting.map((row) => <PersonRow key={row.entryId} name={row.name} note={guestsNote(row.guests)} action={<span className="app-micro-badge">Ждёт</span>} />)}
        </>
      )}
      {screen === "checkin" && (
        <>
          <p className="app-org-scan-count">{attendance === null ? "—" : `${attendance.checkedInCount} из ${attendance.bookedCount}`}</p>
          <form
            className="app-org-scan-form"
            onSubmit={(submit) => {
              submit.preventDefault();
              onSubmitCode();
            }}
          >
            <input className="app-org-field-input" aria-label="Код входа" placeholder="Код с билета" value={code} autoFocus onChange={(change) => onCode(change.target.value)} />
            <AppButton stretched type="submit" disabled={busy || code.trim() === ""}>
              Отметить вход
            </AppButton>
          </form>
          {notice !== null && <p className="app-org-notice">{notice}</p>}
          {failed !== null && <AppState error>{failed}</AppState>}
          <AppButton tone="secondary" stretched onClick={() => onScreen("participants")}>
            Найти в списке
          </AppButton>
        </>
      )}
      {screen === "stats" && (
        <>
          <h1 className="app-section-title">Статистика события</h1>
          <p className="app-gathering-hint">Цифры только этого события. Оплата на внешнем сайте покупкой здесь не считается.</p>
          {stats === null && failed === null && <AppSkeletonList rows={3} />}
          {failed !== null && <AppState error>{failed}</AppState>}
          {stats !== null && (
            <div className="app-org-tiles">
              <div className="app-org-tile">
                <span className="app-org-tile-label">Просмотры страниц</span>
                <span className="app-org-tile-big">{stats.views > 0 ? stats.views : "Нет данных"}</span>
              </div>
              <div className="app-org-tile">
                <span className="app-org-tile-label">Регистрации</span>
                <span className="app-org-tile-big">{stats.bookings}</span>
              </div>
              <div className="app-org-tile">
                <span className="app-org-tile-label">Отмены</span>
                <span className="app-org-tile-big">{stats.cancellations}</span>
              </div>
              {event.isPaid && (
                <div className="app-org-tile">
                  <span className="app-org-tile-label">Записи на платное событие</span>
                  <span className="app-org-tile-big">{stats.paidBookings}</span>
                </div>
              )}
            </div>
          )}
          {event.isPaid && <p className="app-gathering-hint">Число записей на платное событие не подтверждает, что деньги дошли.</p>}
          {rating !== null && rating.summary.reviewsCount > 0 && (
            <AppButton tone="secondary" stretched onClick={() => onScreen("reviews")}>
              Отзывы гостей
            </AppButton>
          )}
        </>
      )}
      {screen === "reviews" && (
        <>
          {reviews === null && failed === null && <AppSkeletonList rows={3} />}
          {failed !== null && <AppState error>{failed}</AppState>}
          {reviews !== null && reviews.length === 0 && <AppState>Отзывов пока нет. Гости оставляют их после события, на котором были.</AppState>}
          {reviews !== null && reviews.length > 0 && reviews.length < 3 && <p className="app-gathering-hint">Гостям рейтинг откроется с третьего отзыва.</p>}
          {rating !== null && <RatingView rating={rating} />}
          {reviewRecommendShare(reviews ?? []) !== null && <p className="app-set-row-hint">{reviewRecommendShare(reviews ?? [])}% пойдут ещё раз</p>}
          <EventMoodTags tags={moods} />
          {reviews !== null &&
            reviews.map((row) => (
              <article key={row.id} className="app-set-group">
                <div className="app-set-row">
                  <span className="app-set-row-text">
                    <span className="app-set-row-title">{row.name}</span>
                    <span className="app-set-row-hint">
                      {reviewVerdict(row.stars, row.wouldGoAgain)} · {row.stars} ★ · {new Date(row.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                </div>
                {(Object.keys(row.categoryScores) as Array<keyof typeof CATEGORY_SCORE_LABELS>).filter((key) => row.categoryScores[key] !== undefined).length > 0 && (
                  <p className="app-set-row-hint">
                    {(Object.keys(CATEGORY_SCORE_LABELS) as Array<keyof typeof CATEGORY_SCORE_LABELS>)
                      .filter((key) => row.categoryScores[key] !== undefined)
                      .map((key) => `${CATEGORY_SCORE_LABELS[key]} ${row.categoryScores[key]}`)
                      .join(" · ")}
                  </p>
                )}
                {row.factTags.length > 0 && <p className="app-set-row-hint">{row.factTags.map((tag) => REVIEW_FACT_LABELS[tag] ?? tag).join(" · ")}</p>}
                {row.text !== null && row.text !== "" && <p className="app-gathering-hint">{row.text}</p>}
              </article>
            ))}
        </>
      )}
    </section>
  );
}

export function OrganizerEventManage({ event, screen, onScreen, onPromo, onEdit, onPublished }: { event: OrganizerEvent; screen: ManageScreen; onScreen: (screen: ManageScreen) => void; onPromo: () => void; onEdit: () => void; onPublished: (event: OrganizerEvent) => void }) {
  const [attendance, setAttendance] = useState<OrganizerAttendance | null>(null);
  const [options, setOptions] = useState<OrganizerEventOptions | null>(null);
  const [stats, setStats] = useState<OrganizerEventStats | null>(null);
  const [rating, setRating] = useState<EventRating | null>(null);
  const [moods, setMoods] = useState<EventMoodTag[]>([]);
  const [reviews, setReviews] = useState<OrganizerEventReview[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParticipantFilter>("all");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerAttendance(event.id).then(
      (payload) => {
        if (alive) setAttendance(payload);
      },
      () => {
        if (alive) setFailed("Не удалось загрузить участников.");
      },
    );
    apiClient.getOrganizerEventOptions(event.id).then(
      (payload) => {
        if (alive) setOptions(payload);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [event.id, reloads]);

  useEffect(() => {
    if (screen !== "stats") return;
    let alive = true;
    setStats(null);
    apiClient.getOrganizerEventStats(event.id).then(
      (payload) => {
        if (alive) setStats(payload);
      },
      () => {
        if (alive) setFailed("Не удалось загрузить статистику события.");
      },
    );
    return () => {
      alive = false;
    };
  }, [event.id, screen]);

  useEffect(() => {
    let alive = true;
    apiClient.getEventRating(event.id).then(
      (payload) => {
        if (alive) setRating(payload);
      },
      () => {
        if (alive) setRating(null);
      },
    );
    apiClient.listEventMoodTags(event.id).then(
      (payload) => {
        if (alive) setMoods(payload);
      },
      () => {
        if (alive) setMoods([]);
      },
    );
    apiClient.listOrganizerEventReviews(event.id).then(
      (payload) => {
        if (alive) setReviews(payload);
      },
      () => {
        if (alive) setReviews([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [event.id]);

  const reload = useCallback(() => {
    setReloads((value) => value + 1);
  }, []);

  const checkIn = (entryCode: string) => {
    setBusy(true);
    setFailed(null);
    apiClient.checkInOrganizerGuest(event.id, entryCode).then(
      (row) => {
        setBusy(false);
        setCode("");
        setNotice(`Билет действителен. Вход отмечен. ${row.name}`);
        reload();
      },
      () => {
        setBusy(false);
        setNotice(null);
        setFailed("Не удалось проверить билет. Повторить.");
      },
    );
  };

  return (
    <OrganizerEventManageView
      event={event}
      attendance={attendance}
      options={options}
      stats={stats}
      rating={rating}
      moods={moods}
      reviews={reviews}
      screen={screen}
      query={query}
      filter={filter}
      code={code}
      busy={busy}
      publishing={publishing}
      unpublishing={unpublishing}
      confirmUnpublish={confirmUnpublish}
      notice={notice}
      failed={failed}
      onScreen={onScreen}
      onQuery={setQuery}
      onFilter={setFilter}
      onCode={setCode}
      onSubmitCode={() => checkIn(code)}
      onCheckIn={(row) => checkIn(organizerEntryCode(row.bookingId))}
      onInvite={() => {
        if (attendance === null) return;
        setBusy(true);
        apiClient.inviteFromOrganizerWaitlist(event.id, Math.min(attendance.freedSeats, attendance.waitlist.length)).then(
          (result) => {
            setBusy(false);
            setNotice(`Приглашение ушло: ${result.invited}`);
            reload();
          },
          () => {
            setBusy(false);
            setFailed("Не удалось позвать из листа ожидания.");
          },
        );
      }}
      onRefresh={reload}
      onPromo={onPromo}
      onEdit={onEdit}
      onPublish={() => {
        setPublishing(true);
        setFailed(null);
        const placeReady = event.placeId === null ? Promise.resolve() : apiClient.publishOrganizerPlace(event.placeId).then(() => undefined);
        placeReady
          .then(() => apiClient.publishOrganizerEvent(event.id))
          .then(
            (item) => {
              setPublishing(false);
              setNotice("Событие опубликовано.");
              onPublished(item);
            },
            () => {
              setPublishing(false);
              setFailed("Не удалось опубликовать.");
            },
          );
      }}
      onAskUnpublish={() => setConfirmUnpublish(true)}
      onCancelUnpublish={() => setConfirmUnpublish(false)}
      onUnpublish={() => {
        setConfirmUnpublish(false);
        setUnpublishing(true);
        setFailed(null);
        apiClient.unpublishOrganizerEvent(event.id).then(
          (item) => {
            setUnpublishing(false);
            setNotice("Событие снято с афиши.");
            onPublished(item);
          },
          () => {
            setUnpublishing(false);
            setFailed("Не удалось снять с публикации.");
          },
        );
      }}
      onShare={() => {
        const payload = sharePayload(event.title, `event-${event.id}`);
        void shareResult(getWebApp(), payload.text, payload.link).then((channel) => {
          setNotice(channel === "clipboard" ? "Ссылка скопирована." : channel === "bridge" ? "Ссылка отправлена." : "Поделиться не получилось.");
        });
      }}
    />
  );
}
