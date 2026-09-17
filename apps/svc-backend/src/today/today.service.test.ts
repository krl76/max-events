import { describe, expect, it } from "vitest";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { buildTodayDigest, walkingMinutes, type TodayDigestInput } from "./today.service";

const now = new Date("2026-09-12T10:00:00Z");
const parkId = "00000000-0000-4000-8000-0000000000p1";
const annaId = "00000000-0000-4000-8000-0000000000b1";

function event(overrides: Partial<EventEntity> & Pick<EventEntity, "id" | "title">): EventEntity {
  return {
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: parkId,
    startsAt: new Date("2026-09-12T18:00:00Z"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: 20,
    bookedCount: 8,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EventEntity;
}

const park = { id: parkId, title: "Парк Горького", latitude: 55.7297, longitude: 37.6014 } as PlaceEntity;

function input(overrides: Partial<TodayDigestInput> = {}): TodayDigestInput {
  return {
    now,
    city: "Москва",
    interests: [],
    origin: null,
    events: [event({ id: "00000000-0000-4000-8000-0000000000e1", title: "Джаз" })],
    places: [park],
    friends: [{ id: annaId, name: "Анна Соколова" }],
    participations: [{ userId: annaId, eventId: "00000000-0000-4000-8000-0000000000e1", status: "going" }],
    ...overrides,
  };
}

describe("buildTodayDigest", () => {
  it("counts nearby, suitable and friends, and labels free entry, seats and attending friend", () => {
    const paid = event({
      id: "00000000-0000-4000-8000-0000000000e2",
      title: "Платный концерт",
      isPaid: true,
      priceRub: 1500,
      paymentUrl: "https://tickets.example.com/x",
      capacity: null,
      bookedCount: 0,
      startsAt: new Date("2026-09-13T18:00:00Z"),
    });
    const digest = buildTodayDigest(input({ events: [...input().events, paid], interests: ["afisha"] }));
    expect(digest.summary).toEqual({ nearbyCount: 2, suitableCount: 2, withFriendsCount: 1 });
    expect(digest.cards[0].labels).toEqual([
      { kind: "friend_attending", friendName: "Анна" },
      { kind: "free_entry" },
      { kind: "spots_left", count: 12 },
    ]);
    expect(digest.cards[1].labels.some((label) => label.kind === "free_entry")).toBe(false);
  });

  it("excludes other cities, past events and unpublished rows from nearby", () => {
    const digest = buildTodayDigest(
      input({
        events: [
          event({ id: "00000000-0000-4000-8000-0000000000e1", title: "Джаз" }),
          event({ id: "00000000-0000-4000-8000-0000000000e3", title: "Казань", city: "Казань" }),
          event({ id: "00000000-0000-4000-8000-0000000000e4", title: "Вчера", startsAt: new Date("2026-09-11T18:00:00Z") }),
          event({ id: "00000000-0000-4000-8000-0000000000e5", title: "Черновик", published: false }),
        ],
        participations: [],
      }),
    );
    expect(digest.summary.nearbyCount).toBe(1);
    expect(digest.cards.map((card) => card.event.title)).toEqual(["Джаз"]);
  });

  it("promotes after-me categories and labels them", () => {
    const sport = event({ id: "00000000-0000-4000-8000-0000000000e9", title: "Забег", category: "sport", startsAt: new Date("2026-09-14T10:00:00Z") });
    const digest = buildTodayDigest(input({ events: [...input().events, sport], afterMe: { fromCategory: "afisha", toCategory: "sport", afterCount: 3 } }));
    expect(digest.cards[0]?.event.title).toBe("Забег");
    expect(digest.cards[0]?.labels.some((label) => label.kind === "after_me" && label.afterCount === 3)).toBe(true);
  });

  it("adds a walking-distance label when origin and place are present", () => {
    const digest = buildTodayDigest(input({ origin: { latitude: 55.7297, longitude: 37.6014 }, participations: [] }));
    expect(digest.cards[0].labels[0]).toEqual({ kind: "distance", minutes: 0 });
    expect(walkingMinutes({ latitude: 55.75, longitude: 37.62 }, 55.7297, 37.6014)).toBeGreaterThan(0);
  });
});
