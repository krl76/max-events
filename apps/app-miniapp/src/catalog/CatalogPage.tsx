// START_MODULE_CONTRACT
// PURPOSE: Catalog screen: filter bar (category/date/city), event card feed, loading/empty/error states.
// SCOPE: Data via apiClient.listEvents (mock or live backend); filters sync with window.location query params.
// DEPENDS: ../api/client.js (apiClient, parseEventFilters, serializeEventFilters), @max-events/api-contracts (EventCategorySchema), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CatalogState - union of catalog fetch states (loading / error / ready)
// - CATEGORY_LABELS - ru labels per event category (reused by the event page)
// - formatStartsAt - ru "day month, hh:mm" formatting (reused by the event page)
// - CatalogView - presentational: filter bar + state-driven body (skeleton, error, empty, cards)
// - CatalogPage - filters from window.location on mount; fetches via useCatalog and writes filter changes back to the URL
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, EventCategory } from "@max-events/api-contracts";
import { EventCategorySchema } from "@max-events/api-contracts";
import { apiClient, parseEventFilters, serializeEventFilters, type EventFilters } from "../api/client";

const CATEGORIES: readonly EventCategory[] = EventCategorySchema.options;

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  afisha: "Афиша",
  volunteering: "Волонтёрство",
  tourism: "Туризм",
  sport: "Спорт",
};

export type CatalogState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

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

export function formatStartsAt(startsAt: string): string {
  return new Date(startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function EventCard({ event }: { event: Event }) {
  return (
    <article className="app-card">
      <div className="app-card-media" />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
        </span>
        <span className="app-card-subtitle">
          {event.city} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
        </span>
      </div>
    </article>
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
        <button type="button" className="app-filters-chip" aria-pressed={filters.category === undefined} onClick={() => onFilters({ ...filters, category: undefined })}>
          Все
        </button>
        {CATEGORIES.map((category) => (
          <button type="button" key={category} className="app-filters-chip" aria-pressed={filters.category === category} onClick={() => onFilters({ ...filters, category })}>
            {CATEGORY_LABELS[category]}
          </button>
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
}

export function CatalogView({ state, filters, onFilters }: CatalogViewProps) {
  return (
    <>
      <FilterBar filters={filters} onFilters={onFilters} />
      {state.status === "loading" && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
      {state.status === "error" && <p className="app-state app-state--error">Не удалось загрузить события. Попробуйте изменить фильтры.</p>}
      {state.status === "ready" && state.events.length === 0 && <p className="app-state">Ничего не найдено. Попробуйте изменить фильтры.</p>}
      {state.status === "ready" && state.events.map((item) => <EventCard key={item.id} event={item} />)}
    </>
  );
}

export function CatalogPage() {
  const [filters, setFilters] = useState<EventFilters>(() => parseEventFilters(window.location.search));
  const catalog = useCatalog(filters);

  useEffect(() => {
    const query = serializeEventFilters(filters);
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [filters]);

  return <CatalogView state={catalog} filters={filters} onFilters={setFilters} />;
}
