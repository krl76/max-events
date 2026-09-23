import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AfterMeResponse } from "@max-events/api-contracts";
import { afterMeSuggestions, AfterMeView } from "./AfterMeSection";
import { mockEvents } from "../api/mock";

const suggestion = {
  fromCategory: "sport" as const,
  toCategory: "sport" as const,
  afterCount: 3,
  explanation: "После 3 посещений категории «спорт» тебе зайдёт ещё что-то из этой ленты.",
  events: [mockEvents[0]!],
};

const view = (response: AfterMeResponse | null) => renderToStaticMarkup(createElement(AfterMeView, { response }));

describe("afterMeSuggestions", () => {
  it("drops a suggestion that carries no events", () => {
    // The backend answers an explanation even when it found nothing — no city on the profile, or
    // nothing upcoming in that category. That is a promise with nothing behind it.
    expect(afterMeSuggestions({ suggestions: [{ ...suggestion, events: [] }] })).toEqual([]);
    expect(afterMeSuggestions({ suggestions: [suggestion] })).toEqual([suggestion]);
    expect(afterMeSuggestions(null)).toEqual([]);
  });
});

describe("AfterMeView", () => {
  it("shows the explanation and the suggested events", () => {
    const html = view({ suggestions: [suggestion] });

    expect(html).toContain("После меня");
    expect(html).toContain(suggestion.explanation);
    expect(html).toContain(mockEvents[0]!.title);
  });

  it("renders nothing at all until the taste graph has something to say", () => {
    // Not an empty section with a heading: a visitor who has been nowhere yet gets no block.
    expect(view({ suggestions: [] })).toBe("");
    expect(view(null)).toBe("");
    expect(view({ suggestions: [{ ...suggestion, events: [] }] })).toBe("");
  });
});
