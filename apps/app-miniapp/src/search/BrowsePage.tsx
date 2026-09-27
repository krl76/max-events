// START_MODULE_CONTRACT
// PURPOSE: Separate lists opened from search: nearby events, events that fit interests, events with friends, and query results.
// SCOPE: One screen for those four lists. Cards come from apiClient.listEventCards; interest matching follows the today digest. An empty query offers other nearby events.
// DEPENDS: ../api/client.js, ../geo/viewer-origin.js, ../routing/router.js, ../ui/Layout.js, ../ui/photos.js, ../ui/primitives.js, ./SearchPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BrowseList - nearby | suitable | friends | results
// - eventFitsInterests - the today-digest interest rule, so «Подходят тебе» matches the counter
// - selectBrowseCards - the list a stat or a query should show
// - browseTitle - header of that list
// - browseEmptyCopy - «Ничего не нашлось…» plus the offer of something else
// - BrowseView - the list, the empty line and the suggested events
// - BrowsePage - container: fetches the cards for the route and opens an event
// END_MODULE_MAP

import { useEffect, useMemo, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient, type CatalogCard, type EventFilters, type TodayCard, type TodayDigest } from "../api/client";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { useRoute, type BrowseList } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppSkeleton, AppState } from "../ui/primitives";
import { railMeta } from "./SearchPage";

export type { BrowseList };

const INTEREST_CATEGORIES: Record<string, readonly Event["category"][]> = {
  концерты: ["afisha"],
  театр: ["afisha"],
  выставки: ["afisha"],
  лекции: ["afisha"],
  "ночная жизнь": ["afisha"],
  настолки: ["afisha"],
  "еда и рынки": ["afisha", "tourism"],
  спорт: ["sport"],
  йога: ["sport"],
  "на природе": ["tourism"],
  "с детьми": ["afisha", "tourism"],
  волонтёрство: ["volunteering"],
};

/** Same rule as the today digest: an empty interest list counts every event, a word matches the title or its category. */
export function eventFitsInterests(event: Pick<Event, "category" | "title" | "description">, interests: string[]): boolean {
  if (interests.length === 0) return true;
  const haystack = `${event.category} ${event.title} ${event.description}`.toLowerCase();
  return interests.some((interest) => {
    const needle = interest.toLowerCase();
    if (haystack.includes(needle)) return true;
    return INTEREST_CATEGORIES[needle]?.includes(event.category) === true;
  });
}

export function selectBrowseCards(cards: CatalogCard[], list: BrowseList, interests: string[], digest: TodayDigest | null = null): CatalogCard[] {
  if (list === "friends") return selectFriendCards(cards, digest?.cards ?? []);
  if (list === "suitable") return selectSuitableCards(cards, interests, digest);
  return cards;
}

/** Friends named on the catalog win. The digest labels cover a demo where the catalog cards carry no company. */
export function selectFriendCards(catalog: CatalogCard[], digestCards: TodayCard[]): CatalogCard[] {
  const going = catalog.filter((card) => (card.event.friendsGoing?.length ?? 0) > 0);
  if (going.length > 0) return going;
  return digestCards.filter((card) => card.labels.some((label) => label.kind === "friend_attending"));
}

/**
 * Stored interests narrow the catalog the way the today counter does.
 * With none stored, a digest whose suitable count is exactly its own cards is that personal set;
 * otherwise every catalog event counts, which is what the counter does for an empty interest list.
 */
export function selectSuitableCards(catalog: CatalogCard[], interests: string[], digest: TodayDigest | null): CatalogCard[] {
  if (interests.length > 0) return catalog.filter((card) => eventFitsInterests(card.event, interests));
  if (digest && digest.cards.length > 0 && digest.summary.suitableCount === digest.cards.length) return digest.cards;
  return catalog;
}

export function browseTitle(list: BrowseList, query?: string): string {
  if (list === "results") {
    const text = query?.trim() ?? "";
    return text === "" ? "Поиск" : text;
  }
  if (list === "suitable") return "Подходят тебе";
  if (list === "friends") return "С друзьями";
  return "Сегодня рядом";
}

