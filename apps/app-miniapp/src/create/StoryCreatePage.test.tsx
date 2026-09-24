import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventDetails } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { addStoryObject, hasStoryObject, moveStoryObject, nextStoryAudience, removeStoryObject, StoryCreateView, STORY_CANVASES, STORY_OBJECT_ORDER, STORY_OBJECTS, storyAudienceLabel, storyCanvasImage, storyComposition, storyObjectEnabled, storyPoll, storySticker, storyTimeLabel, type StoryDraft } from "./StoryCreatePage";

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

const draftOf = (over: Partial<StoryDraft> = {}): StoryDraft => ({ canvas: "gradient-1", photoUrl: null, text: "", eventId: mockEvents[0].id, answer: null, audience: "close-friends", objects: [], ...over });

/** Черновик с объектами, разложенными по их местам из каталога — то, что получается после кнопок добавления. */
const filledDraft = (over: Partial<StoryDraft> = {}): StoryDraft => ({ ...draftOf({ objects: STORY_OBJECT_ORDER.reduce<StoryDraft["objects"]>((objects, kind) => addStoryObject(objects, kind), []) }), ...over });

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

describe("объекты холста", () => {
  it("кладёт объект на его место из каталога и не дублирует его повторным добавлением", () => {
    const once = addStoryObject([], "event");
    const twice = addStoryObject(once, "event");

    expect(once).toEqual([{ kind: "event", x: STORY_OBJECTS.event.x, y: STORY_OBJECTS.event.y }]);
    expect(twice).toEqual(once);
    expect(hasStoryObject(once, "event")).toBe(true);
    expect(hasStoryObject(once, "poll")).toBe(false);
  });

  it("снимает с холста только названный объект", () => {
    const objects = addStoryObject(addStoryObject([], "text"), "poll");

    expect(removeStoryObject(objects, "text").map((object) => object.kind)).toEqual(["poll"]);
  });

  it("держит центр перенесённого объекта в кадре: утащенный за край возвращать нечем", () => {
    const objects = addStoryObject([], "text");

    expect(moveStoryObject(objects, "text", 30, 70)).toEqual([{ kind: "text", x: 30, y: 70 }]);
    expect(moveStoryObject(objects, "text", -40, 260)).toEqual([{ kind: "text", x: 6, y: 94 }]);
  });

  it("переносит только названный объект, остальные остаются на своих местах", () => {
    const objects = addStoryObject(addStoryObject([], "text"), "poll");
    const moved = moveStoryObject(objects, "text", 20, 20);

    expect(moved.find((object) => object.kind === "poll")).toEqual(objects[1]);
  });

  it("не даёт добавить объект, которому нечем наполниться", () => {
    const sticker = storySticker(detailsOf());

    expect(storyObjectEnabled("text", null, null)).toBe(true);
    expect(storyObjectEnabled("event", null, null)).toBe(false);
    expect(storyObjectEnabled("poll", sticker, null)).toBe(false);
    expect(storyObjectEnabled("seats", storySticker(detailsOf({ remainingSeats: null })), null)).toBe(false);
    expect(storyObjectEnabled("seats", sticker, null)).toBe(true);
  });
});

