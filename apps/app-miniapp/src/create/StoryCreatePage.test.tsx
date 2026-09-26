import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventDetails } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { addStoryObject, clampStoryCrop, editStoryPoll, hasStoryObject, moveStoryObject, nextStoryAudience, panStoryCrop, removeStoryObject, resizeStoryObject, StoryCreateView, STORY_CANVASES, STORY_OBJECT_ORDER, STORY_OBJECT_SCALES, STORY_OBJECTS, storyAudienceLabel, storyCanvasImage, storyComposition, storyDraftPoll, storyObjectClass, storyObjectEnabled, storyObjectStyle, storyPhotoStyle, storyPoll, storySticker, storyTimeLabel, type StoryDraft } from "./StoryCreatePage";

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

const draftOf = (over: Partial<StoryDraft> = {}): StoryDraft => ({ canvas: "gradient-1", photoUrl: null, text: "", eventId: mockEvents[0].id, poll: null, audience: "close-friends", objects: [], rotate: 0, cropX: 0, cropY: 0, cropping: false, ...over });

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
    expect(storyAudienceLabel("close-friends")).toBe("Кто увидит: Близкие друзья");
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

  it("clamps the 1:1 pan and offsets object-position from center", () => {
    expect(clampStoryCrop(80)).toBe(50);
    expect(clampStoryCrop(-80)).toBe(-50);
    expect(panStoryCrop(40, 0, 20, 0)).toEqual({ cropX: 50, cropY: 0 });
    expect(storyPhotoStyle({ rotate: 90, cropX: -20, cropY: 10 })).toMatchObject({ objectPosition: "30% 60%", transform: "rotate(90deg)" });
  });
});