export function browseEmptyCopy(list: BrowseList, query?: string): string {
  if (list === "results") return `Ничего не нашлось по запросу «${(query ?? "").trim()}».`;
  if (list === "suitable") return "Под интересы пока ничего. Их можно поправить в профиле.";
  if (list === "friends") return "С друзьями сегодня ничего нет.";
  return "Рядом сегодня пусто. Загляните позже!";
}

type BrowseStatus = { status: "loading" } | { status: "error" } | { status: "ready"; cards: CatalogCard[]; suggestions: CatalogCard[] };

export function BrowseView({ list, query, state, inCity, onOpen, onBack, onRetry }: { list: BrowseList; query?: string; state: BrowseStatus; inCity: boolean; onOpen: (eventId: string) => void; onBack: () => void; onRetry: () => void }) {
  const title = browseTitle(list, query);
  const voice = inCity ? "you" : "center";
  const row = (card: CatalogCard) => (
    <button key={card.event.id} type="button" className="app-browse-row" onClick={() => onOpen(card.event.id)}>
      <img className="app-browse-photo" alt="" src={pictured(card.event.id, card.event.coverUrl)} />
      <span className="app-browse-copy">
        <span className="app-browse-title">{card.event.title}</span>
        <span className="app-browse-meta">{railMeta(card, voice)}</span>
      </span>
    </button>
  );
  return (
    <section className="app-browse" aria-label={title}>
      <div className="app-browse-top">
        <button type="button" className="app-browse-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={22} />
        </button>
        <h1 className="app-browse-heading">{title}</h1>
      </div>
      {state.status === "loading" && (
        <div aria-hidden="true">
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      )}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить события.
        </AppState>
      )}
      {state.status === "ready" && state.cards.length === 0 && (
        <>
          <AppState>
            {browseEmptyCopy(list, query)}
            {state.suggestions.length > 0 ? " Может подойти вот это." : ""}
          </AppState>
          {state.suggestions.length > 0 && (
            <>
              <h2 className="app-browse-suggest">Может подойти</h2>
              <div className="app-browse-list">{state.suggestions.map(row)}</div>
            </>
          )}
        </>
      )}
      {state.status === "ready" && state.cards.length > 0 && <div className="app-browse-list">{state.cards.map(row)}</div>}
    </section>
  );
}

export function BrowsePage({ list, query, city }: { list: BrowseList; query?: string; city?: string }) {
  const origin = useViewerOrigin();
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[] | null>(list === "suitable" ? null : []);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BrowseStatus>({ status: "loading" });
  const { navigate, back } = useRoute();
  const place = city ?? homeCity ?? "Москва";
  const point = useMemo(() => browsedCityOrigin(origin, place), [origin, place]);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (!alive) return;
        setHomeCity(profile.city);
        if (list === "suitable") setInterests(profile.interests);
      },
      () => {
        if (alive && list === "suitable") setInterests([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [list]);

  useEffect(() => {
    if (list === "suitable" && interests === null) return;
    let alive = true;
    setState({ status: "loading" });
    const filters: EventFilters = { city: place, sort: "near", ...(list === "results" && query ? { query } : {}) };
    const originPoint = { latitude: point.latitude, longitude: point.longitude };
    const digestPromise = list === "suitable" || list === "friends" ? apiClient.getToday(originPoint).catch(() => null) : Promise.resolve(null);
    Promise.all([apiClient.listEventCards(filters, originPoint), digestPromise]).then(
      ([cards, digest]) => {
        const picked = selectBrowseCards(cards, list, interests ?? [], digest);
        if (list === "results" && picked.length === 0) {
          apiClient.listEventCards({ city: place, sort: "near" }, originPoint).then(
            (suggestions) => {
              if (alive) setState({ status: "ready", cards: [], suggestions: suggestions.slice(0, 6) });
            },
            () => {
              if (alive) setState({ status: "ready", cards: [], suggestions: [] });
            },
          );
          return;
        }
        if (alive) setState({ status: "ready", cards: picked, suggestions: [] });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt, interests, list, place, point.latitude, point.longitude, query]);

  return <BrowseView list={list} query={query} state={state} inCity={point.fromViewer} onOpen={(id) => navigate({ name: "event", id })} onBack={back} onRetry={() => setAttempt((count) => count + 1)} />;
}
