// START_MODULE_CONTRACT
// PURPOSE: Catalog screen: filter bar (category/date/city), «Список ↔ Карта» switch, event card feed or map, loading/empty/error states.
// SCOPE: Data via apiClient (mock or live backend); filters sync with window.location query params; map internals live in MapScreen.
// DEPENDS: ../api/client.js (apiClient, parseEventFilters, serializeEventFilters), @max-events/api-contracts (EventCategorySchema), ../routing/router.js (useRoute), ./MapScreen.js, ./format.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CatalogState - union of catalog fetch states (loading / error / ready)
// - CATEGORY_LABELS - ru labels per event category (re-exported from ./format.js, reused by the event page and the feed)
// - formatStartsAt - ru "day month, hh:mm" formatting (re-exported from ./format.js, reused by the event page)
// - CatalogViewName - "list" | "map" view switch on the catalog route
// - RATING_THRESHOLDS - whole-star minimums the rating filter offers
// - RatingChips - «Любой рейтинг / от N★» control, shared with the search tab
// - CatalogView - presentational: filter bar (category chips, rating chips «от N★», date, city) + segmented «Список ↔ Карта» toggle + state-driven body (skeleton, error, empty, clickable event cards with the «Промо» badge on promoted events (#205) or map with event/place popups)
// - EventCard - event card (media, title, time/category, city/price, weather chip, «Промо» badge); exported for the search tab
// - CatalogPage - filters from window.location on mount; the view is controlled by the parent, and a parent that offers no switch (экран 08) gets the list alone; fetches via useCatalog and writes filter changes back to the URL
// - filterEventsByQuery - case-insensitive title/city match; identity on a blank query
// - CATALOG_PAGE_SIZE - list page window: how many events one request brings, the next page appends below
// - CATALOG_MAP_LIMIT - map view window: every pin at once, capped at what the backend allows per request
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Event, EventCategory } from "@max-events/api-contracts";
import { EventCategorySchema } from "@max-events/api-contracts";
import { apiClient, parseEventFilters, serializeEventFilters, type EventFilters } from "../api/client";
import { useRoute } from "../routing/router";
import { AppChip, AppState, AppMedia } from "../ui/primitives";
import { useViewerOrigin } from "../geo/viewer-origin";
import { CATEGORY_LABELS, formatEventWeather, formatStartsAt } from "./format";
import { MapScreen } from "./MapScreen";

// Both live in ./format.ts, the leaf screens without a map can import from; re-exported here because that is where the screens already reach for them.
export { CATEGORY_LABELS, formatStartsAt };

const CATEGORIES: readonly EventCategory[] = EventCategorySchema.options;

export type CatalogState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

export function filterEventsByQuery(events: Event[], query: string): Event[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return events;
  return events.filter((event) => event.title.toLowerCase().includes(needle) || event.city.toLowerCase().includes(needle));
}

export type CatalogViewName = "list" | "map";

export const CATALOG_PAGE_SIZE = 20;
export const CATALOG_MAP_LIMIT = 100;

function useCatalog(filters: EventFilters, offset: number, view: CatalogViewName, attempt: number, origin: { latitude: number; longitude: number }): CatalogState & { hasMore: boolean; loadingMore: boolean; loadFailed: boolean } {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const generationRef = useRef(0);
  const pagesRef = useRef<Map<number, Event[]>>(new Map());
  const pageSize = view === "map" ? CATALOG_MAP_LIMIT : CATALOG_PAGE_SIZE;

  useEffect(() => {
    generationRef.current += 1;
    pagesRef.current = new Map();
  }, [filters, view, origin.latitude, origin.longitude]);

  useEffect(() => {
    const generation = generationRef.current;
    if (offset === 0) setState({ status: "loading" });
    else setLoadingMore(true);
    apiClient.listEvents({ ...filters, limit: pageSize, offset, lat: origin.latitude, lng: origin.longitude }).then(
      (events) => {
        if (generation !== generationRef.current) return;
        pagesRef.current.set(offset, events);
        const next = [...pagesRef.current.entries()].sort((left, right) => left[0] - right[0]).flatMap(([, page]) => page);
        setHasMore(events.length === pageSize);
        setLoadFailed(false);
        setLoadingMore(false);
        setState({ status: "ready", events: next });
      },
      () => {
        if (generation !== generationRef.current) return;
        setLoadingMore(false);
        if (offset === 0) setState({ status: "error" });
        else {
          setLoadFailed(true);
          setHasMore(true);
        }
      },
    );
  }, [filters, offset, view, pageSize, attempt, origin.latitude, origin.longitude]);

  return { ...state, hasMore, loadingMore, loadFailed };
}

