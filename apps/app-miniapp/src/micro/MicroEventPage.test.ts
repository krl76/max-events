import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MicroEventCard } from "../api/client";
import { microSeatsHint, microWhenLabel, microWhereLabel, MicroEventView, type MicroEventState } from "./MicroEventPage";
import { microTime } from "./MicroEventsPage";
import { microEventCard, microEvents, mockDemoUser, mockFriends, mockPlaces } from "../api/mock";

const noop = () => {};
const NOW = new Date("2026-09-19T12:00:00+03:00");
const HOUR = 60 * 60 * 1000;

const seeded = microEventCard(microEvents()[0].id)!;

function card(over: Partial<MicroEventCard> = {}): MicroEventCard {
  return { ...seeded, ...over };
}

function withEvent(over: Partial<MicroEventCard["event"]>): MicroEventCard {
  return card({ event: { ...seeded.event, ...over } });
}

describe("microWhenLabel", () => {
  it("names today and tomorrow instead of printing their dates", () => {
    expect(microWhenLabel(new Date(NOW.getTime() + 7 * HOUR).toISOString(), NOW)).toMatch(/^Сегодня в \d{2}:\d{2}$/);
    expect(microWhenLabel(new Date(NOW.getTime() + 26 * HOUR).toISOString(), NOW)).toMatch(/^Завтра в \d{2}:\d{2}$/);
  });

  it("falls back to the date for anything further out", () => {
    const later = new Date(NOW.getTime() + 8 * 24 * HOUR).toISOString();

    expect(microWhenLabel(later, NOW)).toContain(microTime(later));
    expect(microWhenLabel(later, NOW)).not.toContain("Сегодня");
  });
});

describe("microWhereLabel", () => {
  it("prefers the venue title and falls back to the address the author typed", () => {
    expect(microWhereLabel(card({ place: mockPlaces[0] }))).toBe(mockPlaces[0].title);
    expect(microWhereLabel(card({ place: null, event: { ...seeded.event, placeId: null, locationText: "Чистые пруды, адрес в чате" } }))).toBe("Чистые пруды, адрес в чате");
  });
});

describe("microSeatsHint", () => {
  it("writes the number out, the way the design does", () => {
    expect(microSeatsHint(4)).toBe("Свободных мест четыре. Когда их не останется, кнопка сменится на «Мест нет».");
    expect(microSeatsHint(2)).toContain("два");
    expect(microSeatsHint(10)).toContain("десять");
  });

  it("agrees the sentence with a single free seat and says nothing when there are none", () => {
    expect(microSeatsHint(1)).toBe("Свободное место одно. Когда его займут, кнопка сменится на «Мест нет».");
    expect(microSeatsHint(0)).toBeNull();
    expect(microSeatsHint(-1)).toBeNull();
  });

  it("switches to the digit past ten, where the word stops helping", () => {
    expect(microSeatsHint(14)).toContain("14");
  });
});

describe("MicroEventView", () => {
  const view = (state: MicroEventState, viewerId: string | null = null) => renderToStaticMarkup(createElement(MicroEventView, { state, viewerId, now: NOW, onBack: noop, onOpenPlace: noop, onOpenPin: noop, onJoin: noop, onLeave: noop, onRetry: noop }));

  it("renders the title, the when/where rows and the named participants with the author marked", () => {
    const html = view({ status: "ready", card: seeded });

    expect(html).toContain("Микро-событие");
    expect(html).toContain(seeded.event.title);
    expect(html).toContain(microWhereLabel(seeded));
    expect(html).toContain(seeded.participants[0].friend.name);
    expect(html).toContain("позвал");
    expect(html).toContain(`${seeded.event.participantsCount} из ${seeded.event.participantsLimit}`);
  });

  it("puts the author first, because the card marks them «позвал»", () => {
    expect(seeded.participants[0].author).toBe(true);
    expect(seeded.participants[0].friend.id).toBe(seeded.event.authorId);
  });

  it("offers «Иду» with the free-seat hint to someone who is not in yet", () => {
    const html = view({ status: "ready", card: seeded });

    expect(html).toContain("Иду");
    expect(html).toContain(microSeatsHint(seeded.event.participantsLimit - seeded.event.participantsCount)!);
    expect(html).not.toContain("Выйти");
  });

  it("shows «Ты в деле» with the only action being «Выйти» once the viewer joined", () => {
    const mine = withEvent({ participantIds: [...seeded.event.participantIds, mockDemoUser.id], participantsCount: seeded.event.participantsCount + 1 });
    const html = view({ status: "ready", card: mine }, mockDemoUser.id);

    expect(html).toContain("Ты в деле");
    expect(html).toContain("Выйти");
  });

  it("closes the card with «Мест нет» when the limit is reached", () => {
    const full = withEvent({ participantsCount: seeded.event.participantsLimit, participantIds: mockFriends.slice(0, seeded.event.participantsLimit).map((friend) => friend.id) });
    const html = view({ status: "ready", card: full });

    expect(html).toContain("Мест нет");
    expect(html).not.toContain("Свободных мест");
  });

  it("says a cancelled gathering was called off by its author", () => {
    const html = view({ status: "ready", card: withEvent({ status: "cancelled" }) });

    expect(html).toContain("Сбор отменён автором");
    expect(html).not.toContain("Иду<");
  });

  it("renders loading and both error states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error", notFound: false })).toContain("Не удалось загрузить сбор.");
    expect(view({ status: "error", notFound: true })).toContain("Такого сбора больше нет.");
  });
});
