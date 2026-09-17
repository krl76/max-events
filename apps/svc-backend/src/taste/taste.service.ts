// START_MODULE_CONTRACT
// PURPOSE: Taste graph from check-ins and reviews; «После меня» follow-on event suggestions.
// SCOPE: profile() weights + transitions; afterMe() strongest transition with upcoming published events.
// DEPENDS: typeorm, @max-events/api-contracts, check-ins/events/places/reviews
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EVENT_CATEGORY_RU - Russian labels for explanations
// - TasteGraph - weights and transitions
// - buildTasteGraph - pure aggregation
// - strongestAfterMe - follow-on category
// - formatAfterMeExplanation - README-style copy
// - TasteService - profile/afterMe
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import {
  EventCategorySchema,
  PlaceCategorySchema,
  type AfterMeResponse,
  type AfterMeSuggestion,
  type EventCategory,
  type PlaceCategory,
  type TasteProfile,
  type TasteTransition,
} from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewEntity } from "../reviews/review.entity";

export const EVENT_CATEGORY_RU: Record<EventCategory, string> = {
  afisha: "афиша",
  volunteering: "волонтёрство",
  tourism: "туризм",
  sport: "спорт",
};

export type TasteGraph = {
  eventWeights: Map<EventCategory, number>;
  placeWeights: Map<PlaceCategory, number>;
  transitions: Map<string, number>;
};

@Injectable()
export class TasteService {
  constructor(
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
  ) {}

  async profile(userId: string, now = new Date()): Promise<TasteProfile> {
    const graph = await this.loadGraph(userId);
    return toTasteProfile(userId, graph, now);
  }

  async afterMe(userId: string, now = new Date()): Promise<AfterMeResponse> {
    const graph = await this.loadGraph(userId);
    const suggestion = strongestAfterMe(graph);
    if (!suggestion) return { suggestions: [] };
    const upcoming = await this.events.find({ where: { published: true, category: suggestion.toCategory, startsAt: MoreThanOrEqual(now) } });
    upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
    const item: AfterMeSuggestion = {
      fromCategory: suggestion.fromCategory,
      toCategory: suggestion.toCategory,
      afterCount: suggestion.afterCount,
      explanation: formatAfterMeExplanation(suggestion.afterCount, suggestion.fromCategory, suggestion.toCategory),
      events: upcoming.slice(0, 5).map(toEventDto),
    };
    return { suggestions: [item] };
  }

  private async loadGraph(userId: string): Promise<TasteGraph> {
    const mine = await this.checkIns.find({ where: { userId } });
    const eventIds = [...new Set(mine.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const reviewRows = await this.reviews.find({ where: { userId } });
    for (const row of reviewRows) eventIds.push(row.eventId);
    const uniqueEventIds = [...new Set(eventIds)];
    const events = uniqueEventIds.length === 0 ? [] : await this.events.find({ where: { id: In(uniqueEventIds) } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = [
      ...new Set(
        mine.flatMap((row) => {
          if (row.placeId) return [row.placeId];
          const fromEvent = row.eventId ? eventById.get(row.eventId)?.placeId : null;
          return fromEvent ? [fromEvent] : [];
        }),
      ),
    ];
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
    const placeById = new Map(places.map((row) => [row.id, row]));
    return buildTasteGraph(mine, eventById, placeById, reviewRows);
  }
}

export function buildTasteGraph(
  checkIns: CheckInEntity[],
  eventById: Map<string, EventEntity>,
  placeById: Map<string, PlaceEntity>,
  reviews: ReviewEntity[],
): TasteGraph {
  const eventWeights = new Map<EventCategory, number>();
  const placeWeights = new Map<PlaceCategory, number>();
  const transitions = new Map<string, number>();
  const eventVisits = checkIns
    .filter((row) => row.eventId)
    .slice()
    .sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || a.id.localeCompare(b.id));
  let previous: EventCategory | null = null;
  for (const row of eventVisits) {
    const event = eventById.get(row.eventId!);
    if (!event) continue;
    eventWeights.set(event.category, (eventWeights.get(event.category) ?? 0) + 1);
    if (previous) {
      const key = `${previous}>${event.category}`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
    }
    previous = event.category;
    if (event.placeId) {
      const place = placeById.get(event.placeId);
      if (place) placeWeights.set(place.category, (placeWeights.get(place.category) ?? 0) + 1);
    }
  }
  for (const row of checkIns) {
    if (!row.placeId || row.eventId) continue;
    const place = placeById.get(row.placeId);
    if (place) placeWeights.set(place.category, (placeWeights.get(place.category) ?? 0) + 1);
  }
  for (const row of reviews) {
    const event = eventById.get(row.eventId);
    if (!event) continue;
    const extra = row.stars / 5 + (row.wouldGoAgain ? 0.5 : 0);
    eventWeights.set(event.category, (eventWeights.get(event.category) ?? 0) + extra);
  }
  return { eventWeights, placeWeights, transitions };
}

export function strongestAfterMe(graph: TasteGraph): { fromCategory: EventCategory; toCategory: EventCategory; afterCount: number } | null {
  let topFrom: EventCategory | null = null;
  let topFromWeight = 0;
  for (const category of EventCategorySchema.options) {
    const weight = graph.eventWeights.get(category) ?? 0;
    if (weight > topFromWeight) {
      topFrom = category;
      topFromWeight = weight;
    }
  }
  if (!topFrom || topFromWeight <= 0) return null;
  let toCategory = topFrom;
  let toCount = 0;
  for (const [key, count] of graph.transitions) {
    const [from, to] = key.split(">") as [EventCategory, EventCategory];
    if (from !== topFrom || to === from) continue;
    if (count > toCount || (count === toCount && to.localeCompare(toCategory) < 0)) {
      toCategory = to;
      toCount = count;
    }
  }
  return { fromCategory: topFrom, toCategory, afterCount: Math.round(topFromWeight) };
}

export function formatAfterMeExplanation(afterCount: number, fromCategory: EventCategory, toCategory: EventCategory): string {
  if (fromCategory === toCategory) {
    return `После ${afterCount} посещений категории «${EVENT_CATEGORY_RU[fromCategory]}» тебе зайдёт ещё что-то из этой ленты.`;
  }
  return `После ${afterCount} посещений категории «${EVENT_CATEGORY_RU[fromCategory]}» тебе зайдёт «${EVENT_CATEGORY_RU[toCategory]}».`;
}

function toTasteProfile(userId: string, graph: TasteGraph, now: Date): TasteProfile {
  return {
    userId,
    eventCategories: EventCategorySchema.options
      .map((category) => ({ category, weight: graph.eventWeights.get(category) ?? 0 }))
      .filter((row) => row.weight > 0),
    placeCategories: PlaceCategorySchema.options
      .map((category) => ({ category, weight: graph.placeWeights.get(category) ?? 0 }))
      .filter((row) => row.weight > 0),
    transitions: [...graph.transitions.entries()]
      .map(([key, count]) => {
        const [fromCategory, toCategory] = key.split(">") as [EventCategory, EventCategory];
        return { fromCategory, toCategory, count } satisfies TasteTransition;
      })
      .sort((a, b) => b.count - a.count || a.fromCategory.localeCompare(b.fromCategory)),
    updatedAt: now.toISOString(),
  };
}