function ViewToggle({ view, onView }: { view: CatalogViewName; onView: (view: CatalogViewName) => void }) {
  return (
    <div className="app-view-toggle" role="group" aria-label="Вид каталога">
      <AppChip pressed={view === "list"} onClick={() => onView("list")}>
        Список
      </AppChip>
      <AppChip pressed={view === "map"} onClick={() => onView("map")}>
        Карта
      </AppChip>
    </div>
  );
}

export function EventCard({ event, onOpen }: { event: Event; onOpen?: (id: string) => void }) {
  return (
    <button type="button" className="app-card app-card--link" onClick={() => onOpen?.(event.id)}>
      <AppMedia category={event.category} src={event.coverUrl} />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
        </span>
        <span className="app-card-subtitle">
          {event.city} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
          {event.organizerName ? ` · ${event.organizerName}` : ""}
          {event.distanceKm !== undefined && event.distanceKm !== null ? ` · ${event.distanceKm.toFixed(1)} км` : ""}
          {event.remainingSeats !== undefined && event.remainingSeats !== null ? ` · осталось ${event.remainingSeats}` : event.bookedCount !== undefined ? ` · ${event.bookedCount} идут` : ""}
          {event.ratingAverage !== undefined && event.ratingAverage !== null ? ` · ${event.ratingAverage.toFixed(1)}` : ""}
          {event.waitlistCount ? ` · ${event.waitlistCount} в листе` : ""}
        </span>
        {event.friendsGoing && event.friendsGoing.length > 0 ? <span className="app-card-subtitle">{event.friendsGoing.map((friend) => friend.name).join(", ")}</span> : null}
        {event.hitOfTheWeek ? <span className="app-today-chip">ХИТ НЕДЕЛИ</span> : event.promoted ? <span className="app-today-chip">Промо</span> : null}
        {event.weather && <span className="app-today-chip">{formatEventWeather(event.weather)}</span>}
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <article className="app-card" aria-hidden="true">
      <div className="app-card-media" />
      <div className="app-card-body">
        <span className="app-skeleton-line" />
        <span className="app-skeleton-line app-skeleton-line--short" />
      </div>
    </article>
  );
}

/** Whole stars only: the backend query takes 1..5, and «от 4★» is a filter people read at a glance. */
export const RATING_THRESHOLDS = [3, 4, 5];

/** Shared by the catalog filter bar and the search tab, so both spell the same thresholds. */
export function RatingChips({ value, onChange }: { value: number | undefined; onChange: (minRating: number | undefined) => void }) {
  return (
    <div className="app-filters-chips" role="group" aria-label="Рейтинг">
      <AppChip pressed={value === undefined} onClick={() => onChange(undefined)}>
        Любой рейтинг
      </AppChip>
      {RATING_THRESHOLDS.map((stars) => (
        <AppChip key={stars} pressed={value === stars} onClick={() => onChange(stars)}>
          {`от ${stars}★`}
        </AppChip>
      ))}
    </div>
  );
}

