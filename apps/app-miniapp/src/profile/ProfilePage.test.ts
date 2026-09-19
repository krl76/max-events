import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileView, VisitStatsView, profileStats, toProfilePatch } from "./ProfilePage";
import type { Booking, Profile, User, VisitStats } from "@max-events/api-contracts";
import type { CalendarEntry } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";

const user: User = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  maxUserId: "1001",
  firstName: "Иван",
  lastName: "Петров",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const profile: Profile = { userId: user.id, city: "Москва", interests: ["бег", "джаз"], smartAlerts: { leaveNow: true, weather: true, friendLeft: true, listDigest: true }, privacy: { visitHistory: "friends", routes: "friends" }, recommendationsEnabled: true };

function booking(id: string, eventId: string): Booking {
  return { id, userId: user.id, eventId, status: "active", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
}

function entry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  const event = mockEvents[0];
  return { booking: booking("e0000000-0000-4000-8000-000000000001", event.id), event, place: mockPlaces[0], ...overrides };
}

function renderProfileView(overrides: Partial<Parameters<typeof ProfileView>[0]> = {}): string {
  const props = { user, profile, stats: { events: 5, places: 3 }, friendsCount: 7, posts: [], visitStats: null, saving: false, onSave: () => {}, ...overrides };
  return renderToStaticMarkup(createElement(ProfileView, props));
}

describe("profileStats", () => {
  it("counts events and unique places, skipping entries without a place", () => {
    const otherEvent = mockEvents[1];
    const stats = profileStats([entry(), entry({ place: null }), entry({ booking: booking("e0000000-0000-4000-8000-000000000002", otherEvent.id), event: otherEvent, place: mockPlaces[1] })]);

    expect(stats).toEqual({ events: 3, places: 2 });
  });

  it("is empty without calendar entries", () => {
    expect(profileStats([])).toEqual({ events: 0, places: 0 });
  });
});

describe("toProfilePatch", () => {
  it("trims the city and splits interests by comma", () => {
    expect(toProfilePatch("  Казань ", " бег, джаз , , волонтёрство ")).toEqual({ city: "Казань", interests: ["бег", "джаз", "волонтёрство"] });
  });

  it("omits the city when the draft is blank and drops empty interests", () => {
    expect(toProfilePatch("   ", "бег")).toEqual({ interests: ["бег"] });
    expect(toProfilePatch("Казань", " , ")).toEqual({ city: "Казань", interests: [] });
  });
});

describe("VisitStatsView", () => {
  const stats: VisitStats = {
    userId: user.id,
    placesCount: 2,
    eventsCount: 3,
    byCategory: [
      { category: "afisha", count: 2 },
      { category: "sport", count: 1 },
      { category: "volunteering", count: 0 },
      { category: "tourism", count: 0 },
    ],
  };

  it("renders the heading and non-zero per-category counters", () => {
    const html = renderToStaticMarkup(createElement(VisitStatsView, { stats }));

    expect(html).toContain("Статистика посещений");
    expect(html).toContain("Афиша: 2");
    expect(html).toContain("Спорт: 1");
    expect(html).not.toContain("Волонтёрство:");
  });

  it("shows the empty hint without visit stats yet", () => {
    const html = renderToStaticMarkup(createElement(VisitStatsView, { stats: null }));

    expect(html).toContain("Пока нет посещений");
    expect(html).not.toContain("Афиша:");
  });
});

describe("ProfileView", () => {
  it("renders the MAX identity, stats row and profile facts", () => {
    const html = renderProfileView();

    expect(html).toContain("Иван Петров");
    expect(html).toContain(">И</span>");
    expect(html).toContain(">5</span>");
    expect(html).toContain(">3</span>");
    expect(html).toContain("События");
    expect(html).toContain("Места");
    expect(html).toContain("Москва");
    expect(html).toContain("бег");
    expect(html).toContain("джаз");
  });

  it("hides the interest chips while the list is empty", () => {
    const html = renderProfileView({ profile: { ...profile, interests: [] } });

    expect(html).not.toContain("app-profile-interest");
  });

  it("hides the edit form behind the «Редактировать» button in view mode", () => {
    const html = renderProfileView();

    expect(html).toContain("Редактировать");
    expect(html).not.toContain("app-profile-form");
    expect(html).not.toContain("Сохранить");
  });

  it("renders the avatar image when MAX provides an avatar url", () => {
    const html = renderProfileView({ user: { ...user, avatarUrl: "https://example.com/avatar.png" } });

    expect(html).toContain('src="https://example.com/avatar.png"');
    expect(html).not.toContain(">И</span>");
  });
});
