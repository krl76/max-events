import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssistDayResponse, AssistResponse } from "@max-events/api-contracts";
import { ASSIST_GREETING, ASSIST_PLACEHOLDER, ASSIST_PROMPTS, AssistPageView, answeredThread, askedThread, assistPickMeta, plannedThread, type AssistThread } from "./AssistPage";
import { mockAssistDay, mockAssistSuggest, mockEvents, resetMockAssist } from "../api/mock";

const START: AssistThread = [{ id: 0, role: "max", text: ASSIST_GREETING, picks: [], day: null }];

function suggestion(): AssistResponse {
  resetMockAssist();
  const result = mockAssistSuggest({ query: "Вечером вдвоём, до 3000 ₽, живая музыка" });
  if (typeof result === "string") throw new Error(`assist mock refused the query: ${result}`);
  return result;
}

function evening(): AssistDayResponse {
  resetMockAssist();
  const day = mockAssistDay({ query: "План на субботу" });
  if (typeof day === "string") throw new Error(`assist day mock refused the query: ${day}`);
  return day;
}

describe("thread transitions", () => {
  it("adds the question as the viewer's own turn", () => {
    const thread = askedThread(START, "Куда с детьми");

    expect(thread).toHaveLength(2);
    expect(thread[1].role).toBe("me");
    expect(thread[1].text).toBe("Куда с детьми");
    expect(thread[1].picks).toEqual([]);
  });

  it("adds the answer with its picks attached", () => {
    const result = suggestion();
    const thread = answeredThread(askedThread(START, "Вечером вдвоём"), result);

    expect(thread[2].role).toBe("max");
    expect(thread[2].text).toBe(result.summary);
    expect(thread[2].picks).toEqual(result.items);
    expect(thread[2].day).toBeNull();
  });

  it("adds an assembled evening as an answer that carries a plan, not picks", () => {
    const day = evening();
    const thread = plannedThread(START, day);

    expect(thread[1].day).toBe(day);
    expect(thread[1].picks).toEqual([]);
  });

  it("never reuses an id, so the list keeps its keys", () => {
    const thread = plannedThread(answeredThread(askedThread(START, "раз"), suggestion()), evening());

    expect(new Set(thread.map((bubble) => bubble.id)).size).toBe(thread.length);
  });
});

describe("assistPickMeta", () => {
  it("says the entry is free in words rather than printing 0 ₽", () => {
    const free = mockEvents.find((event) => !event.isPaid);
    if (free === undefined) throw new Error("a free fixture event is expected");

    expect(assistPickMeta(free)).toContain("вход свободный");
  });

  it("prints the price of a paid event with the currency sign", () => {
    const paid = mockEvents.find((event) => event.isPaid && event.priceRub !== null);
    if (paid === undefined || paid.priceRub === null) throw new Error("a paid fixture event is expected");

    expect(assistPickMeta(paid)).toContain(`${paid.priceRub.toLocaleString("ru-RU")} ₽`);
  });
});

describe("ASSIST_PROMPTS", () => {
  it("carries the three prompts of the design, in its order", () => {
    expect(ASSIST_PROMPTS).toEqual(["Что-то бесплатное рядом", "План на субботу: шашлык", "Куда с детьми"]);
  });
});

describe("AssistPageView", () => {
  const view = (over: Partial<Parameters<typeof AssistPageView>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(AssistPageView, {
        thread: START,
        draft: "",
        state: { status: "idle" },
        lastQuestion: null,
        onDraft: () => {},
        onSubmit: () => {},
        onPlanEvening: () => {},
        onMoreOptions: () => {},
        onPrompt: () => {},
        onOpenEvent: () => {},
        onOpenPlan: () => {},
        onClose: () => {},
        ...over,
      }),
    );

  it("opens with the greeting, the prompts and the composer", () => {
    const html = view();

    expect(html).toContain(ASSIST_GREETING);
    expect(html).toContain(ASSIST_PLACEHOLDER);
    for (const prompt of ASSIST_PROMPTS) expect(html).toContain(prompt);
  });

  it("holds the plan buttons back until MAX has answered with something to plan from", () => {
    expect(view()).not.toContain("Собрать план на вечер");

    const answered = view({ thread: answeredThread(askedThread(START, "Вечером вдвоём"), suggestion()), lastQuestion: "Вечером вдвоём" });
    expect(answered).toContain("Собрать план на вечер");
    expect(answered).toContain("Ещё варианты");
  });

  it("draws every pick with its explanation and an «Открыть» affordance", () => {
    const result = suggestion();
    const html = view({ thread: answeredThread(START, result), lastQuestion: "Вечером вдвоём" });

    for (const pick of result.items) {
      expect(html).toContain(pick.event.title);
      expect(html).toContain(pick.explanation);
    }
    expect(html).toContain("Открыть");
  });

  it("tells the viewer what went wrong instead of an empty thread", () => {
    expect(view({ state: { status: "error", message: "Слишком много запросов подряд" } })).toContain("Слишком много запросов подряд");
    expect(view({ state: { status: "loading" } })).toContain("MAX подбирает…");
  });
});
