// START_MODULE_CONTRACT
// PURPOSE: Экран 08 «Поиск»: the city switcher and the header identity, the category chips, the swipe/map tiles, «Сегодня для тебя», the «Куда пойдём?» and «Рядом со мной» entries, «Для вас», the «после меня» hint and the «Сегодня рядом» rail over the full catalog.
// SCOPE: The search tab only. Cards come from apiClient.listEventCards (sorted by distance) and the digest from apiClient.getToday; the query is a filter of that request, the recents persist in localStorage. The map (экран 16) and the swipe deck (экран 09) are entered from here, neither is a tab; «Смотреть все» unfolds the catalog screen with its own date/city/rating filters.
// DEPENDS: ../api/client.js (apiClient, CatalogCard, EventFilters), ../auth/AuthContext.js, ../catalog/CatalogPage.js (CatalogPage), ../catalog/format.js (CATEGORY_LABELS), ../geo/viewer-origin.js, ../routing/router.js, ../today/TodaySection.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SearchState - union of the card list fetch states (loading / error / ready)
// - RECENT_SEARCHES_LIMIT - max stored recent queries
// - addRecentSearch - prepend a trimmed query, dedupe case-insensitively, cap at the limit; identity on a blank query
// - SEARCH_CATEGORIES - the category chips in design order, «Все» first
// - searchCities - the cities the loaded cards name, in first-seen order: there is no city directory endpoint to ask
// - railMeta - «2,1 км · Бесплатно»; «от центра», когда точка — центр города
// - SearchTopBar - the city switcher with its menu, the viewer avatar and the search toggle
// - SearchQueryForm - the search field with its recent queries; full-text search is client-visible only as this filter (#497)
// - SearchEntryTiles - «Подбор свайпами» and «На карте»
// - SearchWayTiles - «Куда пойдём?» and «Рядом со мной»
// - SearchNearby - «Сегодня рядом» rail, or the vertical result list once a query narrows it
// - SearchView - presentational: the whole screen from the city pill down to the unfolded catalog
// - SearchPage - container: digest and card fetches per filter, query/recents/city state, navigation to swipe, map, event and the two wizards
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { EventCategory } from "@max-events/api-contracts";
import { apiClient, type CatalogCard, type EventFilters } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CatalogPage } from "../catalog/CatalogPage";
import { CATEGORY_LABELS } from "../catalog/format";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { toggleEventLike, useEventLiked } from "../ui/event-likes";
import { eventFillLabel, pictured } from "../ui/photos";
import { formatPickDistance, formatPickPrice, TodayAfterMeCard, TodayPicksBlock, TodaySummaryBlock, todayAfterMeCard, type DistanceVoice, type TodayState } from "../today/TodaySection";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppSkeleton, AppState } from "../ui/primitives";

export type SearchState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: CatalogCard[] };

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

/** The chips of the design, over the four categories the events domain actually has; undefined is «Все». */
export const SEARCH_CATEGORIES: ReadonlyArray<EventCategory | undefined> = [undefined, "afisha", "tourism", "sport", "volunteering"];

/** There is no city directory to ask, so the switcher offers the cities the loaded catalog names. */
export function searchCities(cards: CatalogCard[]): string[] {
  return [...new Set(cards.map((card) => card.event.city))];
}

/** «2,1 км · Бесплатно». Outside the city the kilometers are from its center, so the line says so. */
export function railMeta(card: CatalogCard, voice: DistanceVoice = "you"): string {
  const distance = formatPickDistance(card.distanceKm);
  const measured = distance === null ? null : distance === "далеко" ? (voice === "center" ? "далеко от центра" : "далеко") : voice === "center" ? `${distance} от центра` : distance;
  return [measured ?? card.placeTitle ?? card.event.city, formatPickPrice(card.event)].join(" · ");
}

interface SearchTopBarProps {
  city: string;
  cities: string[];
  onCity: (city: string) => void;
  initial: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenProfile: () => void;
}

