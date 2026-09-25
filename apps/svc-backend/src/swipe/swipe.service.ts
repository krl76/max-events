// START_MODULE_CONTRACT
// PURPOSE: Swipe deck of venues — published places the viewer has not judged, scored against taste.
// SCOPE: list candidates by swipe category; record like (favorites list) or skip; matchPercent from place-category weights; distance when origin is present.
// DEPENDS: typeorm, @max-events/api-contracts, places/taste/lists/friends/check-ins
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SWIPE_CATEGORIES - filter chips of экран 09
// - SWIPE_CATEGORY_PLACES - which PlaceCategory each chip admits
// - SWIPE_DECK_CAP - max cards in one deck
// - matchPercentFor - 0..100 from the viewer's place-category weights; null with no taste
// - SwipeService - list / decide
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { PlaceCategorySchema, type Friend, type Place, type PlaceCategory, type TasteProfile } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { FriendsService } from "../friends/friends.service";
import { ListsService } from "../lists/lists.service";
import { haversineKm } from "../nearby/nearby.service";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { TasteService } from "../taste/taste.service";
import { SwipeDecisionEntity, type SwipeDecision } from "./swipe-decision.entity";

export const SWIPE_CATEGORIES = ["all", "food", "outdoors", "sport"] as const;
export type SwipeCategory = (typeof SWIPE_CATEGORIES)[number];

export const SWIPE_CATEGORY_PLACES: Record<SwipeCategory, readonly PlaceCategory[]> = {
  all: PlaceCategorySchema.options,
  food: ["food"],
  outdoors: ["park"],
  sport: ["sport"],
};

export const SWIPE_DECK_CAP = 50;

export type SwipeCandidate = {
  place: Place;
  areaLine: string | null;
  offerLabel: string | null;
  distanceKm: number | null;
  rating: number | null;
  reviewsCount: number | null;
  pricePerHourRub: number | null;
  amenities: string[];
  friendsHere: Friend[];
  matchPercent: number | null;
};

export function matchPercentFor(category: PlaceCategory, profile: TasteProfile): number | null {
  const weights = profile.placeCategories;
  if (weights.length === 0) return null;
  const max = Math.max(...weights.map((row) => row.weight));
  if (max <= 0) return null;
  const weight = weights.find((row) => row.category === category)?.weight ?? 0;
  return Math.round((weight / max) * 100);
}

@Injectable()
export class SwipeService {
  constructor(
    @InjectRepository(SwipeDecisionEntity) private readonly decisions: Repository<SwipeDecisionEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @Inject(TasteService) private readonly taste: TasteService,
    @Inject(ListsService) private readonly lists: ListsService,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async list(userId: string, category: SwipeCategory, origin: { latitude: number; longitude: number } | null): Promise<SwipeCandidate[]> {
    const admitted = new Set(SWIPE_CATEGORY_PLACES[category]);
    const decided = new Set((await this.decisions.find({ where: { userId } })).map((row) => row.placeId));
    const rows = (await this.places.find({ where: { published: true }, order: { title: "ASC", id: "ASC" } })).filter((row) => admitted.has(row.category) && !decided.has(row.id));
    const profile = await this.taste.profile(userId);
    const friends = await this.friends.list(userId);
    const friendIds = new Set(friends.map((row) => row.id));
    const visitors = await this.visitorsByPlace(rows.map((row) => row.id), friendIds);
    const scored = rows.map((row) => {
      const place = toPlaceDto(row);
      const matchPercent = matchPercentFor(row.category, profile);
      const distanceKm = origin === null ? null : Math.round(haversineKm(origin.latitude, origin.longitude, row.latitude, row.longitude) * 10) / 10;
      const here = visitors.get(row.id) ?? new Set<string>();
      return {
        place,
        areaLine: null,
        offerLabel: null,
        distanceKm,
        rating: null,
        reviewsCount: null,
        pricePerHourRub: null,
        amenities: [] as string[],
        friendsHere: friends.filter((friend) => here.has(friend.id)),
        matchPercent,
      } satisfies SwipeCandidate;
    });
    scored.sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1) || (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) || a.place.id.localeCompare(b.place.id));
    return scored.slice(0, SWIPE_DECK_CAP);
  }

  async decide(userId: string, placeId: string, decision: SwipeDecision): Promise<void> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    const existing = await this.decisions.findOneBy({ userId, placeId });
    if (existing) {
      existing.decision = decision;
      await this.decisions.save(existing);
    } else {
      await this.decisions.save(this.decisions.create({ userId, placeId, decision }));
    }
    if (decision === "like") await this.lists.addPlaceToPreset(userId, "favorites", placeId);
  }

  private async visitorsByPlace(placeIds: string[], friendIds: Set<string>): Promise<Map<string, Set<string>>> {
    const visitors = new Map<string, Set<string>>();
    if (placeIds.length === 0 || friendIds.size === 0) return visitors;
    const rows = await this.checkIns.find({ where: { placeId: In(placeIds) } });
    for (const row of rows) {
      if (!row.placeId || !friendIds.has(row.userId)) continue;
      const set = visitors.get(row.placeId) ?? new Set<string>();
      set.add(row.userId);
      visitors.set(row.placeId, set);
    }
    return visitors;
  }
}

export function parseSwipeCategory(raw: string | undefined): SwipeCategory {
  const value = raw === undefined || raw === "" ? "all" : raw;
  if (!(SWIPE_CATEGORIES as readonly string[]).includes(value)) throw new BadRequestException("Invalid swipe query");
  return value as SwipeCategory;
}

export function parseSwipeDecision(body: unknown): SwipeDecision {
  const decision = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as { decision?: unknown }).decision : undefined;
  if (decision !== "like" && decision !== "skip") throw new BadRequestException("Invalid swipe decision");
  return decision;
}
