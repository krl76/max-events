import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TasteProfile } from "@max-events/api-contracts";
import type { FeedPost, ReviewFactTag } from "../api/client";
import { mockEvents, mockFriends } from "../api/mock";
import { AFTER_EVENT_VERDICTS, AfterEventView, afterEventQuestion, afterEventWhen, audienceLine, tasteLead, tasteRows, verdictReview } from "./AfterEventPage";

const NOW = new Date(2026, 8, 18, 12, 0, 0);
const USER_ID = "a0000000-0000-4000-8000-000000000001";
const event = { ...mockEvents[2], title: "Субботник в Парке Горького", startsAt: new Date(2026, 8, 17, 10, 0).toISOString() };

const factTags: ReviewFactTag[] = [
  { code: "calm", label: "Спокойно" },
  { code: "kids_ok", label: "С детьми ок" },
  { code: "crowded", label: "Многолюдно" },
];

const taste: TasteProfile = {
  userId: USER_ID,
  eventCategories: [
    { category: "afisha", weight: 4 },
    { category: "volunteering", weight: 0 },
    { category: "tourism", weight: 4 },
    { category: "sport", weight: 2 },
  ],
  placeCategories: [],
  transitions: [],
  updatedAt: "2026-09-18T09:00:00Z",
};

function post(id: string, photoUrl: string | null): FeedPost {
  return { id, author: mockFriends[0], eventId: event.id, text: "было классно", photoUrl, likesCount: 0, likedByMe: false, comments: [] };
}

function renderAfterEvent(overrides: Partial<Parameters<typeof AfterEventView>[0]> = {}): string {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(AfterEventView, {
      event,
      placeTitle: "Парк Горького",
      now: NOW,
      factTags,
      photos: [post("1", "https://cdn.example.com/a.jpg"), post("2", "https://cdn.example.com/b.jpg")],
      participants: 8,
      taste,
      verdictCode: null,
      pickedTags: [],
      saving: false,
      failed: false,
      onVerdict: noop,
      onTag: noop,
      onAddPhoto: noop,
      onClose: noop,
      onSave: noop,
      ...overrides,
    }),
  );
}

describe("AFTER_EVENT_VERDICTS", () => {
  it("offers the four answers of the design in order", () => {
    expect(AFTER_EVENT_VERDICTS.map((verdict) => verdict.label)).toEqual(["Не моё", "Норм", "Отлично", "Ещё раз"]);
  });

  it("promises a return only for «Ещё раз»", () => {
    expect(AFTER_EVENT_VERDICTS.filter((verdict) => verdict.wouldGoAgain).map((verdict) => verdict.code)).toEqual(["again"]);
  });

  it("turns a verdict and the picked tags into the review payload", () => {
    expect(verdictReview(USER_ID, event.id, AFTER_EVENT_VERDICTS[3], ["calm"])).toEqual({ userId: USER_ID, eventId: event.id, stars: 5, wouldGoAgain: true, factTags: ["calm"] });
    expect(verdictReview(USER_ID, event.id, AFTER_EVENT_VERDICTS[0], []).stars).toBe(2);
  });
});

describe("afterEventWhen", () => {
  it("says вчера and сегодня by name, counts the days inside the week and dates the rest", () => {
    expect(afterEventWhen(new Date(2026, 8, 17, 10, 0).toISOString(), "Парк Горького", NOW)).toBe("Вчера · Парк Горького");
    expect(afterEventWhen(new Date(2026, 8, 18, 9, 0).toISOString(), null, NOW)).toBe("Сегодня");
    expect(afterEventWhen(new Date(2026, 8, 15, 10, 0).toISOString(), null, NOW)).toBe("3 дня назад");
    expect(afterEventWhen(new Date(2026, 7, 20, 10, 0).toISOString(), null, NOW)).toBe("20 августа");
  });
});

describe("afterEventQuestion and audienceLine", () => {
  it("asks about the event by name", () => {
    expect(afterEventQuestion(event)).toBe("Как было на «Субботник в Парке Горького»?");
  });

  it("declines the audience counter", () => {
    expect(audienceLine(8)).toBe("видят только 8 участников");
    expect(audienceLine(1)).toBe("видят только 1 участник");
    expect(audienceLine(2)).toBe("видят только 2 участника");
  });
});

describe("tasteRows", () => {
  it("turns weights into shares of the graph, strongest first, dropping what weighs nothing", () => {
    expect(tasteRows(taste)).toEqual([
      { label: "Афиша", share: 40 },
      { label: "Туризм", share: 40 },
      { label: "Спорт", share: 20 },
    ]);
  });

  it("has nothing to draw before the graph has anything in it", () => {
    expect(tasteRows(null)).toEqual([]);
    expect(tasteRows({ ...taste, eventCategories: [] })).toEqual([]);
  });

  it("names the strongest category, and admits it is early when there is none", () => {
    expect(tasteLead(tasteRows(taste))).toContain("«Афиша»");
    expect(tasteLead([])).toContain("Пока рано");
  });
});

describe("AfterEventView", () => {
  it("renders the hero question, the four verdicts and the fact tags", () => {
    const html = renderAfterEvent();

    expect(html).toContain("Вчера · Парк Горького");
    expect(html).toContain("Как было на «Субботник в Парке Горького»?");
    expect(html.match(/class="app-after-verdict"/g)).toHaveLength(4);
    expect(html).toContain("Что было правдой?");
    expect(html).toContain("Спокойно");
  });

  it("marks the chosen verdict and the picked tags", () => {
    const html = renderAfterEvent({ verdictCode: "great", pickedTags: ["calm", "kids_ok"] });

    expect(html.match(/app-after-verdict--on/g)).toHaveLength(1);
    expect(html.match(/app-after-fact--on/g)).toHaveLength(2);
  });

  it("drops the fact block entirely while the dictionary answers nothing", () => {
    const html = renderAfterEvent({ factTags: [] });

    expect(html).not.toContain("Что было правдой?");
  });

  it("shows the company photos with their audience line and the add tile", () => {
    const html = renderAfterEvent();

    expect(html).toContain("видят только 8 участников");
    expect(html).toContain('src="https://cdn.example.com/a.jpg"');
    expect(html).toContain('aria-label="Добавить фото"');
  });

  it("keeps the audience line off while nobody counted the participants", () => {
    expect(renderAfterEvent({ participants: null })).not.toContain("видят только");
  });

  it("draws the taste bars with their values", () => {
    const html = renderAfterEvent();

    expect(html).toContain("Твой вкус уточнился");
    expect(html).toContain("width:40%");
    expect(html).toContain(">20</span>");
  });

  it("blocks saving until a verdict is picked and while a save is in flight", () => {
    expect(renderAfterEvent()).toContain("disabled");
    expect(renderAfterEvent({ verdictCode: "ok" })).not.toContain("disabled");
    expect(renderAfterEvent({ verdictCode: "ok", saving: true })).toContain("Сохраняем…");
  });

  it("says nothing about a failed save until one fails", () => {
    expect(renderAfterEvent()).not.toContain("app-after-error");
    expect(renderAfterEvent({ failed: true })).toContain("Не удалось сохранить");
  });
});