export function SearchTopBar({ city, cities, onCity, initial, searchOpen, onToggleSearch, onOpenProfile }: SearchTopBarProps) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="app-search-top">
      <div className="app-search-city-wrap">
        <button type="button" className="app-search-city" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
          <ActionIcon name="pin" size={16} />
          {city}
          {/* Шеврон нарисован вправо; переключатель города разворачивает его вниз */}
          <span className="app-search-city-caret" aria-hidden="true">
            <ActionIcon name="chevron" size={14} strokeWidth={2} />
          </span>
        </button>
        {menu && (
          <div className="app-search-city-menu" role="listbox" aria-label="Город">
            {cities.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === city}
                className={option === city ? "app-search-city-option app-search-city-option--on" : "app-search-city-option"}
                onClick={() => {
                  onCity(option);
                  setMenu(false);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="app-search-id">
        <button type="button" className="app-search-avatar" aria-label="Профиль" onClick={onOpenProfile}>
          {initial}
        </button>
        <button type="button" className="app-search-icon-btn" aria-label="Поиск" aria-expanded={searchOpen} onClick={onToggleSearch}>
          <ActionIcon name="search" size={20} />
        </button>
      </div>
    </div>
  );
}

export function SearchQueryForm({ query, onQuery, onSubmit, recents }: { query: string; onQuery: (query: string) => void; onSubmit: () => void; recents: string[] }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="app-search-form" role="search" onSubmit={submit}>
      <span className="app-search-field">
        <ActionIcon name="search" size={18} />
        <input className="app-search-input" type="search" aria-label="Поиск событий" placeholder="Событие, место или город" value={query} onChange={(change) => onQuery(change.target.value)} />
      </span>
      {query.trim() === "" && recents.length > 0 && (
        <div className="app-search-recents" role="group" aria-label="Недавние запросы">
          {recents.map((item) => (
            <AppChip key={item} onClick={() => onQuery(item)}>
              {item}
            </AppChip>
          ))}
        </div>
      )}
    </form>
  );
}

export function SearchEntryTiles({ onSwipe, onMap }: { onSwipe: () => void; onMap: () => void }) {
  return (
    <div className="app-search-tiles">
      <button type="button" className="app-search-tile" onClick={onSwipe}>
        <ActionIcon name="cards" size={20} />
        <span className="app-search-tile-text">
          <span className="app-search-tile-title">Подбор свайпами</span>
          <span className="app-search-tile-hint">Места под твой вкус</span>
        </span>
      </button>
      <button type="button" className="app-search-tile" onClick={onMap}>
        <ActionIcon name="pin" size={20} />
        <span className="app-search-tile-text">
          <span className="app-search-tile-title">На карте</span>
          <span className="app-search-tile-hint">Друзья и маршруты</span>
        </span>
      </button>
    </div>
  );
}

/** «Рядом со мной» is a lie when the opened city is measured from its center. */
export function nearbyEntryTitle(inCity: boolean): string {
  return inCity ? "Рядом со мной" : "В городе";
}

export function SearchWayTiles({ onWhereto, onNearby, inCity = true }: { onWhereto: () => void; onNearby: () => void; inCity?: boolean }) {
  return (
    <div className="app-search-ways">
      {/* Тёмная плитка — одна главная точка внимания блока, вторая держится рамкой */}
      <button type="button" className="app-search-way app-search-way--dark" onClick={onWhereto}>
        <ActionIcon name="spark" size={20} />
        <span className="app-search-way-title">Куда пойдём?</span>
        <span className="app-search-way-hint">Три вопроса — пять вариантов</span>
      </button>
      <button type="button" className="app-search-way" onClick={onNearby}>
        <ActionIcon name="clock" size={20} />
        <span className="app-search-way-title">{nearbyEntryTitle(inCity)}</span>
        <span className="app-search-way-hint">Сейчас, через час, вечером</span>
      </button>
    </div>
  );
}

interface SearchNearbyProps {
  state: SearchState;
  query: string;
  expanded: boolean;
  /** The rail lists one city. When the viewer is outside it, the title must not say the events are nearby. */
  inCity?: boolean;
  onExpand: () => void;
  onOpenEvent: (eventId: string) => void;
  onRetry: () => void;
}

function RailCard({ card, inCity, onOpen }: { card: CatalogCard; inCity: boolean; onOpen: () => void }) {
  const liked = useEventLiked(card.event.id);
  const fill = eventFillLabel(card.event);
  return (
    <article className={`app-rail-card app-media--${card.event.category}`}>
      <img className="app-rail-photo" alt="" src={pictured(card.event.id, card.event.coverUrl)} />
      <button type="button" className="app-pick-open" aria-label={card.event.title} onClick={onOpen}>
        <span className="app-rail-kind">{CATEGORY_LABELS[card.event.category]}</span>
        <span className="app-rail-veil">
          <span className="app-rail-title">{card.event.title}</span>
          <span className="app-rail-meta">{[railMeta(card, inCity ? "you" : "center"), fill].filter((part) => part !== null && part !== "").join(" · ")}</span>
        </span>
      </button>
      <button type="button" className="app-pick-save" aria-label="Нравится" aria-pressed={liked} onClick={() => toggleEventLike(card.event.id)}>
        <ActionIcon filled={liked} name="heart" size={16} />
        <span className="app-pick-likes">{(card.event.friendsGoing?.length ?? 0) + (liked ? 1 : 0)}</span>
      </button>
    </article>
  );
}

export function SearchNearby({ state, query, expanded, inCity = true, onExpand, onOpenEvent, onRetry }: SearchNearbyProps) {
  const searching = query.trim() !== "";
  const cards = state.status === "ready" ? state.cards : [];
  const idleTitle = inCity ? "Сегодня рядом" : "Сегодня в городе";
  return (
    <section className="app-rail" aria-label={searching ? "Результаты поиска" : idleTitle}>
      <div className="app-rail-head">
        <h2 className="app-screen-title">{searching ? "Результаты поиска" : idleTitle}</h2>
        {!searching && !expanded && (
          <button type="button" className="app-rail-all" onClick={onExpand}>
            Смотреть все
            <ActionIcon name="chevron" size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {state.status === "loading" && (
        <div className="app-rail-strip" aria-hidden="true">
          {[0, 1, 2].map((tile) => (
            <AppSkeleton key={tile} variant="block" className="app-rail-skeleton" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить события.
        </AppState>
      )}
      {state.status === "ready" && cards.length === 0 && <AppState>{searching ? "Ничего не найдено. Попробуйте другой запрос." : inCity ? "Рядом сегодня пусто. Загляните позже!" : "В городе сегодня пусто. Загляните позже!"}</AppState>}
      {state.status === "ready" && cards.length > 0 && (
        // Горизонтальная лента — витрина; найденное читают списком, а не прокруткой вбок.
        <div className={searching ? "app-rail-list" : "app-rail-strip"}>
          {cards.map((card) => (
            <RailCard key={card.event.id} card={card} inCity={inCity} onOpen={() => onOpenEvent(card.event.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

interface SearchViewProps {
  state: SearchState;
  today: TodayState;
  query: string;
  onQuery: (query: string) => void;
  onSubmit: () => void;
  recents: string[];
  city: string;
  cities: string[];
  onCity: (city: string) => void;
  category: EventCategory | undefined;
  onCategory: (category: EventCategory | undefined) => void;
  initial: string;
  expanded: boolean;
  onExpand: () => void;
  hintDismissed: boolean;
  onDismissHint: () => void;
  now: Date;
  onOpenEvent: (eventId: string) => void;
  onSwipe: () => void;
  onMap: () => void;
  onWhereto: () => void;
  onNearby: () => void;
  onOpenProfile: () => void;
  onRetry: () => void;
  /** False when the digest is measured from the profile city's center, not from the viewer. */
  distancesFromViewer?: boolean;
  /** False when the rail is measured from the selected city's center. */
  catalogInCity?: boolean;
}

export function SearchView(props: SearchViewProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const hint = props.today.status === "ready" ? todayAfterMeCard(props.today.today) : null;
  const distanceFrom = props.distancesFromViewer === false ? "center" : "you";
  return (
    <div className="app-search">
      <SearchTopBar city={props.city} cities={props.cities.length === 0 ? [props.city] : props.cities} onCity={props.onCity} initial={props.initial} searchOpen={searchOpen} onToggleSearch={() => setSearchOpen((open) => !open)} onOpenProfile={props.onOpenProfile} />
      {searchOpen && <SearchQueryForm query={props.query} onQuery={props.onQuery} onSubmit={props.onSubmit} recents={props.recents} />}
      <div className="app-line-tabs" role="tablist" aria-label="Категория">
        {SEARCH_CATEGORIES.map((category) => (
          <button key={category ?? "all"} type="button" role="tab" aria-selected={props.category === category} className={props.category === category ? "app-line-tab app-line-tab--on" : "app-line-tab"} onClick={() => props.onCategory(category)}>
            {category === undefined ? "Все" : CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>
      <SearchEntryTiles onSwipe={props.onSwipe} onMap={props.onMap} />
      <TodaySummaryBlock state={props.today} now={props.now} distanceFrom={distanceFrom} />
      <SearchWayTiles onWhereto={props.onWhereto} onNearby={props.onNearby} inCity={props.distancesFromViewer !== false} />
      <TodayPicksBlock state={props.today} onOpen={props.onOpenEvent} onRetry={props.onRetry} distanceFrom={distanceFrom} />
      {hint !== null && !props.hintDismissed && <TodayAfterMeCard card={hint} onShow={props.onNearby} onDismiss={props.onDismissHint} distanceFrom={distanceFrom} />}
      <SearchNearby state={props.state} query={props.query} expanded={props.expanded} inCity={props.catalogInCity !== false} onExpand={props.onExpand} onOpenEvent={props.onOpenEvent} onRetry={props.onRetry} />
      {/* Полный каталог с его фильтрами по дате, городу и рейтингу: витрина выше показывает ближайшее, вход в каталог живёт здесь */}
      {props.expanded && <CatalogPage />}
    </div>
  );
}

export function SearchPage() {
  const { navigate } = useRoute();
  const auth = useAuth();
  const origin = useViewerOrigin();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecentSearches);
  const [category, setCategory] = useState<EventCategory | undefined>(undefined);
  const [city, setCity] = useState("Москва");
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [today, setToday] = useState<TodayState>({ status: "loading" });
  const now = new Date();

  // «Сегодня рядом» is ordered by distance, so the sort travels with the request rather than being redone here (#497).
  // A GPS fix outside the opened city would mark every card «далеко»; the city's own center is the point then.
  const catalogPoint = useMemo(() => browsedCityOrigin(origin, city), [origin, city]);
  const todayPoint = useMemo(() => browsedCityOrigin(origin, homeCity ?? city), [origin, homeCity, city]);
  const filters = useMemo<EventFilters>(() => ({ category, city, query: query.trim() || undefined, sort: "near" }), [category, city, query]);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (alive) setHomeCity(profile.city);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.listEventCards(filters, { latitude: catalogPoint.latitude, longitude: catalogPoint.longitude }).then(
      (cards) => {
        if (alive) setState({ status: "ready", cards });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [filters, catalogPoint.latitude, catalogPoint.longitude, attempt]);

  useEffect(() => {
    let alive = true;
    setToday({ status: "loading" });
    apiClient.getToday({ latitude: todayPoint.latitude, longitude: todayPoint.longitude }).then(
      (digest) => {
        if (alive) setToday({ status: "ready", today: digest });
      },
      () => {
        if (alive) setToday({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [todayPoint.latitude, todayPoint.longitude, attempt]);

  // Список городов читается один раз и из нефильтрованного каталога: отфильтруй его по городу — и в
  // переключателе останется ровно тот город, который уже выбран. Справочника городов в бэкенде нет.
  useEffect(() => {
    let alive = true;
    apiClient.listEventCards({}).then(
      (cards) => {
        if (alive) setCities(searchCities(cards));
      },
      // Переключатель — удобство поверх работающего экрана: не загрузился, значит остаётся текущий город.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(() => {
    setRecents((current) => {
      const next = addRecentSearch(current, query);
      writeRecentSearches(next);
      return next;
    });
  }, [query]);

  return <SearchView state={state} today={today} query={query} onQuery={setQuery} onSubmit={submit} recents={recents} city={city} cities={cities} onCity={setCity} category={category} onCategory={setCategory} initial={auth.status === "authenticated" ? auth.user.firstName.charAt(0) : "?"} expanded={expanded} onExpand={() => setExpanded(true)} hintDismissed={hintDismissed} onDismissHint={() => setHintDismissed(true)} now={now} onOpenEvent={(id) => navigate({ name: "event", id })} onSwipe={() => navigate({ name: "swipe" })} onMap={() => navigate({ name: "map" })} onWhereto={() => navigate({ name: "whereto" })} onNearby={() => navigate({ name: "nearby" })} onOpenProfile={() => navigate({ name: "profile" })} onRetry={() => setAttempt((count) => count + 1)} distancesFromViewer={todayPoint.fromViewer} catalogInCity={catalogPoint.fromViewer} />;
}
