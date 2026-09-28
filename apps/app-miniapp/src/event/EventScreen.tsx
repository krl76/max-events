// START_MODULE_CONTRACT
// PURPOSE: Экран 17 «Карточка события»: the gradient hero with the seat counter, the date row, the hourly weather strip, the route card, the organizer card with its rating, the «Кто идёт» row, «О событии», «Обстановка», «Рядом» and the sticky booking bar.
// SCOPE: Presentational blocks and the pure formatting behind them; every request, every navigation and every mutation is the caller's (./EventPage.tsx). No state beyond what a block is handed.
// DEPENDS: ../api/client.js (EventDetails, EventForecast, EventMoodTag, EventNearbySpot, EventCompanions, TravelOption), @max-events/api-contracts (OrganizerRating), ../catalog/format.js (CATEGORY_LABELS, pluralRu), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - formatDateBadge - «СЕН» / «19» of the date tile: the short month uppercased and the day
// - formatDayLine - «Суббота, 19 сентября»
// - formatTimeRange - «14:00 – 18:00»; a single time when the event has no end
// - formatPrice - «Бесплатно» / «1 800 ₽» of the price pill
// - formatTemperature - signed degrees of one weather column
// - forecastGlyph - WMO code -> the strip glyph (rain / cloud / sun)
// - formatHour - «14:00» label of one weather column
// - formatDistance - «200 м» below a kilometre, «2,1 км» above it
// - formatTravel - «2,1 км · 18 мин пешком» under the address
// - seatOccupancy - taken/capacity of an event with a capacity, null without one
// - bookingCtaLabel - the sticky CTA: «Записаться · осталось 4» / «Вы записаны» / «Мест нет» / «Запись по промокоду»
// - initials - two-letter mark of an organization or a person
// - moodTagLabel - «Спокойно · 12»
// - organizerEventsLabel - «34 события в афише»
// - EventHero - gradient header: back/share/save circles, the media square, the title and the seat counter
// - EventWhenRow - date tile, the weekday line with the time range and the price pill
// - EventForecastCard - the hourly strip with its attribution and the warning under it
// - EventRouteCard - address, distance and «Проложить маршрут»
// - EventOrganizerCard - organizer mark, name, subscribe control, the rating numbers or the «Рейтинга пока нет» tile
// - EventWhoGoesRow - «Кто идёт N» with the faces and the chevron into экран 23
// - EventMoodTags - the «Обстановка» pills
// - EventNearbyList - the «Рядом» rows
// - EventBookingBar - sticky bottom bar: the chat square (only for an event that has a chat) and the booking CTA
// END_MODULE_MAP

import type { ReactNode } from "react";
import { useSheetSwipe } from "../ui/sheet";
import type { OrganizerRating } from "@max-events/api-contracts";
import type { EventCompanions, EventDetails, EventForecast, EventMoodTag, EventNearbySpot, EventWeatherHour, TravelOption } from "../api/client";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { pictured } from "../ui/photos";

/** «СЕН» / «19». Intl gives «сент.» for the short month, and the tile wants three letters in caps. */
export function formatDateBadge(startsAt: string): { month: string; day: string } {
  const date = new Date(startsAt);
  return { month: date.toLocaleDateString("ru-RU", { month: "short" }).slice(0, 3).toUpperCase(), day: date.toLocaleDateString("ru-RU", { day: "numeric" }) };
}

