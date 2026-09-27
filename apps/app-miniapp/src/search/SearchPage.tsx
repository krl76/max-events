// START_MODULE_CONTRACT
// PURPOSE: Экран 08 «Поиск»: the city switcher, «Спросить MAX», the category chips, the swipe/map tiles, «Сегодня для тебя», the «Куда пойдём?» and «Рядом со мной» entries, a short entry to micro-events, «После меня» when the taste graph has something, and the «Сегодня рядом» rail over the full catalog.
// SCOPE: The search tab only. Cards come from apiClient.listEventCards (sorted by distance) and the digest from apiClient.getToday; a query, «Смотреть все» and the three counters open a separate list. Recents persist in localStorage. The map (экран 16) and the swipe deck (экран 09) are entered from here, neither is a tab.
// DEPENDS: ../api/client.js (apiClient, CatalogCard, EventFilters), ../auth/AuthContext.js, ../catalog/format.js (CATEGORY_LABELS), ../geo/viewer-origin.js, ../routing/router.js, ../today/TodaySection.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
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
// - SearchTopBar - the city switcher with its menu
// - SearchHubRows - «Спросить MAX» under the header, and «Микро-события» as one row rather than a second feed
// - SearchQueryForm - the search field with its recent queries; full-text search is client-visible only as this filter (#497)
// - SearchEntryTiles - «Подбор свайпами» and «На карте»
// - SearchWayTiles - «Куда пойдём?» and «Рядом со мной»
// - SearchNearby - «Сегодня рядом» rail, or the vertical result list once a query narrows it
// - SearchView - presentational: the whole screen from the city pill down to the unfolded catalog
// - SearchPage - container: digest and card fetches per filter, query/recents/city state, navigation to swipe, map, event and the two wizards
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSheetSwipe } from "../ui/sheet";
import type { EventCategory } from "@max-events/api-contracts";
import { apiClient, type CatalogCard, type EventFilters } from "../api/client";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { EventPoster } from "./EventPoster";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { useRoute, type BrowseList } from "../routing/router";
import { countsForCards } from "./BrowsePage";
import { toggleEventLike, useEventLiked } from "../ui/event-likes";
import { eventFillLabel, pictured } from "../ui/photos";
import { dayKey, formatPickDistance, formatPickPrice, TodaySummaryBlock, todayPickCards, type DistanceVoice, type TodayState } from "../today/TodaySection";
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
  trailing?: ReactNode;
}

export function SearchTopBar({ city, cities, onCity, trailing }: SearchTopBarProps) {
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
      {trailing}
    </div>
  );
}