describe("storyComposition", () => {
  it("carries the trimmed caption, the sticker, the picked poll answer and the audience", () => {
    const sticker = storySticker(detailsOf());
    const composition = storyComposition(filledDraft({ text: "  Мангал в Горьком.  ", answer: 1, audience: "friends" }), sticker, storyPoll(STARTS_AT));

    expect(composition.text).toBe("Мангал в Горьком.");
    expect(composition.sticker).toEqual(sticker);
    expect(composition.poll?.answer).toBe(1);
    expect(composition.audience).toBe("friends");
  });

  it("keeps the sticker and the poll null when the event card never answered", () => {
    const composition = storyComposition(filledDraft(), null, null);

    expect(composition.sticker).toBeNull();
    expect(composition.poll).toBeNull();
  });

  it("публикует только то, что автор положил на холст: пустой холст — история из одного фона", () => {
    const composition = storyComposition(draftOf({ text: "набрано, но не добавлено", answer: 1 }), storySticker(detailsOf()), storyPoll(STARTS_AT));

    expect(composition.text).toBe("");
    expect(composition.sticker).toBeNull();
    expect(composition.poll).toBeNull();
    expect(composition.objects).toEqual([]);
  });

  it("несёт расстановку холста, чтобы будущий эндпоинт собрал историю такой же", () => {
    const draft = filledDraft();
    const composition = storyComposition({ ...draft, objects: moveStoryObject(draft.objects, "text", 30, 12) }, storySticker(detailsOf()), storyPoll(STARTS_AT));

    expect(composition.objects?.map((object) => object.kind)).toEqual([...STORY_OBJECT_ORDER]);
    expect(composition.objects?.[0]).toEqual({ kind: "text", x: 30, y: 12 });
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

  it("открывается пустым холстом: ни чужой подписи, ни стикера, ни опроса, только подсказка", () => {
    const html = view();

    expect(html).toContain("Пустой холст");
    expect(html).not.toContain("Мангальная зона");
    expect(html).not.toContain("осталось мест");
    expect(html).not.toContain("Во сколько удобнее?");
  });

  it("рисует объект только после того, как автор его добавил", () => {
    const html = view({ draft: filledDraft() });

    expect(html).not.toContain("Пустой холст");
    expect(html).toContain("Мангальная зона");
    expect(html).toContain("осталось мест");
    expect(html).toContain("Во сколько удобнее?");
  });

  it("ставит объект на ту позицию, которую держит черновик", () => {
    const draft = filledDraft();
    const html = view({ draft: { ...draft, objects: moveStoryObject(draft.objects, "text", 30, 12) } });

    expect(html).toContain("left:30%");
    expect(html).toContain("top:12%");
  });

  it("даёт каждому объекту ручку переноса и снятия с холста", () => {
    const html = view({ draft: filledDraft() });

    expect(html).toContain("Передвинуть: Текст");
    expect(html).toContain("Убрать: Опрос");
    expect((html.match(/app-story-object-grip/g) ?? []).length).toBe(STORY_OBJECT_ORDER.length);
  });

  it("держит каталог объектов целиком: макет их показывал, экран даёт их добавить", () => {
    const html = view();

    for (const kind of STORY_OBJECT_ORDER) expect(html).toContain(STORY_OBJECTS[kind].label);
    expect((html.match(/app-story-catalog-chip/g) ?? []).length).toBeGreaterThanOrEqual(STORY_OBJECT_ORDER.length);
  });

  it("гасит кнопку объекта, которому нечем наполниться, и отмечает уже добавленные", () => {
    const empty = view({ sticker: null, poll: null });
    const filled = view({ draft: filledDraft() });

    // Текст доступен всегда, остальные три без карточки события пусты.
    expect((empty.match(/disabled=""/g) ?? []).length).toBe(3);
    expect((filled.match(/aria-pressed="true"/g) ?? []).length).toBeGreaterThanOrEqual(STORY_OBJECT_ORDER.length);
  });

  it("keeps the audience switch and the publish button of the design", () => {
    const html = view();

    expect(html).toContain("Близкие друзья");
    expect(html).toContain("В историю");
  });

  it("offers one background tile per brand gradient plus the photo picker", () => {
    expect(view().match(/app-story-tile/g)?.length).toBeGreaterThanOrEqual(STORY_CANVASES.length + 1);
  });

  it("skips an object the catalog cannot fill instead of drawing an empty frame", () => {
    const html = view({ draft: filledDraft(), sticker: null, poll: null });

    expect(html).not.toContain("осталось мест");
    expect(html).not.toContain("Во сколько удобнее?");
    expect(html).toContain("Подпись истории");
    expect(html).toContain("В историю");
  });

  it("says out loud that the publication failed instead of returning to an idle button", () => {
    expect(view({ state: "error" })).toContain("Не удалось опубликовать историю");
  });
});