export function formatDayLine(startsAt: string): string {
  const date = new Date(startsAt);
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

const clockTime = (iso: string): string => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** An event without an end time says when it starts and stops there — «14:00 – ?» would be worse than silence. */
export function formatTimeRange(startsAt: string, endsAt: string | null): string {
  return endsAt === null ? clockTime(startsAt) : `${clockTime(startsAt)} – ${clockTime(endsAt)}`;
}

export function formatPrice(event: Pick<EventDetails["event"], "isPaid" | "priceRub">): string {
  return event.isPaid && event.priceRub !== null ? `${event.priceRub.toLocaleString("ru-RU")} ₽` : "Бесплатно";
}

export function formatTemperature(temperatureC: number): string {
  const rounded = Math.round(temperatureC);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

/**
 * WMO code -> glyph. Open-Meteo groups everything wet from 51 up (drizzle, rain, snow, showers,
 * thunder), 1–3 is the cloudy band and 0 alone is a clear sky, so three glyphs cover the strip.
 */
export function forecastGlyph(conditionCode: number): ActionIconName {
  if (conditionCode >= 51) return "rain";
  return conditionCode === 0 ? "sun" : "weather";
}

export function formatHour(at: string): string {
  return clockTime(at);
}

/** «200 м» is a landmark you can see; «0,2 км» is a rounding artefact, so metres stay metres below a kilometre. */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} м`;
  return `${(distanceM / 1000).toFixed(1).replace(".", ",")} км`;
}

const TRAVEL_MODE_LABELS: Record<TravelOption["mode"], string> = { walk: "пешком", metro: "на метро" };
const WALK_MINUTE_CAP = 90;
const FAR_KM = 80;

/** «2,1 км · 18 мин пешком». Past 80 km the line is «далеко». From the city center the kilometers say so. */
export function formatTravel(option: TravelOption, fromCenter = false): string {
  const tail = fromCenter ? " от центра" : "";
  if (option.distanceKm !== null && option.distanceKm > FAR_KM) return fromCenter ? "далеко от центра" : "далеко";
  const walkTooLong = option.mode === "walk" && option.minutes > WALK_MINUTE_CAP;
  const time = walkTooLong ? null : `${option.minutes} мин ${TRAVEL_MODE_LABELS[option.mode]}`;
  const distance = option.distanceKm === null ? null : `${option.distanceKm.toFixed(1).replace(".", ",")} км${tail}`;
  return [distance, time].filter((part): part is string => part !== null).join(" · ");
}

/**
 * How full the event is. Capacity and free seats are the only two numbers the aggregate carries, so
 * the занято count is their difference; an event without a capacity has no ratio to show at all and
 * gets null rather than an invented denominator.
 */
export function seatOccupancy(details: Pick<EventDetails, "remainingSeats"> & { event: Pick<EventDetails["event"], "capacity"> }): { taken: number; capacity: number } | null {
  const { capacity } = details.event;
  if (capacity === null || details.remainingSeats === null) return null;
  return { taken: Math.max(0, capacity - details.remainingSeats), capacity };
}

/** «Занято 1 место из 20». The noun follows the taken count; a bare fraction reads as a score. */
export function formatSeatLine(taken: number, capacity: number): string {
  return `Занято ${taken} ${pluralRu(taken, "место", "места", "мест")} из ${capacity}`;
}

/**
 * The sticky CTA carries the state of the record, not just its verb: «осталось 4» is the reason to
 * press now, and once booked the button becomes the way out of the booking. An early-access window
 * without a code says so instead of offering a press that would 403 (#202).
 */
export function bookingCtaLabel(details: Pick<EventDetails, "activeBookingId" | "remainingSeats"> & { event: Pick<EventDetails["event"], "bookingOpensAt"> }, now: number = Date.now()): string {
  if (details.activeBookingId !== null) return "Вы записаны";
  if (details.remainingSeats === 0) return "Мест нет";
  const opensAt = details.event.bookingOpensAt;
  if (opensAt !== null && new Date(opensAt).getTime() > now) return "Запись по промокоду";
  return details.remainingSeats === null ? "Записаться" : `Записаться · осталось ${details.remainingSeats}`;
}

/** «Городские события» -> «ГС», «Анна Соколова» -> «АС»; a single word gives a single letter. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function moodTagLabel(tag: EventMoodTag): string {
  return `${tag.label} · ${tag.count}`;
}

export function organizerEventsLabel(count: number): string {
  return `${count} ${pluralRu(count, "событие", "события", "событий")} в афише`;
}

interface EventHeroProps {
  details: EventDetails;
  saveOpen: boolean;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
}

export function EventHero({ details, saveOpen, onShare, onSave }: EventHeroProps) {
  const { event, place } = details;
  const seats = seatOccupancy(details);
  const cover = pictured(event.id, event.coverUrl);
  return (
    <header className="app-ev-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(6, 7, 8, 0.05), rgba(6, 7, 8, 0.78)), url("${cover}")` }}>
      <div className="app-ev-hero-bar">
        <span className="app-ev-hero-bar-right">
          <button type="button" className="app-ev-hero-btn" aria-label="Позвать друзей" onClick={onShare}>
            <ActionIcon name="share" size={20} />
          </button>
          <button type="button" className="app-ev-hero-btn" aria-pressed={saveOpen} aria-label="Сохранить в список" onClick={onSave}>
            <ActionIcon name="bookmark" size={20} filled={saveOpen} />
          </button>
        </span>
      </div>
      <div className="app-ev-hero-copy">
        <h1 className="app-ev-title">{event.title}</h1>
        <p className="app-ev-hero-meta">
          {CATEGORY_LABELS[event.category]}
          {place !== null && ` · ${place.title}`}
          {event.promoted && " · Промо"}
        </p>
        {seats !== null && <p className="app-ev-hero-seats">{formatSeatLine(seats.taken, seats.capacity)}</p>}
      </div>
    </header>
  );
}

