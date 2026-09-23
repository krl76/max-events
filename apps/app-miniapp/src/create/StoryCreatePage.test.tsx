import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventDetails } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { nextStoryAudience, StoryCreateView, STORY_CANVASES, storyAudienceLabel, storyCanvasImage, storyComposition, storyPoll, storySticker, storyTimeLabel, type StoryDraft } from "./StoryCreatePage";

// Локальное время без смещения: «14:00» обязано читаться одинаково в любой зоне прогона.
const STARTS_AT = "2026-09-19T14:00:00";
const BRAND_HEX = ["#471aff", "#6e1aff", "#9500ff", "#00bfff", "#0d001a", "#ffffff"];

const detailsOf = (over: Partial<EventDetails> = {}): EventDetails => ({
  event: { ...mockEvents[0], title: "Мангальная зона", startsAt: STARTS_AT },
  place: mockPlaces[0],
  organizer: null,
  organization: null,
  remainingSeats: 4,
  activeBookingId: null,
  checkInId: null,
  ...over,
});

const draftOf = (over: Partial<StoryDraft> = {}): StoryDraft => ({ canvas: "gradient-1", photoUrl: null, text: "", eventId: mockEvents[0].id, answer: null, audience: "close-friends", ...over });

describe("story sticker and poll of the design", () => {
  it("pads both halves, so 09:05 never reads as 9:5", () => {
    expect(storyTimeLabel("2026-09-19T09:05:00")).toBe("09:05");
    expect(storyTimeLabel(STARTS_AT)).toBe("14:00");
  });

  it("reads the sticker of the design off the event card: title, «место · время», free seats", () => {
    const sticker = storySticker(detailsOf());

    expect(sticker.title).toBe("Мангальная зона");
    expect(sticker.subtitle).toBe(`${mockPlaces[0].title} · 14:00`);
    expect(sticker.seatsLeft).toBe(4);
  });

  it("drops the venue from the line when the event has none, instead of printing an empty prefix", () => {
    expect(storySticker(detailsOf({ place: null })).subtitle).toBe("14:00");
  });

  it("keeps the seat counter null for an event without capacity, so the sticker can stay silent", () => {
    expect(storySticker(detailsOf({ remainingSeats: null })).seatsLeft).toBeNull();
  });

  it("offers the start of the event and the same hour three hours later, as 14:00 / 17:00 of the design", () => {
    const poll = storyPoll(STARTS_AT);

    expect(poll.question).toBe("Во сколько удобнее?");
    expect(poll.options).toEqual(["14:00", "17:00"]);
    expect(poll.answer).toBeNull();
  });
});

describe("story audience", () => {
  it("walks every audience and comes back to the one it started on", () => {
    const first = nextStoryAudience("close-friends");
    const second = nextStoryAudience(first);

    expect(first).not.toBe("close-friends");
    expect(second).not.toBe(first);
    expect(nextStoryAudience(second)).toBe("close-friends");
  });

  it("labels the opening audience as the design does", () => {
    expect(storyAudienceLabel("close-friends")).toBe("Близкие друзья");
  });
});

describe("storyCanvasImage", () => {
  it("encodes a brandbook gradient and no colour outside the six", () => {
    for (const canvas of STORY_CANVASES) {
      const decoded = decodeURIComponent(storyCanvasImage(canvas).replace("data:image/svg+xml;utf8,", ""));
      const hexes = [...decoded.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase());

      expect(hexes.length).toBeGreaterThan(0);
      expect(hexes.filter((hex) => !BRAND_HEX.includes(hex))).toEqual([]);
    }
  });

  it("still answers an image when the canvas is the picked photo, since POST /stories takes no empty url", () => {
    expect(storyCanvasImage("photo").startsWith("data:image/svg+xml;utf8,")).toBe(true);
  });
});

describe("storyComposition", () => {
  it("carries the trimmed caption, the sticker, the picked poll answer and the audience", () => {
    const sticker = storySticker(detailsOf());
    const composition = storyComposition(draftOf({ text: "  Мангал в Горьком.  ", answer: 1, audience: "friends" }), sticker, storyPoll(STARTS_AT));

    expect(composition.text).toBe("Мангал в Горьком.");
    expect(composition.sticker).toEqual(sticker);
    expect(composition.poll?.answer).toBe(1);
    expect(composition.audience).toBe("friends");
  });

  it("keeps the sticker and the poll null when the event card never answered", () => {
    const composition = storyComposition(draftOf(), null, null);

    expect(composition.sticker).toBeNull();
    expect(composition.poll).toBeNull();
  });
});

describe("StoryCreateView", () => {
  const noop = () => {};
  const view = (over: Partial<Parameters<typeof StoryCreateView>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(StoryCreateView, {
        draft: draftOf(),
        sticker: storySticker(detailsOf()),
        poll: storyPoll(STARTS_AT),
        events: mockEvents,
        state: "idle" as const,
        onDraft: noop,
        onPickPhoto: noop,
        onPublish: noop,
        onClose: noop,
        ...over,
      }),
    );

  it("draws the sticker, the seat counter, the poll and both foot buttons of the design", () => {
    const html = view();

    expect(html).toContain("Мангальная зона");
    expect(html).toContain("осталось мест");
    expect(html).toContain("Во сколько удобнее?");
    expect(html).toContain("Близкие друзья");
    expect(html).toContain("В историю");
  });

  it("offers one background tile per brand gradient plus the photo picker", () => {
    expect(view().match(/app-story-tile/g)?.length).toBeGreaterThanOrEqual(STORY_CANVASES.length + 1);
  });

  it("hides the sticker, the seats and the poll when the catalog answered nothing", () => {
    const html = view({ sticker: null, poll: null });

    expect(html).not.toContain("осталось мест");
    expect(html).not.toContain("Во сколько удобнее?");
    expect(html).toContain("В историю");
  });

  it("says out loud that the publication failed instead of returning to an idle button", () => {
    expect(view({ state: "error" })).toContain("Не удалось опубликовать историю");
  });
});