function FilterBar({ filters, onFilters }: { filters: EventFilters; onFilters: (filters: EventFilters) => void }) {
  const [cityDraft, setCityDraft] = useState(filters.city ?? "");
  useEffect(() => setCityDraft(filters.city ?? ""), [filters.city]);
  const commitCity = () => onFilters({ ...filters, city: cityDraft.trim() || undefined });
  const hasFilters = filters.category !== undefined || filters.city !== undefined || filters.date !== undefined || filters.dateFrom !== undefined || filters.dateTo !== undefined || filters.minRating !== undefined;

  return (
    <div className="app-filters">
      <div className="app-filters-chips" role="group" aria-label="Категория">
        <AppChip pressed={filters.category === undefined} onClick={() => onFilters({ ...filters, category: undefined })}>
          Все
        </AppChip>
        {CATEGORIES.map((category) => (
          <AppChip key={category} pressed={filters.category === category} onClick={() => onFilters({ ...filters, category })}>
            {CATEGORY_LABELS[category]}
          </AppChip>
        ))}
      </div>
      <RatingChips value={filters.minRating} onChange={(minRating) => onFilters({ ...filters, minRating })} />
      <div className="app-filters-inputs">
        <input className="app-filters-input" type="date" aria-label="Дата от" value={filters.dateFrom ?? filters.date ?? ""} onChange={(change) => onFilters({ ...filters, date: undefined, dateFrom: change.target.value || undefined })} />
        <input className="app-filters-input" type="date" aria-label="Дата до" value={filters.dateTo ?? ""} onChange={(change) => onFilters({ ...filters, dateTo: change.target.value || undefined })} />
        <input
          className="app-filters-input"
          type="text"
          aria-label="Город"
          placeholder="Город"
          value={cityDraft}
          onChange={(change) => setCityDraft(change.target.value)}
          onBlur={commitCity}
          onKeyDown={(keys) => {
            if (keys.key === "Enter") commitCity();
          }}
        />
        {hasFilters && (
          <button type="button" className="app-filters-reset" onClick={() => onFilters({})}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}

interface CatalogViewProps {
  state: CatalogState;
  filters: EventFilters;
  onFilters: (filters: EventFilters) => void;
  view?: CatalogViewName;
  onView?: (view: CatalogViewName) => void;
  onOpenEvent?: (id: string) => void;
  onOpenPlace?: (id: string) => void;
  hasMore?: boolean;
  onMore?: () => void;
  loadingMore?: boolean;
}

function MoreButton({ hasMore, onMore, loadingMore }: { hasMore: boolean; onMore?: () => void; loadingMore: boolean }) {
  if (!hasMore || onMore === undefined) return null;
  return (
    <button type="button" className="app-filters-reset" onClick={onMore} disabled={loadingMore}>
      {loadingMore ? "Загрузка…" : "Ещё"}
    </button>
  );
}

export function CatalogView({ state, filters, onFilters, view = "list", onView, onOpenEvent, onOpenPlace, hasMore = false, onMore, loadingMore = false }: CatalogViewProps) {
  return (
    <>
      <FilterBar filters={filters} onFilters={onFilters} />
      {onView !== undefined && <ViewToggle view={view} onView={onView} />}
      {view === "map" && state.status === "ready" ? (
        <>
          <MapScreen events={state.events} onOpenEvent={onOpenEvent ?? (() => {})} onOpenPlace={onOpenPlace ?? (() => {})} />
          <MoreButton hasMore={hasMore} onMore={onMore} loadingMore={loadingMore} />
        </>
      ) : (
        <>
          {state.status === "loading" && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
          {state.status === "error" && <AppState error>Не удалось загрузить события. Попробуйте изменить фильтры.</AppState>}
          {state.status === "ready" && state.events.length === 0 && <AppState>Ничего не найдено. Попробуйте изменить фильтры.</AppState>}
          {state.status === "ready" && state.events.map((item) => <EventCard key={item.id} event={item} onOpen={onOpenEvent} />)}
          {state.status === "ready" && <MoreButton hasMore={hasMore} onMore={onMore} loadingMore={loadingMore} />}
        </>
      )}
    </>
  );
}

/** Both view props are optional: экран 08 embeds the list alone, and a screen without a toggle must not grow one. */
export function CatalogPage({ view = "list", onView }: { view?: CatalogViewName; onView?: (view: CatalogViewName) => void } = {}) {
  const [filters, setFilters] = useState<EventFilters>(() => parseEventFilters(window.location.search));
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const origin = useViewerOrigin();
  const catalog = useCatalog(filters, offset, view, attempt, origin);
  const { navigate } = useRoute();
  const openEvent = useCallback((id: string) => navigate({ name: "event", id }), [navigate]);
  const openPlace = useCallback((id: string) => navigate({ name: "place", id }), [navigate]);
  const pageSize = view === "map" ? CATALOG_MAP_LIMIT : CATALOG_PAGE_SIZE;

  useEffect(() => {
    const query = serializeEventFilters({ ...filters, limit: undefined, offset: undefined });
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [filters]);

  const onFilters = useCallback((next: EventFilters) => {
    setOffset(0);
    setAttempt(0);
    setFilters(next);
  }, []);

  const setView = useCallback(
    (next: CatalogViewName) => {
      setOffset(0);
      setAttempt(0);
      onView?.(next);
    },
    [onView],
  );

  return (
    <CatalogView
      state={catalog}
      filters={filters}
      onFilters={onFilters}
      view={view}
      onView={setView}
      onOpenEvent={openEvent}
      onOpenPlace={openPlace}
      hasMore={catalog.hasMore}
      loadingMore={catalog.loadingMore}
      onMore={() => {
        if (catalog.loadFailed) setAttempt((current) => current + 1);
        else setOffset((current) => current + pageSize);
      }}
    />
  );
}
