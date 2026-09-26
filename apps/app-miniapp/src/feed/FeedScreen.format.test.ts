import { describe, expect, it } from "vitest";
import type { FeedFriendCard } from "../api/client";
import { mockEvents, mockFriends } from "../api/mock";
import { feedCommentsLine, feedCountsLine, feedEventMeta, feedGoingFriendsLine, formatFeedAgo, formatFeedDistance, formatFeedEntry, formatFeedRating, formatFeedTravel, formatFeedWhen, formatPricePerHour } from "./FeedScreen";

const NOW = new Date(2026, 8, 18, 12, 0, 0);
const at = (day: number, hour: number, minute = 0): string => new Date(2026, 8, day, hour, minute).toISOString();

const friendCard: FeedFriendCard = {
  kind: "friend",
  id: "30000000-0000-4000-8000-000000000001",
  author: mockFriends[0],
  placeTitle: "Клуб «Эссе»",
  distanceKm: 1.2,
  event: { ...mockEvents[1], title: "Джаз-квартет в «Эссе»", startsAt: at(18, 20), isPaid: false, priceRub: null, paymentUrl: null },
  live: true,
  hit: false,
  counts: { wantsToGo: 12, going: 4, waitlist: null, freeSeats: null },
  myStatus: null,
  text: "взяла столик у сцены, места ещё есть",
  likesCount: 9,
  likedByMe: false,
  comments: [{ id: "31000000-0000-4000-8000-000000000001", author: mockFriends[1], text: "буду к девяти" }],
  commentsCount: 3,
  publishedAt: at(18, 11, 35),
};

describe("feed formatting", () => {
  it("prints a distance with the ru decimal comma and nothing without one", () => {
    expect(formatFeedDistance(1.2)).toBe("1,2 км");
    expect(formatFeedDistance(12)).toBe("12,0 км");
    expect(formatFeedDistance(null)).toBeNull();
  });

  it("prints the walking estimate with the distance, or falls back to whichever is known", () => {
    expect(formatFeedTravel(15, 2.4)).toBe("15 минут от тебя (2,4 км)");
    expect(formatFeedTravel(1, 0.2)).toBe("1 минута от тебя (0,2 км)");
    expect(formatFeedTravel(null, 2.4)).toBe("2,4 км");
    expect(formatFeedTravel(null, null)).toBeNull();
  });

  it("says сегодня and завтра by name and dates the rest", () => {
    expect(formatFeedWhen(at(18, 20), NOW)).toBe("Сегодня · 20:00");
    expect(formatFeedWhen(at(19, 14), NOW)).toBe("Завтра · 14:00");
    const later = formatFeedWhen(at(20, 10), NOW);
    expect(later).toContain("20");
    expect(later).toContain("· 10:00");
    expect(later.charAt(0)).toBe(later.charAt(0).toUpperCase());
  });

  it("spells the entry condition out for a free event and prices a paid one", () => {
    expect(formatFeedEntry({ isPaid: false, priceRub: null })).toBe("бесплатно");
    expect(formatFeedEntry({ isPaid: true, priceRub: 1800 })).toMatch(/^1.800 ₽$/);
    expect(formatFeedEntry({ isPaid: true, priceRub: null })).toBe("бесплатно");
  });

  it("joins the when and the entry condition into the hero meta line", () => {
    expect(feedEventMeta({ startsAt: at(18, 20), isPaid: false, priceRub: null }, NOW)).toBe("Сегодня · 20:00 · бесплатно");
  });
});

describe("feedCountsLine", () => {
  it("counts people already there while the event runs and people going before it", () => {
    expect(feedCountsLine({ wantsToGo: 12, going: 4, waitlist: null, freeSeats: null }, true)).toBe("12 хотят пойти · 4 уже там");
    expect(feedCountsLine({ wantsToGo: null, going: 16, waitlist: 7, freeSeats: null }, false)).toBe("16 идут · 7 в листе ожидания");
    expect(feedCountsLine({ wantsToGo: null, going: 28, waitlist: null, freeSeats: 12 }, false)).toBe("28 идут · 12 мест свободно");
    expect(feedCountsLine({ wantsToGo: 1, going: 1, waitlist: null, freeSeats: 1 }, false)).toBe("1 хочет пойти · 1 идёт · 1 место свободно");
  });

  it("says nothing rather than zero when the card counts nothing, since the counters are not in the DTO yet", () => {
    expect(feedCountsLine({ wantsToGo: null, going: null, waitlist: null, freeSeats: null }, false)).toBeNull();
    expect(feedCountsLine({ wantsToGo: null, going: 0, waitlist: null, freeSeats: null }, false)).toBe("0 идут");
  });
});

describe("formatFeedAgo", () => {
  it("counts minutes, hours, вчера and days, then gives up and prints a date", () => {
    expect(formatFeedAgo(at(18, 11, 35), NOW)).toBe("25 минут назад");
    expect(formatFeedAgo(at(18, 11, 59), NOW)).toBe("1 минуту назад");
    expect(formatFeedAgo(at(18, 10), NOW)).toBe("2 часа назад");
    expect(formatFeedAgo(at(17, 10), NOW)).toBe("вчера");
    expect(formatFeedAgo(at(15, 10), NOW)).toBe("3 дня назад");
    expect(formatFeedAgo(at(1, 10), NOW)).toContain("сентября");
    expect(formatFeedAgo(at(18, 12), NOW)).toBe("только что");
  });
});

describe("feed lines", () => {
  it("shows the first comment and how many are left", () => {
    expect(feedCommentsLine(friendCard.comments, 3)).toBe("Дима: буду к девяти · ещё 2 комментария");
    expect(feedCommentsLine(friendCard.comments, 1)).toBe("Дима: буду к девяти");
    expect(feedCommentsLine([], 0)).toBeNull();
  });

  it("names the first friend going and counts the rest", () => {
    expect(feedGoingFriendsLine([mockFriends[0], mockFriends[1]])).toBe("Идёт Анна +1");
    expect(feedGoingFriendsLine([mockFriends[0]])).toBe("Идёт Анна");
    expect(feedGoingFriendsLine([])).toBeNull();
  });

  it("prints the hourly price and the rating, and nothing where the backend has nothing", () => {
    expect(formatPricePerHour(800)).toBe("800 ₽/час");
    expect(formatPricePerHour(null)).toBeNull();
    expect(formatFeedRating(4.9)).toBe("4.9");
    expect(formatFeedRating(null)).toBeNull();
  });
});
