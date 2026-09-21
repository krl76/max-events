// START_MODULE_CONTRACT
// PURPOSE: Search tab screen: query input, recent queries (localStorage), event results filtered client-side from the full event list.
// SCOPE: Client-side search over apiClient.listEvents({}) via the catalog filterEventsByQuery; result cards reuse the catalog EventCard; recents persist in localStorage only.
// DEPENDS: ../api/client.js (apiClient), ../catalog/CatalogPage.js (EventCard, filterEventsByQuery), ../routing/router.js (useRoute), ../ui/primitives.js (AppChip, AppState)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SearchState - union of the event list fetch states (loading / error / ready)
// - RECENT_SEARCHES_LIMIT - max stored recent queries
// - addRecentSearch - prepend a trimmed query, dedupe case-insensitively, cap at the limit; identity on a blank query
// - SearchView - presentational: search form, recent query chips on a blank query, state-driven results (hint / loading / error / empty / event cards)
// - SearchPage - container: one-shot event list fetch, query and recents state, submit stores the query and recent pick fills the input
// END_MODULE_MAP

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { EventCard, filterEventsByQuery } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { AppChip, AppState } from "../ui/primitives";

export type SearchState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

export const RECENT_SEARCHES_LIMIT = 5;
const STORAGE_KEY = "app-search-recent";

export function addRecentSearch(recent: string[], query: string): string[] {
  const normalized = query.trim();
  if (normalized === "") return recent;
  return [normalized, ...recent.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, RECENT_SEARCHES_LIMIT);
}

function readRecentSearches(): string[] {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string").slice(0, RECENT_SEARCHES_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(recent: string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // ponytail: storage may be unavailable (private mode); recents are a convenience, losing them is fine.
  }
}

interface SearchViewProps {
  query: string;
  onQuery: (query: string) => void;
  onSubmit: () => void;
  recents: string[];
  state: SearchState;
  onOpenEvent: (id: string) => void;
}

export function SearchView({ query, onQuery, onSubmit, recents, state, onOpenEvent }: SearchViewProps) {
  const blank = query.trim() === "";
  const results = state.status === "ready" ? filterEventsByQuery(state.events, query) : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <>
      <form className="app-filters" role="search" onSubmit={submit}>
        <div className="app-filters-inputs">
          <input className="app-filters-input" type="search" aria-label="Поиск событий" placeholder="Событие или город" value={query} onChange={(change) => onQuery(change.target.value)} />
        </div>
      </form>
      {blank && recents.length > 0 && (
        <div className="app-filters-chips" role="group" aria-label="Недавние запросы">
          {recents.map((item) => (
            <AppChip key={item} onClick={() => onQuery(item)}>
              {item}
            </AppChip>
          ))}
        </div>
      )}
      {blank && <AppState>Начните вводить, чтобы найти событие.</AppState>}
      {!blank && state.status === "loading" && <AppState>Ищем события…</AppState>}
      {!blank && state.status === "error" && <AppState error>Не удалось загрузить события для поиска.</AppState>}
      {!blank && state.status === "ready" && results.length === 0 && <AppState>Ничего не найдено. Попробуйте другой запрос.</AppState>}
      {!blank && state.status === "ready" && results.map((item) => <EventCard key={item.id} event={item} onOpen={onOpenEvent} />)}
    </>
  );
}

export function SearchPage() {
  const { navigate } = useRoute();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecentSearches);
  const [state, setState] = useState<SearchState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    apiClient.listEvents({}).then(
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
  }, []);

  const openEvent = useCallback((id: string) => navigate({ name: "event", id }), [navigate]);
  const submit = useCallback(() => {
    setRecents((current) => {
      const next = addRecentSearch(current, query);
      writeRecentSearches(next);
      return next;
    });
  }, [query]);

  return <SearchView query={query} onQuery={setQuery} onSubmit={submit} recents={recents} state={state} onOpenEvent={openEvent} />;
}
