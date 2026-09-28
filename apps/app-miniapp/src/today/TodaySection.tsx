// START_MODULE_CONTRACT
// PURPOSE: Экран 08 blocks fed by the today digest: «Сегодня для тебя» with its three counters, the «Для вас» picks and the dismissible «после меня» hint.
// SCOPE: Presentational only — the search screen owns the GET /today fetch and hands the state down, because the design splits the digest in two: the counters sit above the «Куда пойдём?» entries and the picks below them.
// DEPENDS: ../api/client.js (TodayCard, TodayDigest), @max-events/api-contracts (TodayCardLabel), ../catalog/format.js (CATEGORY_LABELS, pluralRu), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TodayState - union of today digest fetch states (loading / error / ready)
// - DistanceVoice - «от тебя» when the viewer is in the city, «от центра» when the point is the city center
// - formatWalkAway - minutes up to a short walk, then kilometers, then «далеко» past 80 km
// - nearbyStatLabel - «2 события рядом» or «2 события в городе»
// - todayLabel - TodayCardLabel -> ru text («15 минут от тебя», «Идёт Анна», «Свободный вход», «Осталось 12 мест»; after_me gives its headline)
// - formatTodayDate - «18 сентября» — the date next to the block title
// - formatPickWhen - «19 сент. · 14:00» — the when line of a pick
// - formatPickDistance - «2,1 км»; null when the card carries no distance (#496)
// - formatPickPrice - «Бесплатно» / «от 1 500 ₽»
// - formatPickRating - «4.8»; null when nobody reviewed the event (#496)
// - pickWhere - «Парк Горького · 3,8 км» — the venue line of a pick
// - todayAfterMeCard - the card carrying the after_me label, or null: the hint has no card of its own
// - todayPickCards - the cards «Для вас» shows, i.e. everything that is not the hint
// - TodaySummaryBlock - «Сегодня для тебя»: the date and the three counters, skeletons while loading
// - TodayPicksBlock - «Для вас»: the hero pick, the two-column grid under it and the empty/error states
// - TodayAfterMeCard - the dismissible hint: headline, explanation, the chips of its own card and the two buttons
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TodayCardLabel } from "@max-events/api-contracts";
import type { TodayCard, TodayDigest } from "../api/client";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { ActionIcon } from "../ui/icons";
import { toggleEventLike, useEventLiked } from "../ui/event-likes";
import { pictured } from "../ui/photos";
import { AppSkeleton, AppState } from "../ui/primitives";

export type TodayState = { status: "loading" } | { status: "error" } | { status: "ready"; today: TodayDigest };

/** A walk a person would actually take. Past this, minutes become kilometers, and a cross-country figure is not a route. */
const WALK_MINUTE_CAP = 90;
const WALK_METERS_PER_MINUTE = 80;
const FAR_KM = 80;

export type DistanceVoice = "you" | "center";

function awayFrom(voice: DistanceVoice): string {
  return voice === "center" ? "от центра" : "от тебя";
}

export function formatWalkAway(minutes: number, voice: DistanceVoice = "you"): string {
  const who = awayFrom(voice);
  if (minutes <= WALK_MINUTE_CAP) return `${minutes} ${pluralRu(minutes, "минута", "минуты", "минут")} ${who}`;
  const km = Math.max(1, Math.round((minutes * WALK_METERS_PER_MINUTE) / 1000));
  if (km > FAR_KM) return `далеко ${who}`;
  return `${km.toLocaleString("ru-RU")} км ${who}`;
}

/** The digest count is the city's upcoming events. «рядом» is only true when the viewer is in that city. */
export function nearbyStatLabel(count: number, voice: DistanceVoice = "you"): string {
  const noun = pluralRu(count, "событие", "события", "событий");
  return voice === "center" ? `${noun} в городе` : `${noun} рядом`;
}

export function todayLabel(label: TodayCardLabel, voice: DistanceVoice = "you"): string {
  if (label.kind === "distance") return formatWalkAway(label.minutes, voice);
  if (label.kind === "friend_attending") return `Идёт ${label.friendName}`;
  if (label.kind === "free_entry") return "Свободный вход";
  if (label.kind === "after_me") return `После ${label.fromCategory} ты обычно идёшь дальше`;
  return `Осталось ${label.count} ${pluralRu(label.count, "место", "места", "мест")}`;
}

/** «18 сентября» — the day the digest was built for, printed next to its title. */
export function formatTodayDate(now: Date): string {
  return now.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** «26 СЕН» — the short plaque next to «Афиша». */
export function afishaDayChip(date: Date): string {
  const month = date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "").slice(0, 3).toUpperCase();
  return `${date.getDate()} ${month}`;
}

