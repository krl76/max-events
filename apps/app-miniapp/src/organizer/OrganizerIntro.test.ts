import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizerIntroView, type OrganizerIntroViewProps } from "./OrganizerIntro";
import { ORGANIZER_INTRO_SLIDES } from "./organizer-onboarding";

const noop = () => {};

function draw(overrides: Partial<OrganizerIntroViewProps> = {}): string {
  return renderToStaticMarkup(createElement(OrganizerIntroView, { slide: 0, direction: "forward", onSlide: noop, onSkip: noop, onNext: noop, onBack: noop, ...overrides }));
}

describe("OrganizerIntroView", () => {
  it("draws the slide it was given, hero label and all", () => {
    const html = draw({ slide: 1 });
    const slide = ORGANIZER_INTRO_SLIDES[1];

    expect(html).toContain(slide.label);
    expect(html).toContain(slide.title);
    expect(html).toContain(slide.description);
  });

  it("shows no other slide's copy at the same time", () => {
    const html = draw({ slide: 1 });

    expect(html).not.toContain(ORGANIZER_INTRO_SLIDES[0].title);
    expect(html).not.toContain(ORGANIZER_INTRO_SLIDES[2].title);
  });

  it("carries one dot per slide and marks exactly the current one", () => {
    const html = draw({ slide: 2 });

    expect(html.match(/app-onboarding-dot/g)?.length).toBeGreaterThanOrEqual(ORGANIZER_INTRO_SLIDES.length);
    expect(html.match(/app-onboarding-dot--on/g)).toHaveLength(1);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("offers «Пропустить» on every slide — the заслон must have a way past it", () => {
    for (let slide = 0; slide < ORGANIZER_INTRO_SLIDES.length; slide += 1) {
      expect(draw({ slide })).toContain("Пропустить");
    }
  });

  it("says «Дальше» until the last slide, where it says «Начать»", () => {
    expect(draw({ slide: 0 })).toContain("Дальше");
    expect(draw({ slide: 0 })).not.toContain("Начать");
    expect(draw({ slide: ORGANIZER_INTRO_SLIDES.length - 1 })).toContain("Начать");
  });

  it("wears the hero gradient of its own slide, crossfading the three layers", () => {
    const html = draw({ slide: 2 });

    expect(html).toContain("app-onboarding-hero--3");
    expect(html.match(/app-onboarding-hero-bg--on/g)).toHaveLength(1);
  });

  it("enters the copy from the side the finger came from", () => {
    expect(draw({ direction: "back" })).toContain("app-onboarding-copy--back");
    expect(draw({ direction: "forward" })).toContain("app-onboarding-copy--forward");
  });

  it("carries the афиша·MAX wordmark on the hero, as the user intro does", () => {
    expect(draw()).toContain('aria-label="афиша MAX"');
  });
});
