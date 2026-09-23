import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Achievement } from "@max-events/api-contracts";
import { mockEvents } from "../api/mock";
import { ACHIEVEMENT_TITLES, AchievementsView, achievementProgressPercent, collectedSummary, grantedLabel, nearestAchievement, nearestHint, remainingLabel, type AchievementsState } from "./AchievementsPage";

const NOW = new Date(2026, 8, 18, 12, 0, 0);

const explorer: Achievement = { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: 10, grantedAt: "2026-09-06T10:00:00+03:00" };
const musicFan: Achievement = { code: "music_fan", title: "Музыкальный фанат", threshold: 12, progress: 7, grantedAt: null };
const weekend: Achievement = { code: "weekend_city", title: "Город за выходные", threshold: 10, progress: 4, grantedAt: null };
const volunteer: Achievement = { code: "volunteer", title: "Волонтёр", threshold: 5, progress: 1, grantedAt: null };

const all = [explorer, musicFan, weekend, volunteer];
const state: AchievementsState = { status: "ready", achievements: all };

describe("achievement labels", () => {
  it("names the four the way the design names them, not the way the backend stores them", () => {
    expect(ACHIEVEMENT_TITLES.music_fan).toBe("Меломан");
    expect(ACHIEVEMENT_TITLES.weekend_city).toBe("Город на выходных");
    expect(ACHIEVEMENT_TITLES.city_explorer).toBe("Исследователь города");
    expect(ACHIEVEMENT_TITLES.volunteer).toBe("Волонтёр");
  });

  it("rounds the progress ratio", () => {
    expect(achievementProgressPercent(musicFan)).toBe(58);
    expect(achievementProgressPercent(explorer)).toBe(100);
  });

  it("counts what is collected out of exactly four", () => {
    expect(collectedSummary(all)).toBe("1 из 4");
  });

  it("dates a granted stamp and counts down an unfinished one", () => {
    expect(grantedLabel("2026-09-06T10:00:00+03:00")).toBe("Получено 6 сентября");
    expect(remainingLabel(musicFan)).toBe("Осталось 5 из 12");
  });
});

describe("nearestAchievement", () => {
  it("picks the one closest to its threshold by share, not by the raw gap", () => {
    // volunteer is 4 away and music_fan 5, but 7/12 is a bigger share than 1/5.
    expect(nearestAchievement(all)?.code).toBe("music_fan");
  });

  it("never suggests something already collected, and says nothing when all four are in", () => {
    expect(nearestAchievement([explorer])).toBeNull();
  });
});

describe("nearestHint", () => {
  it("counts what is left in the unit the achievement measures", () => {
    expect(nearestHint(musicFan, null, NOW)).toBe("Осталось 5 концертов до порога.");
    expect(nearestHint(volunteer, null, NOW)).toBe("Осталось 4 акции до порога.");
  });

  it("names the weekday of an event inside the week and the date past it", () => {
    const friday = { ...mockEvents[0], title: "Джаз-квартет", startsAt: new Date(2026, 8, 18, 20, 0).toISOString() };
    const later = { ...mockEvents[0], title: "Джаз-квартет", startsAt: new Date(2026, 9, 10, 20, 0).toISOString() };

    expect(nearestHint(musicFan, friday, NOW)).toBe("Осталось 5 концертов до порога. В пятницу как раз Джаз-квартет.");
    expect(nearestHint(musicFan, later, NOW)).toContain("октября как раз Джаз-квартет.");
  });
});

describe("AchievementsView", () => {
  it("renders the summary, the line about the four and all four cards", () => {
    const html = renderToStaticMarkup(createElement(AchievementsView, { state, now: NOW }));

    expect(html).toContain("1 из 4");
    expect(html).toContain("собрано");
    expect(html).toContain("Достижений всего четыре, и они только про тебя. Чужие мы не показываем.");
    expect(html.match(/class="app-ach-card[ "]/g)).toHaveLength(4);
    expect(html).toContain("Меломан");
    expect(html).toContain("Получено 6 сентября");
    expect(html).toContain("Осталось 5 из 12");
  });

  it("marks exactly the granted card and gives the unfinished ones their counter", () => {
    const html = renderToStaticMarkup(createElement(AchievementsView, { state, now: NOW }));

    expect(html.match(/app-ach-card--granted/g)).toHaveLength(1);
    expect(html).toContain("/12</span>");
  });

  it("points at the nearest achievement and hides the entry while there is no event to open", () => {
    const html = renderToStaticMarkup(createElement(AchievementsView, { state, now: NOW }));

    expect(html).toContain("Ближе всего — меломан");
    expect(html).not.toContain("Открыть событие");
  });

  it("offers the event entry once one is found", () => {
    const event = { ...mockEvents[0], title: "Джаз-квартет", startsAt: new Date(2026, 8, 18, 20, 0).toISOString() };
    const html = renderToStaticMarkup(createElement(AchievementsView, { state, event, now: NOW }));

    expect(html).toContain("Открыть событие");
    expect(html).toContain("В пятницу как раз Джаз-квартет.");
  });

  it("shows loading and error states", () => {
    expect(renderToStaticMarkup(createElement(AchievementsView, { state: { status: "loading" } }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(AchievementsView, { state: { status: "error" } }))).toContain("Не удалось загрузить достижения.");
  });
});
