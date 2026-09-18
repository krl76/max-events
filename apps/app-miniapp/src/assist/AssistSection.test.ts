import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistCompanySchema, AssistGenreSchema, AssistWhenSchema } from "@max-events/api-contracts";
import { ApiError } from "../api/client";
import { mockAssistDay, mockAssistSuggest, resetMockAssist, resetMockPlans } from "../api/mock";
import { ASSIST_COMPANY_LABELS, ASSIST_GENRE_LABELS, ASSIST_WHEN_LABELS, AssistView, assistErrorMessage, criteriaChips, type AssistState } from "./AssistSection";
import type { AssistDayState } from "./AssistDayCard";

const noop = () => {};
const README_QUERY = "Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка";

afterEach(() => {
  resetMockAssist();
  resetMockPlans();
});

function viewHtml(over: { query?: string; state?: AssistState; day?: AssistDayState } = {}): string {
  return renderToStaticMarkup(
    createElement(AssistView, {
      query: over.query ?? README_QUERY,
      state: over.state ?? { status: "idle" },
      day: over.day ?? { status: "idle" },
      onQuery: noop,
      onSubmit: noop,
      onPlanDay: noop,
      onCreatePlan: noop,
      onOpenEvent: noop,
      onOpenPlan: noop,
    }),
  );
}

describe("criteria labels", () => {
  it("covers every contract enum value exactly once", () => {
    expect(Object.keys(ASSIST_WHEN_LABELS).sort()).toEqual([...AssistWhenSchema.options].sort());
    expect(Object.keys(ASSIST_COMPANY_LABELS).sort()).toEqual([...AssistCompanySchema.options].sort());
    expect(Object.keys(ASSIST_GENRE_LABELS).sort()).toEqual([...AssistGenreSchema.options].sort());
  });

  it("maps parsed criteria to chip texts", () => {
    expect(criteriaChips({ when: "evening", budgetMaxRub: 3000, company: "partner", genre: "music" })).toEqual(["Вечером", "До 3000 ₽", "Вдвоём", "Музыка"]);
    expect(criteriaChips({ when: "any", budgetMaxRub: null, company: "alone", genre: "any" })).toEqual(["В любое время", "Любой бюджет", "Один", "Любой жанр"]);
  });
});

describe("assistErrorMessage", () => {
  it("maps 429 to the rate-limit text and keeps the fallback otherwise", () => {
    expect(assistErrorMessage(new ApiError(429, "limited"), "fallback")).toContain("Слишком много запросов");
    expect(assistErrorMessage(new ApiError(500, "broken"), "fallback")).toBe("fallback");
    expect(assistErrorMessage(new Error("network"), "fallback")).toBe("fallback");
  });
});

describe("AssistView", () => {
  it("renders the field->results->CTA link-up: query input, summary, criteria chips and explained picks", () => {
    const result = mockAssistSuggest({ query: README_QUERY });
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;
    const state: AssistState = { status: "ready", result };
    const html = viewHtml({ state });

    expect(html).toContain(README_QUERY);
    expect(html).toContain("Найти");
    expect(html).toContain("Сделай нам план на субботу");
    expect(html).toContain(result.summary);
    for (const chip of criteriaChips(result.criteria)) expect(html).toContain(chip);
    expect(html.match(/app-card--link/g)).toHaveLength(result.items.length);
    for (const pick of result.items) {
      expect(html).toContain(pick.event.title);
      expect(html).toContain(pick.explanation);
    }
  });

  it("renders the empty state when nothing matches", () => {
    const result = mockAssistSuggest({ query: README_QUERY });
    if (typeof result === "string") throw new Error("unexpected assist error");
    const html = viewHtml({ state: { status: "ready", result: { ...result, summary: "Не нашел вариантов по запросу.", items: [] } } });

    expect(html).toContain("Не нашел вариантов по запросу.");
    expect(html).toContain("Ничего не нашлось");
    expect(html).not.toContain("app-card--link");
  });

  it("renders the loading and error states", () => {
    expect(viewHtml({ state: { status: "loading" } })).toContain("Подбираем варианты");
    const error = viewHtml({ state: { status: "error", message: "Слишком много запросов подряд — подождите пару минут и попробуйте снова." } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Слишком много запросов");
  });

  it("renders the Saturday plan timeline with the create-plan CTA when plan is null", () => {
    const result = mockAssistDay({ query: "план на субботу" });
    if (typeof result === "string") throw new Error("unexpected assist day error");
    const html = viewHtml({ day: { status: "ready", result } });

    expect(html).toContain(result.summary);
    for (const stop of result.stops) {
      expect(html).toContain(stop.event.title);
      expect(html).toContain(stop.explanation);
    }
    expect(html).toContain("Создать план");
    expect(html).not.toContain("Открыть план");
  });

  it("renders the open-plan CTA when the day plan was persisted", () => {
    const result = mockAssistDay({ query: "план на субботу", save: true });
    if (typeof result === "string") throw new Error("unexpected assist day error");
    const html = viewHtml({ day: { status: "ready", result } });

    expect(html).toContain("Открыть план");
    expect(html).not.toContain("Создать план");
  });

  it("renders the day loading and error states", () => {
    expect(viewHtml({ day: { status: "loading" } })).toContain("Собираем план на субботу");
    const error = viewHtml({ day: { status: "error", message: "Не удалось собрать план на субботу." } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось собрать план");
  });
});
