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
    introDirection: over.introDirection,
    city: over.city === undefined ? "Москва" : over.city,
    cityDetect: over.cityDetect ?? "matched",
    cityPicked: over.cityPicked ?? false,
    suggestions: over.suggestions ?? suggestions,
    followed: over.followed ?? ["a1"],
    interests: over.interests ?? [],
    status: over.status ?? "ready",
    saveFailed: over.saveFailed ?? false,
    blocked: over.blocked ?? null,
    onIntro: noop,
    onSkipIntro: noop,
    onCity: noop,
    onLocate: noop,
    onToggleFriend: noop,
    onToggleInterest: noop,
    onNext: noop,
    onBack: noop,
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
    expect(html.match(/app-onboarding-bitset--on/g)).toHaveLength(1);
    expect(html).toContain("Анна");
    expect(html).toContain("Ассистент");
    expect(html).toContain("соберёмся?");
  });

  it("turns the last slide CTA into «Начать» and marks its dot", () => {
    const html = viewHtml({ step: "intro", intro: 2 });

    expect(html).toContain(INTRO_SLIDES[2].title);
    expect(html).toContain("Начать");
    expect(html).toContain("app-onboarding-dot--on");
    expect(html).toContain("app-onboarding-film");
    expect(html).toContain("/covers/kolomenskoe.jpg");
  });

  it("renders the intro even before the profile and the contacts arrive", () => {
    const html = viewHtml({ step: "intro", status: "loading" });

    expect(html).toContain(INTRO_SLIDES[0].title);
    expect(html).not.toContain("Загрузка");
  });

  it("keeps one city photograph and the same places while the bits around them change", () => {
    const html = viewHtml({ step: "intro", intro: 1 });

    expect(html).toContain("app-onboarding-film");
    expect(html).toContain("/onboarding/gorky.jpg");
    expect(html).toContain("/onboarding/kazan.jpg");
    expect(html).toContain("Парк Горького");
    expect(html).toContain("Кул-Шариф");
    expect(html).not.toContain("app-onboarding-hero--");
  });

  it("slides the copy in from the side it was flipped towards, and forward when nobody says otherwise", () => {
    const forward = viewHtml({ step: "intro", intro: 1 });
    expect(forward).toContain("app-onboarding-copy--forward");
    expect(forward).not.toContain("app-onboarding-copy--back");

    const back = viewHtml({ step: "intro", intro: 0, introDirection: "back" });
    expect(back).toContain("app-onboarding-copy--back");
    expect(back).not.toContain("app-onboarding-copy--forward");
    // Both the hero label and the body copy travel together
    expect(back.match(/app-onboarding-copy--back/g)).toHaveLength(2);
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

  it("keeps the back gesture reachable by tap: every wizard step carries the button", () => {
    // Жест — ускорение, а не единственный путь: то, что даёт смахивание вправо, обязано быть кнопкой.
    for (const step of ["city", "friends", "interests"] as const) expect(viewHtml({ step, interests: ["Концерты", "Спорт", "Театр"] })).toContain('aria-label="Назад"');
    expect(viewHtml({ step: "intro" })).not.toContain('aria-label="Назад"');
  });

  it("drops the detection claim when geolocation was refused and does not pretend Moscow was found", () => {
    const html = viewHtml({ step: "city", city: null, cityDetect: "denied" });

    expect(html).toContain("Геолокация недоступна");
    expect(html).toContain("Не выбран");
    expect(html).not.toContain("Определили по геолокации");
    expect(html).not.toContain("Рядом с тобой");
  });

  it("asks for a choice when the fix is outside every listed city", () => {
    const html = viewHtml({ step: "city", city: null, cityDetect: "outside" });

    expect(html).toContain("не рядом ни с одним городом");
    expect(html).toContain("Определить по геолокации");
    expect(html).not.toContain("Рядом с тобой");
  });
});

describe("friends step", () => {
  it("counts the contacts, renders their hints and the follow CTA", () => {
    const html = viewHtml({ step: "friends" });

    expect(html).toContain("Твои люди");
    expect(html).toContain("3 контакта из чатов MAX");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain("12 общих планов");
    expect(html).toContain("Добавить 1 и продолжить");
  });

  it("marks only the followed avatars and reports a failed write", () => {
    const html = viewHtml({ step: "friends", followed: ["a1", "a2"], saveFailed: true });

    expect(html.match(/app-onboarding-person-avatar--on/g)).toHaveLength(2);
    expect(html).toContain("Не удалось сохранить подписки");
  });

  it("keeps the rail outside the step body it animates, so the fill can travel between steps", () => {
    const html = viewHtml({ step: "friends" });

    expect(html).toContain("app-onboarding-rail--1");
    expect(html.indexOf("app-onboarding-rail")).toBeLessThan(html.indexOf("app-onboarding-step"));
    expect(html.match(/app-onboarding-rail /g)).toHaveLength(1);
    // The intro has no rail and no keyed step body: it is a carousel, not a wizard step
    expect(viewHtml({ step: "intro" })).not.toContain("app-onboarding-step");
  });
});

describe("interests step", () => {
  it("renders the twelve chips and keeps the CTA closed below three", () => {
    const html = viewHtml({ step: "interests", interests: ["Концерты", "Спорт"] });

    for (const interest of ONBOARDING_INTERESTS) expect(html).toContain(interest);
    expect(html).toContain("Дальше · выбрано 2");
    expect(html).toContain("disabled");
  });

  it("says why the forward gesture did not take, instead of swallowing it", () => {
    const refused = viewHtml({ step: "interests", interests: ["Концерты"], blocked: "Выбери ещё 2 интереса — и пойдём дальше" });

    expect(refused).toContain("Выбери ещё 2 интереса");
    expect(viewHtml({ step: "interests", interests: ["Концерты"] })).not.toContain("Выбери ещё");
  });

  it("opens the CTA once three interests are chosen", () => {
    const html = viewHtml({ step: "interests", interests: ["Концерты", "Спорт", "Театр"] });

    expect(html).toContain("Готово");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("О себе");
  });
});

describe("load states past the intro", () => {
  it("waits for the data instead of showing an empty city list", () => {
    expect(viewHtml({ step: "city", status: "loading" })).toContain("Загрузка");
    expect(viewHtml({ step: "friends", status: "error" })).toContain("Не удалось загрузить данные онбординга");
    expect(viewHtml({ step: "friends", status: "error" })).not.toContain("Твои люди");
  });
});
