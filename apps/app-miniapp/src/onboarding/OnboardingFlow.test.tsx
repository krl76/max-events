import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FriendSuggestion } from "../api/client";
import { OnboardingView, type OnboardingViewProps } from "./OnboardingFlow";
import { INTRO_SLIDES, ONBOARDING_INTERESTS } from "./onboarding";

const noop = () => {};

const suggestions: FriendSuggestion[] = [
  { friend: { id: "a1", name: "Анна Соколова", avatarUrl: null }, hint: "12 общих планов", followed: true },
  { friend: { id: "a2", name: "Дима Кузнецов", avatarUrl: null }, hint: "8 общих чатов", followed: false },
  { friend: { id: "a3", name: "Катя Орлова", avatarUrl: null }, hint: null, followed: false },
];

function viewHtml(over: Partial<OnboardingViewProps> = {}): string {
  const props: OnboardingViewProps = {
    step: over.step ?? "intro",
    intro: over.intro ?? 0,
    city: over.city ?? "Москва",
    citySource: over.citySource ?? "geo",
    suggestions: over.suggestions ?? suggestions,
    followed: over.followed ?? ["a1"],
    interests: over.interests ?? [],
    status: over.status ?? "ready",
    saveFailed: over.saveFailed ?? false,
    onIntro: noop,
    onSkipIntro: noop,
    onCity: noop,
    onToggleFriend: noop,
    onToggleInterest: noop,
    onNext: noop,
  };
  return renderToStaticMarkup(createElement(OnboardingView, props));
}

describe("intro step", () => {
  it("shows the current slide, the skip link and «Дальше» while slides remain", () => {
    const html = viewHtml({ step: "intro", intro: 0 });

    expect(html).toContain(INTRO_SLIDES[0].label);
    expect(html).toContain(INTRO_SLIDES[0].title);
    expect(html).toContain(INTRO_SLIDES[0].description);
    expect(html).toContain("Пропустить");
    expect(html).toContain("Дальше");
    expect(html).not.toContain("Начать");
  });

  it("turns the last slide CTA into «Начать» and marks its dot", () => {
    const html = viewHtml({ step: "intro", intro: 2 });

    expect(html).toContain(INTRO_SLIDES[2].title);
    expect(html).toContain("Начать");
    expect(html).toContain("app-onboarding-dot--on");
    expect(html).toContain("app-onboarding-hero--3");
  });

  it("renders the intro even before the profile and the contacts arrive", () => {
    const html = viewHtml({ step: "intro", status: "loading" });

    expect(html).toContain(INTRO_SLIDES[0].title);
    expect(html).not.toContain("Загрузка");
  });
});

describe("city step", () => {
  it("lists the five cities, marks the detected one and claims the detection", () => {
    const html = viewHtml({ step: "city", city: "Казань" });

    expect(html).toContain("Твой город");
    expect(html).toContain("Определили по геолокации");
    expect(html).toContain("Санкт-Петербург");
    expect(html).toContain("Новосибирск");
    expect(html).toContain("<span>Казань</span>");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("drops the detection claim when the origin is the Moscow fallback", () => {
    const html = viewHtml({ step: "city", citySource: "fallback" });

    expect(html).toContain("Геолокация недоступна");
    expect(html).not.toContain("Определили по геолокации");
  });
});

describe("friends step", () => {
  it("counts the contacts, renders their hints and the follow CTA", () => {
    const html = viewHtml({ step: "friends" });

    expect(html).toContain("Твои люди");
    expect(html).toContain("3 контакта из чатов MAX");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain("12 общих планов");
    expect(html).toContain("Подписаться на 1 и продолжить");
  });

  it("marks only the followed avatars and reports a failed write", () => {
    const html = viewHtml({ step: "friends", followed: ["a1", "a2"], saveFailed: true });

    expect(html.match(/app-onboarding-person-avatar--on/g)).toHaveLength(2);
    expect(html).toContain("Не удалось сохранить подписки");
  });
});

describe("interests step", () => {
  it("renders the twelve chips and keeps the CTA closed below three", () => {
    const html = viewHtml({ step: "interests", interests: ["Концерты", "Спорт"] });

    for (const interest of ONBOARDING_INTERESTS) expect(html).toContain(interest);
    expect(html).toContain("Готово · выбрано 2");
    expect(html).toContain("disabled");
  });

  it("opens the CTA once three interests are chosen", () => {
    const html = viewHtml({ step: "interests", interests: ["Концерты", "Спорт", "Театр"] });

    expect(html).toContain("Готово · выбрано 3");
    expect(html).not.toContain("disabled");
  });
});

describe("load states past the intro", () => {
  it("waits for the data instead of showing an empty city list", () => {
    expect(viewHtml({ step: "city", status: "loading" })).toContain("Загрузка");
    expect(viewHtml({ step: "friends", status: "error" })).toContain("Не удалось загрузить данные онбординга");
    expect(viewHtml({ step: "friends", status: "error" })).not.toContain("Твои люди");
  });
});
