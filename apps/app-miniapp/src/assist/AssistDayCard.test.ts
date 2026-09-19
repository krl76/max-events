import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockAssistDay, resetMockAssist, resetMockPlans } from "../api/mock";
import { AssistDayCard, type AssistDayState } from "./AssistDayCard";

const noop = () => {};

afterEach(() => {
  resetMockAssist();
  resetMockPlans();
});

function cardHtml(state: AssistDayState): string {
  return renderToStaticMarkup(createElement(AssistDayCard, { state, onOpenEvent: noop, onOpenPlan: noop, onCreatePlan: noop }));
}

function readyResult(save = false) {
  const result = mockAssistDay({ query: "план на субботу", save });
  if (typeof result === "string") throw new Error(`unexpected assist day error: ${result}`);
  return result;
}

describe("AssistDayCard", () => {
  it("renders nothing while idle", () => {
    expect(cardHtml({ status: "idle" })).toBe("");
  });

  it("renders the loading state without the error marker", () => {
    const html = cardHtml({ status: "loading" });

    expect(html).toContain("Собираем план на субботу");
    expect(html).not.toContain("app-state--error");
  });

  it("renders the error state with the message", () => {
    const html = cardHtml({ status: "error", message: "Не удалось собрать план на субботу." });

    expect(html).toContain("app-state--error");
    expect(html).toContain("Не удалось собрать план на субботу.");
  });

  it("renders the stops timeline and the create-plan CTA when no plan was persisted", () => {
    const result = readyResult();
    const html = cardHtml({ status: "ready", result });

    expect(html).toContain(result.summary);
    for (const stop of result.stops) {
      expect(html).toContain(stop.event.title);
      expect(html).toContain(stop.explanation);
    }
    expect(html).toContain("Создать план");
    expect(html).not.toContain("Открыть план");
  });

  it("switches to the open-plan CTA when the day plan was persisted", () => {
    const result = readyResult(true);
    const html = cardHtml({ status: "ready", result });

    expect(html).toContain("Открыть план");
    expect(html).not.toContain("Создать план");
  });
});