export function EventWhenRow({ event }: { event: Pick<EventDetails["event"], "startsAt" | "endsAt" | "isPaid" | "priceRub"> }) {
  const badge = formatDateBadge(event.startsAt);
  return (
    <div className="app-ev-when">
      <span className="app-ev-when-badge" aria-hidden="true">
        <span className="app-ev-when-month">{badge.month}</span>
        <span className="app-ev-when-day">{badge.day}</span>
      </span>
      <span className="app-ev-when-text">
        <span className="app-ev-when-line">{formatDayLine(event.startsAt)}</span>
        <span className="app-ev-when-time">
          <ActionIcon name="clock" size={16} />
          {formatTimeRange(event.startsAt, event.endsAt)}
        </span>
      </span>
      <span className="app-ev-when-price">{formatPrice(event)}</span>
    </div>
  );
}

function ForecastColumn({ hour }: { hour: EventWeatherHour }) {
  return (
    <li className={hour.withinEvent ? "app-ev-weather-hour" : "app-ev-weather-hour app-ev-weather-hour--after"}>
      <span className="app-ev-weather-at">{formatHour(hour.at)}</span>
      <ActionIcon name={forecastGlyph(hour.conditionCode)} size={20} />
      <span className="app-ev-weather-temp">{formatTemperature(hour.temperatureC)}</span>
    </li>
  );
}

/** The provider comes from the payload: crediting a forecast to a service we do not read would be a lie on screen. */
export function EventForecastCard({ forecast }: { forecast: EventForecast }) {
  if (forecast.hours.length === 0) return null;
  return (
    <section className="app-ev-weather" aria-label="Погода на событие">
      <div className="app-ev-weather-head">
        <span className="app-ev-weather-title">
          <ActionIcon name="weather" size={18} />
          Погода на событие
        </span>
        <span className="app-ev-weather-source">{forecast.source}</span>
      </div>
      <ol className="app-ev-weather-strip">
        {forecast.hours.map((hour) => (
          <ForecastColumn key={hour.at} hour={hour} />
        ))}
      </ol>
      {forecast.note !== null && (
        <p className="app-ev-weather-note">
          <ActionIcon name="rain" size={16} />
          {forecast.note}
        </p>
      )}
    </section>
  );
}

interface EventRouteCardProps {
  address: string;
  hint: string | null;
  travel: TravelOption | null;
  /** Kilometers were measured from the city center, not from the viewer. */
  fromCenter?: boolean;
  onRoute: () => void;
}

export function EventRouteCard({ address, hint, travel, fromCenter = false, onRoute }: EventRouteCardProps) {
  return (
    <section className="app-ev-route" aria-label="Как добраться">
      <div className="app-ev-route-text">
        <p className="app-ev-route-address">
          {address}
          {hint !== null && ` · ${hint}`}
        </p>
        {travel !== null && <p className="app-ev-route-travel">{formatTravel(travel, fromCenter)}</p>}
        <button type="button" className="app-ev-route-go" onClick={onRoute}>
          <ActionIcon name="navigation" size={16} />
          Проложить маршрут
        </button>
      </div>
    </section>
  );
}

interface EventOrganizerCardProps {
  name: string;
  eventsCount: number | null;
  rating: OrganizerRating | null;
  subscribe: ReactNode;
}

/**
 * Below three reviews the backend answers null rather than an average (#199), and the design turns
 * that into a sentence instead of a blank: one review must not decide for everyone. «Дошли до
 * события» is a count here and a percentage in the mock, because OrganizerRating carries visitsCount
 * and no denominator to divide it by.
 */
export function EventOrganizerCard({ name, eventsCount, rating, subscribe, brief = false }: EventOrganizerCardProps & { brief?: boolean }) {
  return (
    <section className="app-ev-org" aria-label="Организатор">
      <div className="app-ev-org-head">
        <span className="app-ev-org-mark" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="app-ev-org-id">
          <span className="app-ev-org-name">{name}</span>
          <span className="app-ev-org-meta">{eventsCount === null ? "Организатор" : `Организатор · ${organizerEventsLabel(eventsCount)}`}</span>
        </span>
        <span className="app-ev-org-action">{subscribe}</span>
      </div>
      {brief ? (
        rating !== null && (
          <p className="app-ev-org-brief">
            {rating.averageStars.toFixed(1).replace(".", ",")} · {Math.round(rating.recommendPercent)}% рекомендуют
          </p>
        )
      ) : rating === null ? (
        <div className="app-ev-org-new">
          <ActionIcon name="alert" size={20} />
          <span>
            <b>Рейтинга пока нет</b>
            <i>Организатор новый: оценку показываем с третьего отзыва, чтобы одна реплика не решала за всех.</i>
          </span>
        </div>
      ) : (
        <>
          <div className="app-ev-org-rating">
            <span className="app-ev-org-stars">
              <ActionIcon name="star" size={18} filled />
              {rating.averageStars.toFixed(1).replace(".", ",")}
            </span>
            <span className="app-ev-org-metric">
              <b>{Math.round(rating.recommendPercent)}%</b>
              <i>рекомендуют</i>
            </span>
            <span className="app-ev-org-metric">
              <b>{rating.visitsCount}</b>
              <i>дошли до события</i>
            </span>
            {rating.onTimePercent !== null && (
              <span className="app-ev-org-metric">
                <b>{Math.round(rating.onTimePercent)}%</b>
                <i>начали вовремя</i>
              </span>
            )}
          </div>
          <p className="app-ev-org-reviews">
            По {rating.reviewsCount} {pluralRu(rating.reviewsCount, "отзыву", "отзывам", "отзывам")} участников
          </p>
        </>
      )}
    </section>
  );
}