/** Local calendar day as YYYY-MM-DD, the value a date input reads and writes. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Six weeks of a month grid, Monday first. */
export function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function monthHeading(date: Date): string {
  const raw = date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(" г.", "");
}

export function DayCalendar({ month, selected, today, onPick, onShift, onToday }: { month: Date; selected: string; today: string; onPick: (day: string) => void; onShift: (month: Date) => void; onToday: () => void }) {
  return (
    <div className="app-today-cal" role="dialog" aria-label="Выбор даты">
      <div className="app-today-cal-head">
        <button type="button" className="app-today-cal-nav" aria-label="Предыдущий месяц" onClick={() => onShift(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ActionIcon name="chevron" size={16} />
        </button>
        <span className="app-today-cal-title">{monthHeading(month)}</span>
        <button type="button" className="app-today-cal-nav app-today-cal-nav--next" aria-label="Следующий месяц" onClick={() => onShift(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ActionIcon name="chevron" size={16} />
        </button>
      </div>
      <div className="app-today-cal-week" aria-hidden="true">
        {WEEKDAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="app-today-cal-grid">
        {monthCells(month).map((date) => {
          const key = dayKey(date);
          const outside = date.getMonth() !== month.getMonth();
          const classes = ["app-today-cal-day", outside ? "app-today-cal-day--out" : "", key === selected ? "app-today-cal-day--on" : "", key === today && key !== selected ? "app-today-cal-day--today" : ""].filter(Boolean).join(" ");
          return (
            <button key={key} type="button" className={classes} aria-pressed={key === selected} onClick={() => onPick(key)}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <button type="button" className="app-today-cal-today" onClick={onToday}>
        Сегодня
      </button>
    </div>
  );
}

export function SearchDayButton({ day, now, onDay, chip = false, emphasized = false }: { day: string; now: Date; onDay: (day: string) => void; chip?: boolean; emphasized?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(`${day}T12:00:00`));
  const root = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const shown = new Date(`${day}T12:00:00`);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || layerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const calendar = (
    <DayCalendar
      month={cursor}
      selected={day}
      today={dayKey(now)}
      onShift={setCursor}
      onPick={(next) => {
        onDay(next);
        setOpen(false);
      }}
      onToday={() => {
        onDay(dayKey(now));
        setOpen(false);
      }}
    />
  );
  return (
    <div className="app-today-date-wrap" ref={root}>
      <button
        type="button"
        className={chip ? `app-today-date app-today-date--chip${emphasized ? " app-today-date--live" : ""}` : "app-today-date"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Дата афиши: ${formatTodayDate(shown)}`}
        onClick={(event) => {
          event.stopPropagation();
          setCursor(shown);
          setOpen((current) => !current);
        }}
      >
        {chip ? <span>{afishaDayChip(shown)}</span> : <span>{formatTodayDate(shown)}</span>}
        <ActionIcon name="calendar" size={14} />
      </button>
      {open &&
        createPortal(
          <div ref={layerRef} className="app-today-cal-layer" onPointerDown={() => setOpen(false)}>
            <div onPointerDown={(event) => event.stopPropagation()}>{calendar}</div>
          </div>,
          document.querySelector(".app-root") ?? document.body,
        )}
    </div>
  );
}

/** «19 сент. · 14:00» — short enough to sit next to the distance on a pick. */
export function formatPickWhen(startsAt: string): string {
  const date = new Date(startsAt);
  return `${date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

/** «2,1 км» — ru decimal comma, one digit; null while the list DTO carries no distance (#496). */
export function formatPickDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  if (distanceKm > 80) return "далеко";
  return `${distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
}

/** «Бесплатно» or «от 1 500 ₽»: the price pill of a pick always says something. */
export function formatPickPrice(event: Pick<TodayCard["event"], "isPaid" | "priceRub">): string {
  return event.isPaid && event.priceRub !== null ? `от ${event.priceRub.toLocaleString("ru-RU")} ₽` : "Бесплатно";
}

/** «4.8»; null until the list DTO carries a rating, since «0.0» would read as a verdict (#496). */
export function formatPickRating(rating: number | null): string | null {
  return rating === null ? null : rating.toFixed(1);
}

/** «Парк Горького · 3,8 км»; the city stands in when the event has no venue. */
export function pickWhere(card: TodayCard): string {
  return [card.placeTitle ?? card.event.city, formatPickDistance(card.distanceKm)].filter((part): part is string => part !== null).join(" · ");
}

/** The hint lives on a card of the digest, so it is found rather than fetched; null when the graph has nothing to say. */
export function todayAfterMeCard(today: TodayDigest): TodayCard | null {
  return today.cards.find((card) => card.labels.some((label) => label.kind === "after_me")) ?? null;
}

/** Everything the hint did not take: the hero and the grid of «Для вас». */
export function todayPickCards(today: TodayDigest): TodayCard[] {
  return today.cards.filter((card) => !card.labels.some((label) => label.kind === "after_me"));
}

/** The block is personal when the viewer is in the city. From the city center it is the city's day, not a walk from the viewer. */
export function todaySummaryTitle(voice: DistanceVoice = "you"): string {
  return voice === "center" ? "Сегодня в городе" : "Сегодня для тебя";
}

export function afterMeGoLabel(voice: DistanceVoice = "you"): string {
  return voice === "center" ? "Показать места в городе" : "Показать места рядом";
}

function StatPhotos({ photos }: { photos?: string[] }) {
  if (photos === undefined || photos.length === 0) return null;
  return (
    <span className="app-today-stat-photos">
      {photos.slice(0, 3).map((photo) => (
        <img key={photo} className="app-today-stat-photo" alt="" src={photo} />
      ))}
    </span>
  );
}

export function TodaySummaryBlock({ state, now, day, onDay, distanceFrom = "you", onOpenNearby, onOpenSuitable, onOpenFriends, nearbyPhotos, suitablePhotos }: { state: TodayState; now: Date; day?: string; onDay?: (day: string) => void; distanceFrom?: DistanceVoice; onOpenNearby?: () => void; onOpenSuitable?: () => void; onOpenFriends?: () => void; nearbyPhotos?: string[]; suitablePhotos?: string[] }) {
  const summary = state.status === "ready" ? state.today.summary : null;
  const title = todaySummaryTitle(distanceFrom);
  const shown = day === undefined ? now : new Date(`${day}T12:00:00`);
  return (
    <section className="app-today" aria-label={title}>
      <div className="app-today-head">
        <h2 className="app-today-title">{title}</h2>
        {onDay ? <SearchDayButton day={day ?? dayKey(now)} now={now} onDay={onDay} /> : <span className="app-today-date">{formatTodayDate(shown)}</span>}
      </div>
      <div className="app-today-stats">
        {summary === null ? (
          [0, 1, 2].map((tile) => (
            <span key={tile} className="app-today-stat" aria-hidden="true">
              <AppSkeleton variant="line-short" width="36px" />
              <AppSkeleton width="70%" />
            </span>
          ))
        ) : (
          <>
            <button type="button" className="app-today-stat" onClick={onOpenNearby}>
              <StatPhotos photos={nearbyPhotos} />
              <span className="app-today-stat-value">{summary.nearbyCount}</span>
              <span className="app-today-stat-label">{nearbyStatLabel(summary.nearbyCount, distanceFrom)}</span>
            </button>
            {summary.suitableCount > 0 && (
              <button type="button" className="app-today-stat" onClick={onOpenSuitable}>
                <StatPhotos photos={suitablePhotos} />
                <span className="app-today-stat-value">{summary.suitableCount}</span>
                <span className="app-today-stat-label">{pluralRu(summary.suitableCount, "подходит", "подходят", "подходят")} тебе</span>
              </button>
            )}
            {summary.withFriendsCount > 0 && (
              <button type="button" className="app-today-stat app-today-stat--friends" onClick={onOpenFriends}>
                <span className="app-today-stat-value">{summary.withFriendsCount}</span>
                <span className="app-today-stat-label">с друзьями</span>
              </button>
            )}
          </>
        )}
      </div>
      {summary !== null && summary.suitableCount === 0 && summary.withFriendsCount === 0 && <p className="app-today-quiet">Под интересы и с друзьями пока ничего. Интересы правятся в профиле.</p>}
    </section>
  );
}

function PickCard({ card, hero, onOpen, distanceFrom }: { card: TodayCard; hero: boolean; onOpen: (eventId: string) => void; distanceFrom: DistanceVoice }) {
  const liked = useEventLiked(card.event.id);
  const rating = formatPickRating(card.rating);
  const distance = formatPickDistance(card.distanceKm);
  return (
    <article className={`app-pick${hero ? " app-pick--hero" : ""} app-media--${card.event.category}`}>
      <img className="app-pick-photo" alt="" src={pictured(card.event.id, card.event.coverUrl)} />
      <span className="app-pick-glow" aria-hidden="true" />
      <span className="app-pick-glow app-pick-glow--cool" aria-hidden="true" />
      <button type="button" className="app-pick-save" aria-label="Нравится" aria-pressed={liked} onClick={() => toggleEventLike(card.event.id)}>
        <ActionIcon filled={liked} name="heart" size={hero ? 18 : 15} />
      </button>
      <button type="button" className="app-pick-open" aria-label={card.event.title} onClick={() => onOpen(card.event.id)}>
        <span className="app-pick-kind">{CATEGORY_LABELS[card.event.category]}</span>
        <span className="app-pick-veil">
          <span className="app-pick-title">{card.event.title}</span>
          <span className="app-pick-where">{pickWhere(card)}</span>
          {hero && (
            <>
              <span className="app-pick-meta">
                <span className="app-pick-meta-item">
                  <ActionIcon name="calendar" size={14} />
                  {formatPickWhen(card.event.startsAt)}
                </span>
                {distance !== null && (
                  <span className="app-pick-meta-item">
                    <ActionIcon name="pin" size={14} />
                    {distance}
                  </span>
                )}
              </span>
              <span className="app-pick-labels">
                {card.labels.map((label, index) => (
                  <span key={index} className="app-pick-label">
                    {todayLabel(label, distanceFrom)}
                  </span>
                ))}
              </span>
            </>
          )}
          {/* Подвал героя ведёт на страницу события, подвал плитки — это цена и рейтинг (макет, экран 08) */}
          <span className="app-pick-foot">
            {hero && (
              <span className="app-pick-more">
                Подробнее
                <ActionIcon name="arrow" size={16} strokeWidth={2} />
              </span>
            )}
            <span className="app-pick-price">{formatPickPrice(card.event)}</span>
            {!hero && rating !== null && (
              <span className="app-pick-rating">
                <ActionIcon name="star" size={13} filled />
                {rating}
              </span>
            )}
          </span>
        </span>
      </button>
    </article>
  );
}

export function TodayPicksBlock({ state, onOpen, onRetry, distanceFrom = "you", showHeading = true }: { state: TodayState; onOpen: (eventId: string) => void; onRetry: () => void; distanceFrom?: DistanceVoice; showHeading?: boolean }) {
  const cards = state.status === "ready" ? todayPickCards(state.today) : [];
  const [hero, ...rest] = cards;
  return (
    <section className="app-picks" aria-label="Для вас">
      {showHeading && <h2 className="app-screen-title">Для вас</h2>}
      {state.status === "loading" && <AppSkeleton variant="block" className="app-picks-skeleton" />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить подборку.
        </AppState>
      )}
      {state.status === "ready" && hero === undefined && <AppState>На сегодня пока ничего нет. Загляните позже!</AppState>}
      {hero !== undefined && <PickCard card={hero} hero onOpen={onOpen} distanceFrom={distanceFrom} />}
      {rest.length > 0 && (
        <div className="app-picks-grid">
          {rest.map((card) => (
            <PickCard key={card.event.id} card={card} hero={false} onOpen={onOpen} distanceFrom={distanceFrom} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * «После джаза ты обычно идёшь дальше» (макет, экран 08). The hint is one label of one digest card,
 * so its chips are the other labels of that same card. It can be turned down: a suggestion that
 * cannot be refused is an instruction.
 */
export function TodayAfterMeCard({ card, onShow, onDismiss, distanceFrom = "you" }: { card: TodayCard; onShow: () => void; onDismiss: () => void; distanceFrom?: DistanceVoice }) {
  const hint = card.labels.find((label) => label.kind === "after_me");
  if (hint === undefined || hint.kind !== "after_me") return null;
  const chips = card.labels.filter((label) => label.kind !== "after_me");
  return (
    <section className="app-afterme" aria-label="Подсказка по твоим привычкам">
      <p className="app-afterme-head">
        <ActionIcon name="arrow" size={18} />
        {todayLabel(hint)}
      </p>
      <p className="app-afterme-text">
        Так было {hint.afterCount} {pluralRu(hint.afterCount, "раз", "раза", "раз")} за лето. Показать, куда пойти после?
      </p>
      {chips.length > 0 && (
        <div className="app-afterme-chips">
          {chips.map((label, index) => (
            <span key={index} className="app-afterme-chip">
              <ActionIcon name={label.kind === "distance" ? "pin" : label.kind === "spots_left" ? "seat" : label.kind === "friend_attending" ? "user" : "ticket"} size={13} />
              {todayLabel(label, distanceFrom)}
            </span>
          ))}
        </div>
      )}
      <div className="app-afterme-actions">
        <button type="button" className="app-afterme-go" onClick={onShow}>
          {afterMeGoLabel(distanceFrom)}
        </button>
        <button type="button" className="app-afterme-skip" onClick={onDismiss}>
          Не надо
        </button>
      </div>
    </section>
  );
}
