import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeisureMoodSchema, NearbyBucketSchema } from "@max-events/api-contracts";
import type { LeisureMood } from "@max-events/api-contracts";
import { BUCKET_LABELS, LEISURE_MOOD_LABELS, NEARBY_RADIUS_KM, NearbyView, STOP_KIND_LABELS, bucketCountLabel, chainPlanDraft, chainStopMeta, chainTitle, chainWindow, formatDistanceKm, nearbyCardWhen, nearbyEmptyTitle, nearbyOriginCaption, type LeisureState, type NearbyMode, type NearbyState } from "./NearbyPage";
import { MOCK_NOW, leisureOptions, nearbyTimeline } from "../api/mock";
import type { LeisureChain, LeisureChainStop } from "../api/client";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const noop = () => {};

const ready: NearbyState = { status: "ready", timeline: nearbyTimeline(...MOSCOW) };
const relax = leisureOptions(3, "relax", ...MOSCOW);

const stop = (over: Partial<LeisureChainStop> = {}): LeisureChainStop => ({ kind: "place", placeId: "b1", eventId: null, title: "Парк Горького", startsAt: "2026-09-12T19:00:00+03:00", distanceKm: 0.4, priceRub: 400, free: false, ...over });

function viewHtml(over: { mode?: NearbyMode; state?: NearbyState; leisure?: LeisureState; hours?: number; mood?: LeisureMood } = {}): string {
  return renderToStaticMarkup(
    createElement(NearbyView, {
      mode: over.mode ?? "timeline",
      onMode: noop,
      state: over.state ?? ready,
      leisure: over.leisure ?? { status: "ready", chains: relax },
      hours: over.hours ?? 3,
      mood: over.mood ?? "relax",
      now: MOCK_NOW,
      onHours: noop,
      onMood: noop,
      onRefresh: noop,
      onRetryTimeline: noop,
      onOpenPlan: noop,
      onOpenEvent: noop,
      onOpenPlace: noop,
    }),
  );
}

describe("закрытые наборы", () => {
  it("покрывают сегменты и настроения контракта ровно один раз", () => {
    expect(Object.keys(BUCKET_LABELS).sort()).toEqual([...NearbyBucketSchema.options].sort());
    expect(Object.keys(LEISURE_MOOD_LABELS).sort()).toEqual([...LeisureMoodSchema.options].sort());
    expect(Object.keys(STOP_KIND_LABELS).sort()).toEqual(["event", "place"]);
  });
});

describe("форматирование строк таймлайна", () => {
  it("говорит «от вас» только когда радиус начинается у зрителя", () => {
    expect(nearbyOriginCaption(true, "geo")).toBe("от вас");
    expect(nearbyOriginCaption(false, "geo")).toBe("от центра города");
    expect(nearbyOriginCaption(true, "fallback")).toBe("от центра города");
    expect(nearbyEmptyTitle(true)).toBe("Рядом пока ничего не начинается");
    expect(nearbyEmptyTitle(false)).toBe("В городе пока ничего не начинается");
  });

  it("печатает один знак после запятой по-русски", () => {
    expect(formatDistanceKm(1.2)).toBe("1,2 км");
    expect(formatDistanceKm(3)).toBe("3,0 км");
  });

  it("склоняет «место» по числу", () => {
    expect(bucketCountLabel(1)).toBe("1 место");
    expect(bucketCountLabel(4)).toBe("4 места");
    expect(bucketCountLabel(11)).toBe("11 мест");
  });

  const event = (startsAt: string, endsAt: string | null) => ({ startsAt, endsAt });

  it("в сегменте «сейчас» показывает конец, а без него — «идёт»", () => {
    expect(nearbyCardWhen({ bucket: "now", event: event("2026-09-12T11:40:00+03:00", "2026-09-12T23:00:00+03:00") })).toBe("до 23:00");
    expect(nearbyCardWhen({ bucket: "now", event: event("2026-09-12T11:40:00+03:00", null) })).toBe("идёт");
  });

  it("в остальных сегментах показывает начало", () => {
    expect(nearbyCardWhen({ bucket: "evening", event: event("2026-09-12T21:00:00+03:00", null) })).toBe("21:00");
    expect(nearbyCardWhen({ bucket: "tomorrow", event: event("2026-09-13T10:00:00+03:00", "2026-09-13T14:00:00+03:00") })).toBe("10:00");
  });
});

describe("заголовок, окно и шаг цепочки", () => {
  it("склоняет часы", () => {
    expect(chainTitle(1)).toBe("Цепочка на 1 час");
    expect(chainTitle(3)).toBe("Цепочка на 3 часа");
    expect(chainTitle(8)).toBe("Цепочка на 8 часов");
  });

  it("открывает окно первым шагом, который знает свой час", () => {
    expect(chainWindow([stop({ startsAt: null }), stop({ startsAt: "2026-09-12T19:00:00+03:00" })], 3, MOCK_NOW)).toBe("19:00 – 22:00");
  });

  it("без единого часа считает окно от текущего момента", () => {
    expect(chainWindow([stop({ startsAt: null })], 2, MOCK_NOW)).toBe("12:00 – 14:00");
  });

  it("собирает время, расстояние и цену", () => {
    expect(chainStopMeta(stop())).toBe("19:00 · 0,4 км · 400 ₽");
  });

  it("бесплатное называет словом, а неизвестное молчанием", () => {
    expect(chainStopMeta(stop({ priceRub: null, free: true }))).toBe("19:00 · 0,4 км · бесплатно");
    expect(chainStopMeta(stop({ priceRub: null, free: false, distanceKm: null }))).toBe("19:00");
  });
});