/** The faces are decoration — the count next to them is the fact, so the stack is one image to assistive tech. */
export function EventWhoGoesRow({ companions, onOpen }: { companions: EventCompanions; onOpen: () => void }) {
  const going = companions.companions.filter((companion) => companion.status === "going");
  const faces = going.slice(0, 3);
  const rest = Math.max(0, companions.counts.going - faces.length);
  return (
    <button type="button" className="app-ev-who" onClick={onOpen}>
      <span className="app-ev-who-label">
        Кто идёт
        {companions.counts.going > 0 && (
          <>
            {" "}
            <b>{companions.counts.going}</b>
          </>
        )}
      </span>
      <span className="app-ev-who-right">
        {faces.length === 0 ? (
          <span>Пока никого</span>
        ) : (
          <span className="app-ev-faces" role="img" aria-label={faces.map((companion) => companion.friend.name).join(", ")}>
            {faces.map((companion) => (
              <span key={companion.friend.id} className="app-ev-face">
                {companion.friend.name.charAt(0)}
              </span>
            ))}
            {rest > 0 && <span className="app-ev-face app-ev-face--rest">+{rest}</span>}
          </span>
        )}
        <ActionIcon name="chevron" size={18} />
      </span>
    </button>
  );
}

export function EventMoodTags({ tags }: { tags: EventMoodTag[] }) {
  if (tags.length === 0) return null;
  return (
    <section className="app-ev-section" aria-label="Обстановка">
      <h2 className="app-ev-section-title">Обстановка</h2>
      <ul className="app-ev-moods">
        {tags.map((tag) => (
          <li key={tag.code} className="app-ev-mood">
            {moodTagLabel(tag)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EventNearbyList({ spots, onOpen }: { spots: EventNearbySpot[]; onOpen: (placeId: string) => void }) {
  if (spots.length === 0) return null;
  return (
    <section className="app-ev-section" aria-label="Рядом">
      <h2 className="app-ev-section-title">Рядом</h2>
      <ul className="app-ev-nearby">
        {spots.map((spot) => (
          <li key={spot.id}>
            <button type="button" className="app-ev-nearby-row" onClick={() => onOpen(spot.id)}>
              <ActionIcon name="pin" size={18} />
              <span className="app-ev-nearby-title">{spot.title}</span>
              <span className="app-ev-nearby-distance">{formatDistance(spot.distanceM)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface EventBookingBarProps {
  details: EventDetails;
  /** The event chat; the square next to the CTA is drawn only for an event that has one. */
  chatLink: string | null;
  onChat: () => void;
  onBook: () => void;
}

/** The square keeps the conversation, the pill keeps the record: one shape per kind of action (макет, экран 17). */
/** Two ways to bring someone: people already in the miniapp, or a MAX chat. The scrim and the grabber close it. */
export function EventInviteSheet({ onPick, onMax, onClose }: { onPick: () => void; onMax: () => void; onClose: () => void }) {
  const swipe = useSheetSwipe(onClose);
  return (
    <div className="app-save-sheet" role="dialog" aria-modal="true" aria-label="Позвать друзей">
      <button type="button" className="app-save-sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <section className="app-save-sheet-card" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <h2 className="app-save-sheet-title">Позвать друзей</h2>
        <div className="app-invite-actions">
          <button type="button" className="app-invite-action" onClick={onPick}>
            <ActionIcon name="users" size={20} />
            <span>
              <b>Из приложения</b>
              <i>Выбрать людей, которые уже здесь</i>
            </span>
          </button>
          <button type="button" className="app-invite-action" onClick={onMax}>
            <ActionIcon name="share" size={20} />
            <span>
              <b>В MAX</b>
              <i>Отправить приглашение в чат</i>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function EventBookingBar({ details, chatLink, onChat, onBook }: EventBookingBarProps) {
  return (
    <div className="app-ev-bar">
      {chatLink !== null && chatLink !== "" && (
        <button type="button" className="app-ev-bar-chat" aria-label="Открыть чат события" onClick={onChat}>
          <ActionIcon name="comment" size={22} />
        </button>
      )}
      <button type="button" className="app-ev-bar-cta" onClick={onBook}>
        <ActionIcon name="ticket" size={20} />
        {bookingCtaLabel(details)}
      </button>
    </div>
  );
}
