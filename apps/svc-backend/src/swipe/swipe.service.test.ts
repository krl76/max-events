import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { FindOperator, type Repository } from "typeorm";
import type { TasteProfile } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FeedPostEntity } from "../feed/feed-post.entity";
import type { FriendsService } from "../friends/friends.service";
import type { ListsService } from "../lists/lists.service";
import { PlaceEntity } from "../places/place.entity";
import type { TasteService } from "../taste/taste.service";
import { SwipeDecisionEntity } from "./swipe-decision.entity";
import { matchPercentFor, parseSwipeCategory, parseSwipeDecision, SwipeService } from "./swipe.service";

const userId = "00000000-0000-4000-8000-00000000000a";
const friendId = "00000000-0000-4000-8000-00000000000b";
const parkId = "00000000-0000-4000-8000-0000000000p1";
const foodId = "00000000-0000-4000-8000-0000000000p2";
const sportId = "00000000-0000-4000-8000-0000000000p3";
const now = new Date("2026-09-12T10:00:00Z");

function placeRow(id: string, category: PlaceEntity["category"], published = true): PlaceEntity {
  return {
    id,
    title: id,
    address: "addr",
    city: "Москва",
    category,
    latitude: 55.75,
    longitude: 37.62,
    organizerUserId: null,
    published,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  } as PlaceEntity;
}

function matchesCell(cell: unknown, condition: unknown): boolean {
  if (condition instanceof FindOperator) {
    if (condition.type === "in") return (condition.value as unknown as unknown[]).includes(cell);
    throw new Error(`unsupported find operator: ${condition.type}`);
  }
  return cell === condition;
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => matchesCell((row as Record<string, unknown>)[key], value)));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        (entity as { id?: string }).id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

function emptyProfile(): TasteProfile {
  return { userId, eventCategories: [], placeCategories: [], transitions: [], updatedAt: now.toISOString() };
}

function createService(options: { places?: PlaceEntity[]; checkIns?: CheckInEntity[]; profile?: TasteProfile; friends?: { id: string; name: string; avatarUrl: string | null }[] } = {}) {
  const decisions = createStoreRepo<SwipeDecisionEntity>();
  const places = createStoreRepo<PlaceEntity>(options.places ?? [placeRow(parkId, "park"), placeRow(foodId, "food"), placeRow(sportId, "sport"), placeRow("00000000-0000-4000-8000-0000000000p9", "park", false)]);
  const checkIns = createStoreRepo<CheckInEntity>(options.checkIns ?? []);
  const favorites: string[] = [];
  const taste = { profile: async () => options.profile ?? emptyProfile() } as unknown as TasteService;
  const lists = {
    addPlaceToPreset: async (_userId: string, preset: string, placeId: string) => {
      favorites.push(`${preset}:${placeId}`);
      return {};
    },
  } as unknown as ListsService;
  const friends = { list: async () => options.friends ?? [] } as unknown as FriendsService;
  const events = createStoreRepo<EventEntity>([]);
  const posts = createStoreRepo<FeedPostEntity>([]);
  const service = new SwipeService(decisions as unknown as Repository<SwipeDecisionEntity>, places as unknown as Repository<PlaceEntity>, checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, posts as unknown as Repository<FeedPostEntity>, taste, lists, friends);
  return { service, decisions, favorites };
}

describe("matchPercentFor", () => {
  it("returns null without weights and scales the strongest category to 100", () => {
    expect(matchPercentFor("park", emptyProfile())).toBeNull();
    const profile: TasteProfile = {
      ...emptyProfile(),
      placeCategories: [
        { category: "park", weight: 4 },
        { category: "food", weight: 2 },
      ],
    };
    expect(matchPercentFor("park", profile)).toBe(100);
    expect(matchPercentFor("food", profile)).toBe(50);
    expect(matchPercentFor("sport", profile)).toBe(0);
  });
});

describe("parseSwipeCategory and parseSwipeDecision", () => {
  it("defaults category to all and rejects unknown chips or decisions", () => {
    expect(parseSwipeCategory(undefined)).toBe("all");
    expect(parseSwipeCategory("food")).toBe("food");
    expect(() => parseSwipeCategory("museum")).toThrow(BadRequestException);
    expect(parseSwipeDecision({ decision: "like" })).toBe("like");
    expect(() => parseSwipeDecision({})).toThrow(BadRequestException);
  });
});

describe("SwipeService", () => {
  it("hides unpublished and already-judged venues and filters by chip", async () => {
    const { service } = createService();
    const all = await service.list(userId, "all", null);
    expect(all.map((row) => row.place.id).sort()).toEqual([foodId, parkId, sportId].sort());
    expect(all.every((row) => row.matchPercent === null && row.amenities.length === 0)).toBe(true);
    expect((await service.list(userId, "food", null)).map((row) => row.place.id)).toEqual([foodId]);
  });

  it("ranks by match percent and attaches friends who checked in", async () => {
    const profile: TasteProfile = {
      ...emptyProfile(),
      placeCategories: [
        { category: "food", weight: 3 },
        { category: "park", weight: 1 },
      ],
    };
    const { service } = createService({
      profile,
      friends: [{ id: friendId, name: "Анна", avatarUrl: null }],
      checkIns: [{ id: "c1", userId: friendId, placeId: foodId, eventId: null } as CheckInEntity],
    });
    const deck = await service.list(userId, "all", { latitude: 55.75, longitude: 37.62 });
    expect(deck.map((row) => row.place.id)).toEqual([foodId, parkId, sportId]);
    expect(deck[0]?.matchPercent).toBe(100);
    expect(deck[0]?.friendsHere).toEqual([{ id: friendId, name: "Анна", avatarUrl: null }]);
    expect(deck[0]?.distanceKm).toBe(0);
  });

  it("records a like into favorites and drops the venue from the next deck", async () => {
    const { service, favorites } = createService();
    await service.decide(userId, parkId, "like");
    expect(favorites).toEqual(["favorites:00000000-0000-4000-8000-0000000000p1"]);
    expect((await service.list(userId, "all", null)).map((row) => row.place.id)).not.toContain(parkId);
    await service.decide(userId, parkId, "skip");
    expect(favorites).toHaveLength(1);
    await expect(service.decide(userId, "00000000-0000-4000-8000-0000000000p9", "like")).rejects.toBeInstanceOf(NotFoundException);
  });
});
