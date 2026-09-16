import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileView, profileStats, toProfilePatch } from "./ProfilePage";
import type { Booking, Profile, User } from "@max-events/api-contracts";
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

const profile: Profile = { userId: user.id, city: "Москва", interests: ["бег", "джаз"] };

function booking(id: string, eventId: string): Booking {
  return { id, userId: user.id, eventId, status: "active", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
}

function entry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  const event = mockEvents[0];
  return { booking: booking("e0000000-0000-4000-8000-000000000001", event.id), event, place: mockPlaces[0], ...overrides };
}

function renderProfileView(overrides: Partial<Parameters<typeof ProfileView>[0]> = {}): string {
  const props = { user, profile, stats: { events: 5, places: 3 }, saving: false, onSave: () => {}, ...overrides };
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

  it("fills the edit form with the current profile", () => {
    const html = renderProfileView();

    expect(html).toContain('value="Москва"');
    expect(html).toContain('value="бег, джаз"');
    expect(html).toContain("Сохранить");
  });

  it("shows the saving state on the submit button", () => {
    const html = renderProfileView({ saving: true });

    expect(html).toContain("Сохранение…");
    expect(html).toContain("disabled");
    expect(html).not.toContain(">Сохранить</button>");
  });

  it("renders the avatar image when MAX provides an avatar url", () => {
    const html = renderProfileView({ user: { ...user, avatarUrl: "https://example.com/avatar.png" } });

    expect(html).toContain('src="https://example.com/avatar.png"');
    expect(html).not.toContain(">И</span>");
  });
});
