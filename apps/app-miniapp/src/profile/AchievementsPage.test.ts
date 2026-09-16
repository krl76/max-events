import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AchievementsView, achievementProgressPercent, type AchievementsState } from "./AchievementsPage";
import type { Achievement } from "@max-events/api-contracts";

const granted: Achievement = { code: "volunteer", title: "Волонтёр", threshold: 5, progress: 5, grantedAt: "2026-09-20T10:00:00Z" };
const pending: Achievement = { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: 4, grantedAt: null };

describe("achievementProgressPercent", () => {
  it("rounds the progress ratio", () => {
    expect(achievementProgressPercent(pending)).toBe(40);
    expect(achievementProgressPercent(granted)).toBe(100);
  });
});

describe("AchievementsView", () => {
  const state: AchievementsState = { status: "ready", achievements: [granted, pending] };

  it("renders every achievement with its progress line", () => {
    const html = renderToStaticMarkup(createElement(AchievementsView, { state }));

    expect(html).toContain("Волонтёр");
    expect(html).toContain("Исследователь города");
    expect(html).toContain("5 / 5");
    expect(html).toContain("4 / 10");
  });

  it("marks granted stamps visually and shows percent on pending ones", () => {
    const html = renderToStaticMarkup(createElement(AchievementsView, { state }));

    expect(html.match(/app-achievement--granted/g)).toHaveLength(1);
    expect(html).toContain("✓");
    expect(html).toContain(">40</span>");
  });

  it("shows loading and error states", () => {
    expect(renderToStaticMarkup(createElement(AchievementsView, { state: { status: "loading" } }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(AchievementsView, { state: { status: "error" } }))).toContain("Не удалось загрузить достижения.");
  });
});
