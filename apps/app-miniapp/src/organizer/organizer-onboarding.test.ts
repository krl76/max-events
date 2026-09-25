import { describe, expect, it } from "vitest";
import { ORGANIZER_ACTIVITY_OPTIONS, ORGANIZER_INTRO_SLIDES, ORGANIZER_INTRO_STORAGE_KEY, ORGANIZER_NEXT_UP, ORGANIZER_SETUP_RAIL, nextOrganizerSetupStep, organizerSetupCtaLabel, organizerSetupRailIndex, organizerVenueInitials, previousOrganizerSetupStep } from "./organizer-onboarding";

describe("ORGANIZER_INTRO_SLIDES", () => {
  it("carries three slides, one per hero gradient, as the user intro does", () => {
    expect(ORGANIZER_INTRO_SLIDES).toHaveLength(3);
    expect(ORGANIZER_INTRO_SLIDES.map((slide) => slide.hero)).toEqual([1, 2, 3]);
  });

  it("keeps the slide макет draws word for word", () => {
    const slide = ORGANIZER_INTRO_SLIDES[1];

    expect(slide.label).toBe("Записи и слоты");
    expect(slide.title).toBe("Люди бронируют конкретное время");
  });

  it("says something on every slide instead of leaving a blank one", () => {
    for (const slide of ORGANIZER_INTRO_SLIDES) {
      expect(slide.label.trim()).not.toBe("");
      expect(slide.title.trim()).not.toBe("");
      expect(slide.description.trim()).not.toBe("");
    }
  });
});

describe("ORGANIZER_INTRO_STORAGE_KEY", () => {
  it("lives in the same namespace as the user onboarding flag, under its own name", () => {
    expect(ORGANIZER_INTRO_STORAGE_KEY.startsWith("max-events:")).toBe(true);
    expect(ORGANIZER_INTRO_STORAGE_KEY).not.toBe("max-events:onboarding");
  });
});

describe("ORGANIZER_SETUP_RAIL", () => {
  it("runs Площадка -> Реквизиты -> Событие", () => {
    expect(ORGANIZER_SETUP_RAIL.map((item) => item.label)).toEqual(["Площадка", "Реквизиты", "Событие"]);
    expect(ORGANIZER_SETUP_RAIL.map((item) => item.step)).toEqual(["venue", "payouts", "event"]);
  });

  it("places every step on the rail it names", () => {
    expect(ORGANIZER_SETUP_RAIL.map((item) => organizerSetupRailIndex(item.step))).toEqual([0, 1, 2]);
  });
});

describe("nextOrganizerSetupStep", () => {
  it("walks the rail forward and ends with null instead of looping", () => {
    expect(nextOrganizerSetupStep("venue")).toBe("payouts");
    expect(nextOrganizerSetupStep("payouts")).toBe("event");
    expect(nextOrganizerSetupStep("event")).toBeNull();
  });
});

describe("previousOrganizerSetupStep", () => {
  it("walks it back, with nothing before the first step", () => {
    expect(previousOrganizerSetupStep("event")).toBe("payouts");
    expect(previousOrganizerSetupStep("payouts")).toBe("venue");
    expect(previousOrganizerSetupStep("venue")).toBeNull();
  });
});

describe("organizerSetupCtaLabel", () => {
  it("names where the button leads, the way макет does", () => {
    expect(organizerSetupCtaLabel("venue")).toBe("Дальше · реквизиты");
    expect(organizerSetupCtaLabel("payouts")).toBe("Дальше · событие");
  });

  it("has nowhere further to point on the last step", () => {
    expect(organizerSetupCtaLabel("event")).toBe("Готово");
  });
});

describe("organizerVenueInitials", () => {
  it("reads «Парк Горького» as ПГ, the way макет draws the tile", () => {
    expect(organizerVenueInitials("Парк Горького")).toBe("ПГ");
  });

  it("takes two letters from a single-word name and ignores the rest of the words", () => {
    expect(organizerVenueInitials("Лужники")).toBe("ЛУ");
    expect(organizerVenueInitials("Дом культуры ГЭС-2")).toBe("ДК");
  });

  it("survives a blank name rather than drawing a stray letter", () => {
    expect(organizerVenueInitials("   ")).toBe("");
  });
});

describe("ORGANIZER_ACTIVITY_OPTIONS", () => {
  it("lists the five chips of макета in its order", () => {
    expect(ORGANIZER_ACTIVITY_OPTIONS.map((option) => option.label)).toEqual(["События", "Слоты и аренда", "Экскурсии", "Спорт", "Волонтёрство"]);
  });

  it("keeps one contract value per chip", () => {
    expect(new Set(ORGANIZER_ACTIVITY_OPTIONS.map((option) => option.activity)).size).toBe(ORGANIZER_ACTIVITY_OPTIONS.length);
  });
});

describe("ORGANIZER_NEXT_UP", () => {
  it("promises the three things макет promises under «ДАЛЬШЕ ПОНАДОБИТСЯ»", () => {
    expect(ORGANIZER_NEXT_UP.map((item) => item.text)).toEqual(["Реквизиты — чтобы принимать оплату", "Первое событие — черновик сохранится", "Чек-ин на входе — включится сам"]);
  });
});