describe("chainPlanDraft", () => {
  const chain = (stops: LeisureChainStop[]): LeisureChain => ({ mood: "relax", title: "Цепочка", stops });

  it("вешает план на первое событие цепочки, встречу — на первый шаг", () => {
    const draft = chainPlanDraft(chain([stop(), stop({ kind: "event", eventId: "c1", placeId: "b2", title: "Настолки", startsAt: "2026-09-12T19:40:00+03:00" })]));

    expect(draft).toEqual({ eventId: "c1", participantIds: [], meetingPoint: "Парк Горького", meetingAt: "2026-09-12T19:00:00+03:00" });
  });

  it("без события плана не собирает", () => {
    expect(chainPlanDraft(chain([stop(), stop({ title: "Бар «Кузница»" })]))).toBeNull();
  });
});

describe("NearbyView: таймлайн (экран 13)", () => {
  it("рисует переключатель режимов и радиус", () => {
    const html = viewHtml({ mode: "timeline" });

    expect(html).toContain("Таймлайн");
    expect(html).toContain("Свободное время");
    expect(html).toContain(`Радиус ${NEARBY_RADIUS_KM} км`);
    expect(html).toContain("время московское");
  });

  it("показывает все непустые сегменты со счётчиком мест", () => {
    const html = viewHtml({ mode: "timeline" });

    expect(html).toContain("Сейчас");
    expect(html).toContain("Вечером");
    expect(html).toContain("Летний концерт на Пушкинской набережной");
    expect(html).toContain("Лекция об импрессионистах");
    expect(html).toContain("км");
  });

  it("вешает бейдж «Промо» только на продвинутую карточку", () => {
    const promoted = nearbyTimeline(...MOSCOW).now;
    const html = viewHtml({ mode: "timeline" });

    expect(promoted.some((card) => card.promoted)).toBe(true);
    expect(html.match(/Промо/g)!.length).toBe(promoted.filter((card) => card.promoted).length);
  });

  it("пустой таймлайн объясняет радиусом, а не молчанием", () => {
    const empty: NearbyState = { status: "ready", timeline: { now: [], inAnHour: [], evening: [], tomorrow: [] } };
    const html = viewHtml({ mode: "timeline", state: empty });

    expect(html).toContain("Рядом пока ничего не начинается");
    expect(html).toContain(`${NEARBY_RADIUS_KM} км`);
  });

  it("рисует загрузку и ошибку", () => {
    expect(viewHtml({ mode: "timeline", state: { status: "loading" } })).toContain("Загрузка");
    const error = viewHtml({ mode: "timeline", state: { status: "error" } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить события рядом");
  });
});

describe("NearbyView: свободное время (экран 14)", () => {
  it("даёт восемь окон и три настроения", () => {
    const html = viewHtml({ mode: "free" });

    for (const label of Object.values(LEISURE_MOOD_LABELS)) expect(html).toContain(label);
    expect(html.match(/class="app-nb-hour[ "]/g)!.length).toBe(8);
    expect(html).toContain('aria-checked="true"');
  });

  it("рисует цепочку шагами с типом, временем и ценой", () => {
    const html = viewHtml({ mode: "free" });

    expect(relax[0].stops.length).toBeGreaterThan(1);
    expect(html).toContain(chainTitle(3));
    expect(html).toContain(chainWindow(relax[0].stops, 3, MOCK_NOW));
    for (const item of relax[0].stops) {
      expect(html).toContain(item.title);
      expect(html).toContain(chainStopMeta(item));
    }
    expect(html).toContain("Место");
    expect(html).toContain("Открыть как план");
  });

  it("цепочку без события в план не пускает и объясняет почему", () => {
    const chains: LeisureChain[] = [{ mood: "relax", title: "Только места", stops: [stop(), stop({ title: "Бар «Кузница»" })] }];
    const html = viewHtml({ mode: "free", leisure: { status: "ready", chains } });

    expect(html).toContain("План собирается вокруг события");
    expect(html).toContain("disabled");
  });

  it("рисует пустое состояние, загрузку и ошибку", () => {
    const empty = viewHtml({ mode: "free", leisure: { status: "ready", chains: [] } });
    expect(empty).toContain("В это окно цепочка не складывается");

    expect(viewHtml({ mode: "free", leisure: { status: "loading" } })).toContain("Загрузка");

    const error = viewHtml({ mode: "free", leisure: { status: "error" } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось собрать цепочку");
  });
});