export function SearchQueryForm({ query, onQuery, onSubmit, onPickRecent, recents, autoFocus = false }: { query: string; onQuery: (query: string) => void; onSubmit: () => void; onPickRecent?: (query: string) => void; recents: string[]; autoFocus?: boolean }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="app-search-form" role="search" onSubmit={submit}>
      <span className="app-search-field">
        <ActionIcon name="search" size={18} />
        <input className="app-search-input" type="search" aria-label="Поиск событий" placeholder="Событие, место или город" value={query} autoFocus={autoFocus} onChange={(change) => onQuery(change.target.value)} />
        <button type="submit" className="app-search-go" aria-label="Найти" disabled={query.trim() === ""}>
          <ActionIcon name="arrow" size={16} />
        </button>
      </span>
      {query.trim() === "" && recents.length > 0 && (
        <div className="app-search-recents" role="group" aria-label="Недавние запросы">
          <span className="app-search-recents-label">Недавние</span>
          {recents.map((item) => (
            <button key={item} type="button" className="app-search-recent" onClick={() => (onPickRecent ?? onQuery)(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

/** Categories live in this sheet, not as a permanent row on the search screen. */
export function SearchFilterSheet({ category, onCategory, onClose }: { category: EventCategory | undefined; onCategory: (category: EventCategory | undefined) => void; onClose: () => void }) {
  const swipe = useSheetSwipe(onClose);
  return (
    <div className="app-picker" role="dialog" aria-modal="true" aria-label="Фильтры">
      <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-picker-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <div className="app-picker-head">
          <h2 className="app-picker-title">Фильтры</h2>
        </div>
        <div className="app-filters-chips" role="group" aria-label="Категория">
          {SEARCH_CATEGORIES.map((item) => (
            <AppChip key={item ?? "all"} pressed={category === item} onClick={() => onCategory(item)}>
              {item === undefined ? "Все" : CATEGORY_LABELS[item]}
            </AppChip>
          ))}
        </div>
        {category !== undefined && (
          <button type="button" className="app-filters-reset" onClick={() => onCategory(undefined)}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}

export function SearchFilters({ category, onCategory }: { category: EventCategory | undefined; onCategory: (category: EventCategory | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const chosen = category !== undefined;
  return (
    <>
      <button type="button" className={chosen ? "app-search-filter app-search-filter--on" : "app-search-filter"} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <ActionIcon name="filter" size={16} />
        {chosen ? CATEGORY_LABELS[category] : "Фильтры"}
      </button>
      {open && (
        <SearchFilterSheet
          category={category}
          onCategory={(next) => {
            onCategory(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const SEARCH_TOOLS: Array<{ id: string; label: string; aria: string; icon: "spark" | "cards" | "pin" | "sparkle" | "clock" | "users"; dark?: boolean }> = [
  { id: "ask", label: "Спросить", aria: "Спросить MAX", icon: "spark", dark: true },
  { id: "swipe", label: "Свайпы", aria: "Подбор свайпами", icon: "cards" },
  { id: "map", label: "Карта", aria: "На карте", icon: "pin" },
  { id: "whereto", label: "Куда", aria: "Куда пойдём?", icon: "sparkle" },
  { id: "nearby", label: "Рядом", aria: "Рядом со мной", icon: "clock" },
  { id: "micro", label: "Сборы", aria: "Микро-события", icon: "users" },
];

/** Six doors, one grid. The screens themselves stay where they were. */
export function SearchTools({ onAsk, onSwipe, onMap, onWhereto, onNearby, onMicro, nearbyLabel = "Рядом", nearbyAria = "Рядом со мной" }: { onAsk: () => void; onSwipe: () => void; onMap: () => void; onWhereto: () => void; onNearby: () => void; onMicro: () => void; nearbyLabel?: string; nearbyAria?: string }) {
  const go = { ask: onAsk, swipe: onSwipe, map: onMap, whereto: onWhereto, nearby: onNearby, micro: onMicro };
  return (
    <div className="app-search-tools">
      {SEARCH_TOOLS.map((tool) => (
        <button key={tool.id} type="button" className="app-search-tool" aria-label={tool.id === "nearby" ? nearbyAria : tool.aria} onClick={go[tool.id as keyof typeof go]}>
          <span className={tool.dark ? "app-search-tool-bubble app-search-tool-bubble--dark" : "app-search-tool-bubble"}>
            <ActionIcon name={tool.icon} size={20} />
          </span>
          {tool.id === "nearby" ? nearbyLabel : tool.label}
        </button>
      ))}
    </div>
  );
}

/** One row, not a form: the conversation itself is the MAX AI screen. */
export function SearchAskRow({ onAsk }: { onAsk: () => void }) {
  return (
    <button type="button" className="app-search-hub-row app-search-hub-row--ask" onClick={onAsk}>
      <ActionIcon name="spark" size={20} />
      <span className="app-search-hub-copy">
        <span className="app-search-hub-title">Спросить MAX</span>
        <span className="app-search-hub-hint">Событие, вечер или план на день</span>
      </span>
      <ActionIcon name="chevron" size={16} />
    </button>
  );
}

/** The open gatherings live on their own screen. Search only shows the door, so the catalog stays the page. */
export function SearchMicroRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="app-search-hub-row" onClick={onOpen}>
      <ActionIcon name="users" size={20} />
      <span className="app-search-hub-copy">
        <span className="app-search-hub-title">Микро-события</span>
        <span className="app-search-hub-hint">Сборы рядом, которых нет в афише</span>
      </span>
      <ActionIcon name="chevron" size={16} />
    </button>
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
  /** The rail lists one city. When the viewer is outside it, the title must not say the events are nearby. */
  inCity?: boolean;
  onExpand: () => void;
  onOpenEvent: (eventId: string) => void;
  onRetry: () => void;
  /** The fold button already names the section. */
  showHeading?: boolean;
  /** «Смотреть все» opens the full list. The afisha fold is already that list. */
  showAll?: boolean;
  layout?: "strip" | "list";
  emptyCopy?: string;
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
      </button>
    </article>
  );
}

export function SearchNearby({ state, inCity = true, onExpand, onOpenEvent, onRetry, showHeading = true, showAll = true, layout = "strip", emptyCopy }: SearchNearbyProps) {
  const cards = state.status === "ready" ? state.cards : [];
  const idleTitle = inCity ? "Сегодня рядом" : "Сегодня в городе";
  const empty = emptyCopy ?? (inCity ? "Рядом сегодня пусто. Загляните позже!" : "В городе сегодня пусто. Загляните позже!");
  return (
    <section className="app-rail" aria-label={idleTitle}>
      {(showHeading || showAll) && (
        <div className="app-rail-head">
          {showHeading && <h2 className="app-screen-title">{idleTitle}</h2>}
          {showAll && (
            <button type="button" className="app-rail-all" onClick={onExpand}>
              Смотреть все
              <ActionIcon name="chevron" size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
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
      {state.status === "ready" && cards.length === 0 && <AppState>{empty}</AppState>}
      {state.status === "ready" && cards.length > 0 && (
        <div className={layout === "list" ? "app-rail-list" : "app-rail-strip"}>
          {cards.map((card) => (
            <RailCard key={card.event.id} card={card} inCity={inCity} onOpen={() => onOpenEvent(card.event.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export type SearchFoldId = "nearby" | "picks" | "after" | "afisha";

/** One closed section under «Сегодня для тебя». Opening it shows the events that section was holding. */
export function SearchFold({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={open ? "app-search-fold app-search-fold--open" : "app-search-fold"}>
      <button type="button" className="app-search-fold-btn" aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        <span className="app-search-fold-caret" aria-hidden="true">
          <ActionIcon name="chevron" size={16} />
        </span>
      </button>
      {open && <div className="app-search-fold-panel">{children}</div>}
    </div>
  );
}

interface SearchViewProps {
  state: SearchState;
  today: TodayState;
  query: string;
  onQuery: (query: string) => void;
  onSubmit: () => void;
  onPickRecent: (query: string) => void;
  onOpenList: (list: BrowseList) => void;
  recents: string[];
  city: string;
  cities: string[];
  onCity: (city: string) => void;
  category: EventCategory | undefined;
  onCategory: (category: EventCategory | undefined) => void;
  onExpand: () => void;
  hintDismissed: boolean;
  onDismissHint: () => void;
  now: Date;
  onOpenEvent: (eventId: string) => void;
  onSwipe: () => void;
  onMap: () => void;
  onWhereto: () => void;
  onNearby: () => void;
  onAsk: () => void;
  onOpenMicro: () => void;
  onRetry: () => void;
  /** The feed search icon opens this screen with the field already open. */
  searchFieldOpen?: boolean;
  /** False when the digest is measured from the profile city's center, not from the viewer. */
  distancesFromViewer?: boolean;
  /** False when the rail is measured from the selected city's center. */
  catalogInCity?: boolean;
  /** YYYY-MM-DD the summary date control is showing. */
  day: string;
  onDay: (day: string) => void;
  /** True when the chosen day is not today, so the folds follow that day's cards. */
  dayScoped?: boolean;
  suitableState?: SearchState;
}

function foldFact(count: number, lead: string, sample: string | null): string {
  if (count === 0) return "Пока пусто";
  const noun = `${count} ${pluralRu(count, "событие", "события", "событий")}`;
  const tail = sample === null ? "" : ` · ${sample}`;
  return `${noun} ${lead}${tail}`;
}

export function SearchView(props: SearchViewProps) {
  const [fold, setFold] = useState<null | "bill" | "you">(null);
  const distanceFrom = props.distancesFromViewer === false ? "center" : "you";
  const inCity = props.distancesFromViewer !== false;
  const catalog = props.state.status === "ready" ? props.state.cards : [];
  const picks = props.today.status === "ready" ? todayPickCards(props.today.today) : [];
  const suitable = props.suitableState?.status === "ready" ? props.suitableState.cards : [];
  const forYou = suitable.length > 0 ? suitable : picks;
  const nearbyPhotos = catalog.slice(0, 3).map((card) => pictured(card.event.id, card.event.coverUrl));
  const suitablePhotos = forYou.slice(0, 3).map((card) => pictured(card.event.id, card.event.coverUrl));
  const billPhoto = catalog[0] === undefined ? null : pictured(catalog[0].event.id, catalog[0].event.coverUrl);
  const youPhoto = forYou[0] === undefined ? null : pictured(forYou[0].event.id, forYou[0].event.coverUrl);
  const openFold = (next: "bill" | "you") => setFold((current) => (current === next ? null : next));
  const shown = fold === "bill" ? catalog : fold === "you" ? forYou : [];
  const squares = [
    { key: "bill" as const, title: "Афиша", fact: foldFact(catalog.length, "в городе", catalog[0]?.event.title ?? null), photo: billPhoto },
    { key: "you" as const, title: "Для вас", fact: foldFact(forYou.length, "под вас", forYou[0]?.event.title ?? null), photo: youPhoto },
  ];
  return (
    <div className="app-search">
      <SearchTopBar city={props.city} cities={props.cities.length === 0 ? [props.city] : props.cities} onCity={props.onCity} trailing={<SearchFilters category={props.category} onCategory={props.onCategory} />} />
      <SearchQueryForm query={props.query} onQuery={props.onQuery} onSubmit={props.onSubmit} onPickRecent={props.onPickRecent} recents={props.recents} autoFocus={props.searchFieldOpen === true} />
      <SearchTools onAsk={props.onAsk} onSwipe={props.onSwipe} onMap={props.onMap} onWhereto={props.onWhereto} onNearby={props.onNearby} onMicro={props.onOpenMicro} nearbyLabel={inCity ? "Рядом" : "Город"} nearbyAria={nearbyEntryTitle(inCity)} />
      <TodaySummaryBlock state={props.today} now={props.now} day={props.day} onDay={props.onDay} distanceFrom={distanceFrom} onOpenNearby={() => openFold("bill")} onOpenSuitable={() => openFold("you")} onOpenFriends={() => props.onOpenList("friends")} nearbyPhotos={nearbyPhotos} suitablePhotos={suitablePhotos} />
      <div className="app-search-squares">
        {squares.map((square) => (
          <button key={square.key} type="button" className={fold === square.key ? "app-search-square app-search-square--open" : "app-search-square"} aria-expanded={fold === square.key} style={square.photo ? { backgroundImage: `url("${square.photo}")` } : undefined} onClick={() => openFold(square.key)}>
            {square.photo !== null && <img alt="" src={square.photo} />}
            <span className="app-search-square-veil">
              <span className="app-search-square-title">{square.title}</span>
              <span className="app-search-square-fact">{square.fact}</span>
            </span>
          </button>
        ))}
      </div>
      {fold !== null && (
        <div className="app-search-feed" aria-label={fold === "bill" ? "Афиша" : "Для вас"}>
          {shown.length === 0 ? <p className="app-today-quiet">В этом разделе пока пусто.</p> : shown.map((card) => <EventPoster key={card.event.id} card={card} onOpen={props.onOpenEvent} />)}
        </div>
      )}
    </div>
  );
}

export function SearchPage() {
  const { navigate, route } = useRoute();
  const origin = useViewerOrigin();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecentSearches);
  const [category, setCategory] = useState<EventCategory | undefined>(undefined);
  const [city, setCity] = useState("Москва");
  const [interests, setInterests] = useState<string[]>([]);
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [today, setToday] = useState<TodayState>({ status: "loading" });
  const now = new Date();
  const todayKey = dayKey(now);
  const dayScoped = day !== todayKey;

  // «Сегодня рядом» is ordered by distance, so the sort travels with the request rather than being redone here (#497).
  // A GPS fix outside the opened city would mark every card «далеко»; the city's own center is the point then.
  const catalogPoint = useMemo(() => browsedCityOrigin(origin, city), [origin, city]);
  const todayPoint = useMemo(() => browsedCityOrigin(origin, homeCity ?? city), [origin, homeCity, city]);
  const filters = useMemo<EventFilters>(() => ({ category, city, sort: "near", ...(dayScoped ? { date: day } : {}) }), [category, city, day, dayScoped]);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (!alive) return;
        setHomeCity(profile.city);
        setInterests(profile.interests);
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

  const dayCounts = state.status === "ready" ? countsForCards(state.cards, interests) : null;
  const shownToday: TodayState = !dayScoped ? today : state.status === "ready" && dayCounts !== null ? { status: "ready", today: { summary: { nearbyCount: dayCounts.nearbyCount, suitableCount: dayCounts.suitableCount, withFriendsCount: dayCounts.withFriendsCount }, cards: [] } } : { status: "loading" };
  const suitableState: SearchState = state.status !== "ready" || dayCounts === null ? state : { status: "ready", cards: state.cards.filter((card) => dayCounts.suitableIds.includes(card.event.id)) };
  const openDay = dayScoped ? { date: day } : {};

  const openResults = useCallback(
    (text: string) => {
      const normalized = text.trim();
      if (normalized === "") return;
      setQuery(normalized);
      setRecents((current) => {
        const next = addRecentSearch(current, normalized);
        writeRecentSearches(next);
        return next;
      });
      navigate({ name: "browse", list: "results", query: normalized, city });
    },
    [city, navigate],
  );

  return <SearchView state={state} today={shownToday} query={query} onQuery={setQuery} onSubmit={() => openResults(query)} onPickRecent={openResults} onOpenList={(list) => navigate({ name: "browse", list, city, ...openDay })} recents={recents} city={city} cities={cities} onCity={setCity} category={category} onCategory={setCategory} onExpand={() => navigate({ name: "browse", list: "nearby", city, ...openDay })} hintDismissed={hintDismissed} onDismissHint={() => setHintDismissed(true)} now={now} day={day} onDay={(next) => { if (/^\d{4}-\d{2}-\d{2}$/.test(next)) setDay(next); }} dayScoped={dayScoped} suitableState={suitableState} onOpenEvent={(id) => navigate({ name: "event", id })} onSwipe={() => navigate({ name: "swipe" })} onMap={() => navigate({ name: "map" })} onWhereto={() => navigate({ name: "whereto" })} onNearby={() => navigate({ name: "nearby" })} onAsk={() => navigate({ name: "assist", ask: null })} onOpenMicro={() => navigate({ name: "micro" })} onRetry={() => setAttempt((count) => count + 1)} searchFieldOpen={route.name === "search" && route.focus === true} distancesFromViewer={todayPoint.fromViewer} catalogInCity={catalogPoint.fromViewer} />;
}
