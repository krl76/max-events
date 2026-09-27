import { describe, expect, it } from "vitest";
import { INTRO_SLIDES, MIN_INTERESTS, ONBOARDING_CITIES, ONBOARDING_INTERESTS, ONBOARDING_STEPS, ONBOARDING_STORAGE_KEY, bioCtaLabel, cityDetectionHint, cityForwardBlock, contactsLine, followCtaLabel, interestsCtaLabel, introDirection, isOnboardingDone, markOnboardingDone, matchedOnboardingCity, nearestOnboardingCity, nextOnboardingStep, onboardingForwardBlock, onboardingRailIndex, previousOnboardingStep } from "./onboarding";

describe("onboarding step order", () => {
  it("walks вступление → город → друзья → интересы → о себе and then hands over to the feed", () => {
    expect(ONBOARDING_STEPS).toEqual(["intro", "city", "friends", "interests", "bio"]);
    expect(nextOnboardingStep("intro")).toBe("city");
    expect(nextOnboardingStep("city")).toBe("friends");
    expect(nextOnboardingStep("friends")).toBe("interests");
    expect(nextOnboardingStep("interests")).toBe("bio");
    expect(nextOnboardingStep("bio")).toBeNull();
  });

  it("walks back the same order and stops at the intro", () => {
    expect(previousOnboardingStep("bio")).toBe("interests");
    expect(previousOnboardingStep("interests")).toBe("friends");
    expect(previousOnboardingStep("friends")).toBe("city");
    expect(previousOnboardingStep("city")).toBe("intro");
    expect(previousOnboardingStep("intro")).toBeNull();
  });

  it("refuses the forward gesture in words only where the step really is unfinished", () => {
    expect(onboardingForwardBlock("city", 0)).toBeNull();
    expect(onboardingForwardBlock("friends", 0)).toBeNull();
    expect(onboardingForwardBlock("interests", MIN_INTERESTS)).toBeNull();
    expect(onboardingForwardBlock("interests", 2)).toBe("Выбери ещё 1 интерес — и пойдём дальше");
    expect(onboardingForwardBlock("interests", 1)).toBe("Выбери ещё 2 интереса — и пойдём дальше");
  });

  it("keeps the intro off the Город · Друзья · Интересы rail", () => {
    expect(onboardingRailIndex("intro")).toBe(-1);
    expect(onboardingRailIndex("city")).toBe(0);
    expect(onboardingRailIndex("friends")).toBe(1);
    expect(onboardingRailIndex("interests")).toBe(2);
    expect(onboardingRailIndex("bio")).toBe(3);
  });
});

describe("onboarding content", () => {
  it("carries the three intro slides, each on its own hero gradient", () => {
    expect(INTRO_SLIDES).toHaveLength(3);
    expect(INTRO_SLIDES.map((slide) => slide.hero)).toEqual([1, 2, 3]);
    expect(INTRO_SLIDES[1].title).toBe("«Куда пойдём?»");
    for (const slide of INTRO_SLIDES) {
      expect(slide.label.length).toBeGreaterThan(0);
      expect(slide.description.length).toBeGreaterThan(0);
    }
  });

  it("offers the five cities and the twelve interests of the design", () => {
    expect(ONBOARDING_CITIES.map((city) => city.name)).toEqual(["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"]);
    expect(ONBOARDING_INTERESTS).toHaveLength(12);
    expect(ONBOARDING_INTERESTS[0]).toBe("Концерты");
    expect(ONBOARDING_INTERESTS[11]).toBe("Ночная жизнь");
    expect(MIN_INTERESTS).toBe(3);
  });
});

describe("city detection", () => {
  it("picks the city the viewer is standing in", () => {
    expect(nearestOnboardingCity(55.7522, 37.6156).name).toBe("Москва");
    expect(nearestOnboardingCity(59.94, 30.31).name).toBe("Санкт-Петербург");
    expect(nearestOnboardingCity(56.85, 60.61).name).toBe("Екатеринбург");
  });

  it("still answers with the nearest of the five far outside them", () => {
    expect(nearestOnboardingCity(54.7, 20.5).name).toBe("Санкт-Петербург");
    expect(nearestOnboardingCity(55.0, 73.4).name).toBe("Новосибирск");
  });

  it("accepts a fix only inside the city and refuses a far point even when Moscow is the nearest", () => {
    expect(matchedOnboardingCity(55.76, 37.62)?.name).toBe("Москва");
    expect(matchedOnboardingCity(59.94, 30.31)?.name).toBe("Санкт-Петербург");
    expect(matchedOnboardingCity(43.1, 131.9)).toBeNull();
    expect(matchedOnboardingCity(47.2, 39.7)).toBeNull();
  });

  it("claims a detection only after a fix landed in a listed city", () => {
    expect(cityDetectionHint("matched")).toContain("Определили по геолокации");
    expect(cityDetectionHint("pending")).toContain("Смотрим геолокацию");
    expect(cityDetectionHint("outside")).toContain("Выбери свой");
    expect(cityDetectionHint("denied")).toContain("Геолокация недоступна");
    expect(cityForwardBlock(null, "outside")).toBe("Выбери город из списка");
    expect(cityForwardBlock("Казань", "outside")).toBeNull();
  });
});

describe("onboarding labels", () => {
  it("declines the contact count instead of baking one ending into the string", () => {
    expect(contactsLine(12)).toMatch(/^12 контактов из чатов MAX пользуются Афишей\./);
    expect(contactsLine(1)).toMatch(/^1 контакт /);
    expect(contactsLine(3)).toMatch(/^3 контакта /);
    expect(contactsLine(11)).toMatch(/^11 контактов /);
    expect(contactsLine(22)).toMatch(/^22 контакта /);
  });

  it("drops the count from the follow CTA when nobody is selected", () => {
    expect(followCtaLabel(3)).toBe("Подписаться на 3 и продолжить");
    expect(followCtaLabel(0)).toBe("Продолжить");
  });

  it("shows the running interest counter on the last CTA", () => {
    expect(interestsCtaLabel(0)).toBe("Дальше · выбрано 0");
    expect(interestsCtaLabel(5)).toBe("Дальше · выбрано 5");
  });

  it("lets the bio step skip when empty and finish when filled", () => {
    expect(bioCtaLabel("")).toBe("Пропустить");
    expect(bioCtaLabel("  ")).toBe("Пропустить");
    expect(bioCtaLabel("Люблю джаз")).toBe("Готово");
  });
});

describe("run-once flag", () => {
  it("namespaces the key next to the theme preference", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("max-events:onboarding");
  });

  it("reads as unfinished and stays inert without a DOM instead of throwing", () => {
    expect(isOnboardingDone()).toBe(false);
    expect(() => markOnboardingDone()).not.toThrow();
  });
});

describe("intro copy direction", () => {
  it("enters from the left only when the slide index went down", () => {
    expect(introDirection(0, 1)).toBe("forward");
    expect(introDirection(0, 2)).toBe("forward");
    expect(introDirection(2, 1)).toBe("back");
    expect(introDirection(2, 0)).toBe("back");
    // Standing still is not a step back
    expect(introDirection(1, 1)).toBe("forward");
  });
});
