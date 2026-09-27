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
// - cardsByIds - catalog cards in the order of a digest bucket
// - selectBrowseCards - the list a stat or a query should show; digest buckets win over a local guess
// - browseTitle - header of that list
// - browseEmptyCopy - «Ничего не нашлось…»
// - BrowseSuggestion - one AI pick shown when the query itself missed
// - BrowseView - the list, the empty line and the similar events
// - BrowsePage - container: fetches the cards for the route and opens an event
// END_MODULE_MAP

import { useEffect, useMemo, useState } from "react";
import type { AssistCriteria, Event } from "@max-events/api-contracts";
import { formatTodayDate } from "../today/TodaySection";
import { apiClient, type CatalogCard, type EventFilters, type TodayCard, type TodayDigest } from "../api/client";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { useRoute, type BrowseList } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeleton, AppState } from "../ui/primitives";
import { EventPoster } from "./EventPoster";
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

/** Catalog rows lined up with a counter: an id the page did not load is skipped, the rest keep the bucket order. */
export function cardsByIds(cards: CatalogCard[], ids: readonly string[]): CatalogCard[] {
  const byId = new Map(cards.map((card) => [card.event.id, card]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}

export function selectBrowseCards(cards: CatalogCard[], list: BrowseList, interests: string[], digest: TodayDigest | null = null): CatalogCard[] {
  const buckets = digest?.buckets;
  if (buckets && list === "friends") return cardsByIds(cards, buckets.friendIds);
  if (buckets && list === "suitable") return cardsByIds(cards, buckets.suitableIds);
  if (buckets && list === "nearby") return cardsByIds(cards, buckets.nearbyIds);
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

export function countsForCards(cards: CatalogCard[], interests: string[]): { nearbyCount: number; suitableCount: number; withFriendsCount: number; nearbyIds: string[]; suitableIds: string[]; friendIds: string[] } {
  const suitable = interests.length > 0 ? cards.filter((card) => eventFitsInterests(card.event, interests)) : cards;
  const friends = selectFriendCards(cards, []);
  return {
    nearbyCount: cards.length,
    suitableCount: suitable.length,
    withFriendsCount: friends.length,
    nearbyIds: cards.map((card) => card.event.id),
    suitableIds: suitable.map((card) => card.event.id),
    friendIds: friends.map((card) => card.event.id),
  };
}

export function browseTitle(list: BrowseList, query?: string, date?: string): string {
  if (list === "results") {
    const text = query?.trim() ?? "";
    return text === "" ? "Поиск" : text;
  }
  if (list === "suitable") return "Подходят тебе";
  if (list === "friends") return "С друзьями";
  if (date) return formatTodayDate(new Date(`${date}T12:00:00`));
  return "Сегодня рядом";
}

export function browseEmptyCopy(list: BrowseList, query?: string): string {
  if (list === "results") return `Ничего не нашлось по запросу «${(query ?? "").trim()}».`;
  if (list === "suitable") return "Под интересы пока ничего. Их можно поправить в профиле.";
  if (list === "friends") return "С друзьями сегодня ничего нет.";
  return "Рядом сегодня пусто. Загляните позже!";
}

export type BrowseSuggestion = { card: CatalogCard; reason: string | null };

/** An untouched parse matches the whole catalog. That is not a similar-events answer. */
export function assistNarrowed(criteria: AssistCriteria): boolean {
  return criteria.genre !== "any" || criteria.when !== "any" || criteria.budgetMaxRub !== null || criteria.company !== "alone";
}

type BrowseStatus = { status: "loading" } | { status: "error" } | { status: "ready"; cards: CatalogCard[]; suggestions: BrowseSuggestion[]; suggesting: boolean };

export function BrowseView({ list, query, date, state, inCity, onOpen, onBack, onRetry }: { list: BrowseList; query?: string; date?: string; state: BrowseStatus; inCity: boolean; onOpen: (eventId: string) => void; onBack: () => void; onRetry: () => void }) {
  const title = browseTitle(list, query, date);
  const voice = inCity ? "you" : "center";
  const row = (card: CatalogCard, reason: string | null = null) => <EventPoster key={card.event.id} card={card} reason={reason ?? railMeta(card, voice)} onOpen={onOpen} />;
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
          <AppState>{browseEmptyCopy(list, query)}</AppState>
          {state.suggesting && (
            <p className="app-ai-seek" role="status">
              <span className="app-ai-seek-word">Подбираем похожее</span>
            </p>
          )}
          {state.suggestions.length > 0 && (
            <div className="app-browse-similar">
              <h2 className="app-browse-similar-title">Похожее</h2>
              <div className="app-browse-list">{state.suggestions.map((item) => row(item.card, item.reason))}</div>
            </div>
          )}
        </>
      )}
      {state.status === "ready" && state.cards.length > 0 && <div className="app-browse-list">{state.cards.map((card) => row(card))}</div>}
    </section>
  );
}