describe("объекты холста", () => {
  it("adds another caption instead of replacing the first one", () => {
    const first = addStoryObject([], "text");
    const second = addStoryObject(first, "text");

    expect(second).toHaveLength(2);
    expect(second[1]?.id).toBe("text-2");
    expect(second[0]).toEqual(first[0]);
  });

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

  it("выводит вперёд тот объект, которого коснулись последним, и только его", () => {
    expect(storyObjectClass("poll", "poll")).toBe("app-story-object app-story-object--poll app-story-object--front");
    expect(storyObjectClass("poll", "seats")).toBe("app-story-object app-story-object--poll");
    expect(storyObjectClass("poll", null)).toBe("app-story-object app-story-object--poll");
  });

  it("шагает по лесенке размеров и упирается в её края, а не уходит за них", () => {
    const one = addStoryObject([], "text");
    const bigger = resizeStoryObject(one, "text", 1);

    expect(one[0].scale).toBeUndefined();
    expect(bigger[0].scale).toBe(STORY_OBJECT_SCALES[STORY_OBJECT_SCALES.indexOf(1) + 1]);
    // С нижней ступени вниз идти некуда: размер остаётся прежним.
    const smallest = STORY_OBJECT_SCALES.reduce((objects) => resizeStoryObject(objects, "text", -1), one);
    expect(smallest[0].scale).toBe(STORY_OBJECT_SCALES[0]);
    expect(resizeStoryObject(smallest, "text", -1)[0].scale).toBe(STORY_OBJECT_SCALES[0]);
  });

  it("меняет размер только названного объекта", () => {
    const objects = addStoryObject(addStoryObject([], "text"), "poll");

    expect(resizeStoryObject(objects, "text", 1).find((object) => object.kind === "poll")?.scale).toBeUndefined();
  });

  it("везёт место и размер одной трансформацией, иначе крупный объект уезжает от пальца", () => {
    expect(storyObjectStyle({ kind: "text", x: 30, y: 12 })).toEqual({ left: "30%", top: "12%", transform: "translate(-50%, -50%) scale(1)" });
    expect(storyObjectStyle({ kind: "text", x: 30, y: 12, scale: 1.25 }).transform).toBe("translate(-50%, -50%) scale(1.25)");
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
    const composition = storyComposition(filledDraft({ text: "  Мангал в Горьком.  ", poll: { ...storyPoll(STARTS_AT), answer: 1 }, audience: "friends" }), sticker, storyPoll(STARTS_AT));

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
    const composition = storyComposition(draftOf({ text: "набрано, но не добавлено", poll: { ...storyPoll(STARTS_AT), answer: 1 } }), storySticker(detailsOf()), storyPoll(STARTS_AT));

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

describe("правка опроса", () => {
  it("меняет вопрос, не трогая вариантов и подсвеченного ответа", () => {
    const poll = { ...storyPoll(STARTS_AT), answer: 1 };
    const edited = editStoryPoll(poll, "question", "Кто с нами?");

    expect(edited).toEqual({ question: "Кто с нами?", options: poll.options, answer: 1 });
  });

  it("меняет один вариант и оставляет второй как был", () => {
    const edited = editStoryPoll(storyPoll(STARTS_AT), 1, "Никогда");

    expect(edited.options).toEqual(["14:00", "Никогда"]);
  });

  it("держит подсвеченный ответ индексом: переименование варианта его не сбивает", () => {
    const poll = { ...storyPoll(STARTS_AT), answer: 0 };

    expect(editStoryPoll(poll, 0, "Пораньше").answer).toBe(0);
  });

  it("берёт опрос из события, пока автор его не правил, и отдаёт правку, как только она есть", () => {
    const stock = storyPoll(STARTS_AT);
    const mine = { question: "Кто с нами?", options: ["Я", "Пас"], answer: null };

    expect(storyDraftPoll(draftOf(), stock)).toEqual(stock);
    expect(storyDraftPoll(draftOf({ poll: mine }), stock)).toEqual(mine);
    expect(storyDraftPoll(draftOf(), null)).toBeNull();
  });

  it("публикует опрос таким, каким его переписал автор, а не заготовкой из события", () => {
    const mine = { question: "Кто с нами?", options: ["Я", "Пас"], answer: 1 };
    const composition = storyComposition(filledDraft({ poll: mine }), storySticker(detailsOf()), storyPoll(STARTS_AT));

    expect(composition.poll).toEqual(mine);
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

  it("turns the crop control on for a photo and keeps it muted on a gradient", () => {
    expect(view({ draft: draftOf({ canvas: "photo", photoUrl: "data:image/jpeg;base64,xx" }) })).toContain("Кадрировать фото");
    expect(view()).not.toContain("Кадрировать фото");
  });

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

  it("держит ручки на выбранном объекте, а не на всех разом: четыре набора закрывали холст", () => {
    const html = view({ draft: filledDraft() });
    const last = STORY_OBJECT_ORDER[STORY_OBJECT_ORDER.length - 1];

    expect((html.match(/app-story-object-grip/g) ?? []).length).toBe(1);
    expect(html).toContain(`Передвинуть: ${STORY_OBJECTS[last].label}`);
    expect(html).toContain(`Убрать: ${STORY_OBJECTS[last].label}`);
    // Ручек нет у остальных, но сами объекты на холсте — их видно и без выбора.
    expect(html).not.toContain("Передвинуть: Текст");
    expect(html).toContain("Во сколько удобнее?");
  });

  it("выбирает последний положенный объект, пока автор не тронул другой", () => {
    const html = view({ draft: draftOf({ objects: addStoryObject(addStoryObject([], "poll"), "text") }) });

    expect(html).toContain("Передвинуть: Текст");
    expect(html).not.toContain("Передвинуть: Опрос");
    expect(html).toContain("app-story-object--text app-story-object--front");
  });

  it("даёт выбранному объекту оба шага размера и гасит тот, за которым лесенки нет", () => {
    const html = view({ draft: filledDraft() });
    const biggest = view({ draft: filledDraft({ objects: resizeStoryObject(filledDraft().objects, "seats", 1).map((object) => (object.kind === "seats" ? { ...object, scale: STORY_OBJECT_SCALES[STORY_OBJECT_SCALES.length - 1] } : object)) }) });

    expect(html).toContain("Крупнее: Места");
    expect(html).toContain("Мельче: Места");
    // Объект своего размера ещё может и вырасти, и уменьшиться, поэтому погашенных кнопок размера нет.
    expect(html).not.toMatch(/app-story-object-size[^>]*disabled/);
    expect(biggest).toMatch(/app-story-object-size[^>]*disabled/);
  });

  it("правит вопрос и оба варианта опроса прямо на объекте, а не формой сбоку", () => {
    const html = view({ draft: filledDraft() });

    expect(html).toContain("Вопрос опроса");
    expect(html).toContain("Вариант 1");
    expect(html).toContain("Вариант 2");
    expect(html).toContain("Мой ответ: вариант 1");
  });

  it("показывает правку опроса, а не заготовку из события, когда автор её переписал", () => {
    const mine = { question: "Кто с нами?", options: ["Я", "Пас"], answer: 1 };
    const html = view({ draft: filledDraft({ poll: mine }), poll: storyPoll(STARTS_AT) });

    expect(html).toContain("Кто с нами?");
    expect(html).not.toContain("Во сколько удобнее?");
    expect(html).not.toContain('value="14:00"');
  });

  it("говорит на счётчике мест, откуда взялось число, и даёт сменить только событие", () => {
    const html = view({ draft: filledDraft() });

    expect(html).toContain("из карточки события");
    expect(html).toContain("Событие счётчика мест");
    expect(html).toContain("Событие истории");
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

  it("оставляет кнопку каталога живой у лежащего объекта, иначе снять его будет нечем", () => {
    // Событие без вместимости счётчик мест не наполняет: объект не рисуется, крестика на холсте нет.
    const html = view({ draft: filledDraft(), sticker: { ...storySticker(detailsOf()), seatsLeft: null }, poll: null });

    expect(html).not.toContain("осталось мест");
    expect(html).not.toMatch(/app-story-catalog-chip[^>]*disabled/);
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
