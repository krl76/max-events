import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NearbyBucketSchema } from "@max-events/api-contracts";
import type { LeisureMood, NearbyBucket } from "@max-events/api-contracts";
import { BUCKET_LABELS, formatDistanceKm, LEISURE_MOOD_LABELS, NearbyView, type LeisureState, type NearbyState } from "./NearbyPage";
import { leisureOptions, nearbyTimeline } from "../api/mock";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const noop = () => {};

const ready: NearbyState = { status: "ready", timeline: nearbyTimeline(...MOSCOW) };

function viewHtml(over: { state?: NearbyState; bucket?: NearbyBucket; leisure?: LeisureState; hours?: number; mood?: LeisureMood } = {}): string {
  return renderToStaticMarkup(
    createElement(NearbyView, {
      state: over.state ?? ready,
      bucket: over.bucket ?? "evening",
      onBucket: noop,
      leisure: over.leisure ?? { status: "idle" },
      hours: over.hours ?? 2,
      mood: over.mood ?? "relax",
      onHours: noop,
      onMood: noop,
      onShowLeisure: noop,
      onOpenEvent: noop,
      onOpenPlace: noop,
    }),
  );
}

describe("formatDistanceKm", () => {
  it("formats the distance with one decimal and the km unit", () => {
    expect(formatDistanceKm(1.2)).toBe("1.2 км");
    expect(formatDistanceKm(3)).toBe("3.0 км");
  });
});

describe("BUCKET_LABELS", () => {
  it("covers every contract bucket exactly once", () => {
    expect(Object.keys(BUCKET_LABELS).sort()).toEqual([...NearbyBucketSchema.options].sort());
  });
});

describe("NearbyView timeline", () => {
  it("renders the four segment chips and the active bucket cards", () => {
    const html = viewHtml({ bucket: "evening" });

    for (const label of Object.values(BUCKET_LABELS)) expect(html).toContain(label);
    expect(html).toContain("Летний концерт на Пушкинской набережной");
    expect(html).toContain("км");
    expect(html).toContain("Открыть событие");
    expect(html).not.toContain("Лекция об импрессионистах");
  });

  it("renders the promo badge only on promoted cards", () => {
    const promoted = viewHtml({ bucket: "now" });
    const plain = viewHtml({ bucket: "inAnHour" });

    expect(promoted).toContain("Дневной кофе-маркет");
    expect(promoted).toContain("Промо");
    expect(plain).toContain("Лекция об импрессионистах");
    expect(plain).not.toContain("Промо");
  });

  it("renders the empty state for a bucket without cards", () => {
    const empty: NearbyState = { status: "ready", timeline: { now: [], inAnHour: [], evening: [], tomorrow: [] } };
    const html = viewHtml({ state: empty, bucket: "now" });

    expect(html).toContain("рядом ничего нет");
    expect(html).not.toContain("Открыть событие");
  });

  it("renders the loading and error states", () => {
    expect(viewHtml({ state: { status: "loading" } })).toContain("Загружаем события рядом");
    const error = viewHtml({ state: { status: "error" } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить события рядом");
  });
});

describe("NearbyView leisure mode", () => {
  it("renders the hours and mood chips", () => {
    const html = viewHtml();

    for (const label of Object.values(LEISURE_MOOD_LABELS)) expect(html).toContain(label);
    expect(html).toContain("Подобрать досуг");
    expect(html.match(/aria-pressed/g)!.length).toBeGreaterThanOrEqual(8);
  });

  it("renders an expandable chain with stop CTAs", () => {
    const options = leisureOptions(3, "relax", ...MOSCOW);
    const html = viewHtml({ leisure: { status: "ready", options } });

    expect(html).toContain("<details");
    expect(html).toContain(options[0].title);
    expect(html).toContain("Остановок: 3");
    for (const stop of options[0].stops) expect(html).toContain(stop.title);
    expect(html).toContain("Открыть");
  });

  it("renders the leisure empty and error states", () => {
    const empty = viewHtml({ leisure: { status: "ready", options: [] } });
    expect(empty).toContain("Не нашлось цепочки");

    const error = viewHtml({ leisure: { status: "error" } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось подобрать досуг");
  });
});