export function BrowsePage({ list, query, city, date }: { list: BrowseList; query?: string; city?: string; date?: string }) {
  const origin = useViewerOrigin();
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [cityReady, setCityReady] = useState(list === "results");
  const [interests, setInterests] = useState<string[] | null>(list === "suitable" ? null : []);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BrowseStatus>({ status: "loading" });
  const { navigate, back } = useRoute();
  const routeCity = city ?? homeCity ?? "Москва";
  const point = useMemo(() => browsedCityOrigin(origin, list === "results" ? routeCity : (homeCity ?? routeCity)), [origin, homeCity, list, routeCity]);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (!alive) return;
        setHomeCity(profile.city);
        if (list === "suitable") setInterests(profile.interests);
        setCityReady(true);
      },
      () => {
        if (!alive) return;
        if (list === "suitable") setInterests([]);
        setCityReady(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [list]);

  useEffect(() => {
    if (!cityReady) return;
    if (list === "suitable" && interests === null) return;
    let alive = true;
    setState({ status: "loading" });
    // The three tiles count the profile city from now on. A search city must not swap that set.
    const listCity = list === "results" ? routeCity : (homeCity ?? routeCity);
    const filters: EventFilters = {
      city: listCity,
      sort: list === "results" ? "near" : "soon",
      limit: 100,
      ...(date ? { date } : list === "results" ? {} : { dateFrom: new Date(Date.now() - 2 * 60 * 1000).toISOString() }),
      ...(list === "results" && query ? { query } : {}),
    };
    const originPoint = { latitude: point.latitude, longitude: point.longitude };
    const digestPromise = date || list === "results" ? Promise.resolve(null) : apiClient.getToday(originPoint).catch(() => null);
    Promise.all([apiClient.listEventCards(filters, originPoint), digestPromise]).then(
      ([cards, digest]) => {
        const picked = selectBrowseCards(cards, list, interests ?? [], digest);
        if (list === "results" && picked.length === 0 && query) {
          if (alive) setState({ status: "ready", cards: [], suggestions: [], suggesting: true });
          apiClient.assistQuery(query).then(
            (result) => {
              if (!alive) return;
              const suggestions = assistNarrowed(result.criteria)
                ? result.items.map((item) => ({
                    card: { event: item.event, distanceKm: item.event.distanceKm ?? null, rating: item.event.ratingAverage ?? null, placeTitle: null },
                    reason: item.explanation,
                  }))
                : [];
              setState({ status: "ready", cards: [], suggesting: false, suggestions });
            },
            () => {
              if (alive) setState({ status: "ready", cards: [], suggestions: [], suggesting: false });
            },
          );
          return;
        }
        if (alive) setState({ status: "ready", cards: picked, suggestions: [], suggesting: false });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt, cityReady, date, homeCity, interests, list, point.latitude, point.longitude, query, routeCity]);

  return <BrowseView list={list} query={query} date={date} state={state} inCity={point.fromViewer} onOpen={(id) => navigate({ name: "event", id })} onBack={back} onRetry={() => setAttempt((count) => count + 1)} />;
}
