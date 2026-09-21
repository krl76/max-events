// START_MODULE_CONTRACT
// PURPOSE: Catalog screen: filter bar (category/date/city), «Список ↔ Карта» switch, event card feed or map, loading/empty/error states.
// SCOPE: Data via apiClient (mock or live backend); filters sync with window.location query params; map internals live in MapScreen.
// DEPENDS: ../api/client.js (apiClient, parseEventFilters, serializeEventFilters), @max-events/api-contracts (EventCategorySchema), ../routing/router.js (useRoute), ./MapScreen.js, ./format.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CatalogState - union of catalog fetch states (loading / error / ready)
// - CATEGORY_LABELS - ru labels per event category (reused by the event page)
// - formatStartsAt - ru "day month, hh:mm" formatting (re-exported from ./format.js, reused by the event page)
// - CatalogViewName - "list" | "map" view switch on the catalog route
// - CatalogView - presentational: filter bar + segmented «Список ↔ Карта» toggle + state-driven body (skeleton, error, empty, clickable event cards with the «Промо» badge on promoted events (#205) or map with event/place popups)
// - EventCard - event card (media, title, time/category, city/price, «Промо» badge); exported for the search tab
// - CatalogPage - filters from window.location on mount; view is controlled by the parent (HomePage hides the today block in map view); fetches via useCatalog and writes filter changes back to the URL
// - filterEventsByQuery - case-insensitive title/city match; identity on a blank query
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, EventCategory } from "@max-events/api-contracts";
import { EventCategorySchema } from "@max-events/api-contracts";
import { apiClient, parseEventFilters, serializeEventFilters, type EventFilters } from "../api/client";
import { useRoute } from "../routing/router";
import { AppChip, AppState, AppMedia } from "../ui/primitives";
import { formatStartsAt } from "./format";
import { MapScreen } from "./MapScreen";

export { formatStartsAt };

const CATEGORIES: readonly EventCategory[] = EventCategorySchema.options;

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  afisha: "Афиша",
  volunteering: "Волонтёрство",
  tourism: "Туризм",
  sport: "Спорт",
};

export type CatalogState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

export function filterEventsByQuery(events: Event[], query: string): Event[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return events;
  return events.filter((event) => event.title.toLowerCase().includes(needle) || event.city.toLowerCase().includes(needle));
}

function useCatalog(filters: EventFilters): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.listEvents(filters).then(
      (events) => {
        if (alive) setState({ status: "ready", events });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [filters]);

  return state;
}

export type CatalogViewName = "list" | "map";

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
      <AppMedia category={event.category} />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
        </span>
        <span className="app-card-subtitle">
          {event.city} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
        </span>
        {event.promoted && <span className="app-today-chip">Промо</span>}
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

function FilterBar({ filters, onFilters }: { filters: EventFilters; onFilters: (filters: EventFilters) => void }) {
  const [cityDraft, setCityDraft] = useState(filters.city ?? "");
  useEffect(() => setCityDraft(filters.city ?? ""), [filters.city]);
  const commitCity = () => onFilters({ ...filters, city: cityDraft.trim() || undefined });
  const hasFilters = filters.category !== undefined || filters.city !== undefined || filters.date !== undefined;

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
      <div className="app-filters-inputs">
        <input className="app-filters-input" type="date" aria-label="Дата" value={filters.date ?? ""} onChange={(change) => onFilters({ ...filters, date: change.target.value || undefined })} />
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
}

export function CatalogView({ state, filters, onFilters, view = "list", onView, onOpenEvent, onOpenPlace }: CatalogViewProps) {
  return (
    <>
      <FilterBar filters={filters} onFilters={onFilters} />
      {onView !== undefined && <ViewToggle view={view} onView={onView} />}
      {view === "map" && state.status === "ready" ? (
        <MapScreen events={state.events} onOpenEvent={onOpenEvent ?? (() => {})} onOpenPlace={onOpenPlace ?? (() => {})} />
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
        </>
      )}
    </>
  );
}

export function CatalogPage({ view, onView }: { view: CatalogViewName; onView: (view: CatalogViewName) => void }) {
  const [filters, setFilters] = useState<EventFilters>(() => parseEventFilters(window.location.search));
  const catalog = useCatalog(filters);
  const { navigate } = useRoute();
  const openEvent = useCallback((id: string) => navigate({ name: "event", id }), [navigate]);
  const openPlace = useCallback((id: string) => navigate({ name: "place", id }), [navigate]);

  useEffect(() => {
    const query = serializeEventFilters(filters);
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [filters]);

  return <CatalogView state={catalog} filters={filters} onFilters={setFilters} view={view} onView={onView} onOpenEvent={openEvent} onOpenPlace={openPlace} />;
}
