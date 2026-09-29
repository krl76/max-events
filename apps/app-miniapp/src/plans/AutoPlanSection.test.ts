import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoPlanSection, AutoPlanView, formatTimelineAt, type AutoPlanState } from "./AutoPlanSection";
import { createMockAutoPlan, mockEvents, mockPlaces, resetMockPlans } from "../api/mock";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const PARK_EVENT = mockEvents.find((item) => item.placeId === mockPlaces[0].id)!;
const noop = () => {};

function proposal() {
  const result = createMockAutoPlan({ eventId: PARK_EVENT.id, latitude: MOSCOW[0], longitude: MOSCOW[1] });
  if (result === "no_event") throw new Error("fixture autoplan failed to build");
  return result;
}

function viewHtml(state: AutoPlanState): string {
  return renderToStaticMarkup(createElement(AutoPlanView, { state, onBuild: noop, onOpenPlan: noop }));
}

describe("formatTimelineAt", () => {
  it("formats the step time as ru HH:MM", () => {
    expect(formatTimelineAt("2026-09-20T09:05:00.000Z")).toMatch(/^\d{1,2}:\d{2}$/);
    expect(formatTimelineAt("2026-09-20T09:05:00.000Z")).toBe(new Date("2026-09-20T09:05:00.000Z").toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
  });
});

describe("AutoPlanView", () => {
  afterEach(() => {
    resetMockPlans();
  });

  it("offers the «Собрать план» CTA in the idle state", () => {
    const html = viewHtml({ status: "idle" });

    expect(html).toContain("Собрать план");
    expect(html).not.toContain("План на вечер");
    expect(html).not.toContain("Открыть план");
  });

  it("renders the timeline, the travel line, the food picks and the plan entry in the ready state", () => {
    const built = proposal();
    const html = viewHtml({ status: "ready", proposal: built });

    for (const step of built.timeline) {
      expect(html).toContain(step.label);
      expect(html).toContain(step.detail);
    }
    expect(html).toContain(`${built.travelMinutes} мин до места`);
    for (const place of built.foodPlaces) expect(html).toContain(place.title);
    expect(html).toContain("Открыть план");
    expect(html).not.toContain("Собрать план");
  });

  it("renders the loading state and the error state with the retry CTA", () => {
    expect(viewHtml({ status: "loading" })).toContain("Собираем план");

    const error = viewHtml({ status: "error" });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось собрать план");
    expect(error).toContain("Собрать план");
  });
});

describe("AutoPlanSection", () => {
  it("starts idle with the CTA", () => {
    const html = renderToStaticMarkup(createElement(AutoPlanSection, { eventId: PARK_EVENT.id }));

    expect(html).toContain("Собрать план");
  });
});
