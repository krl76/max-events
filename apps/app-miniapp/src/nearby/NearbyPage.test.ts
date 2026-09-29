import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeisureMoodSchema, NearbyBucketSchema } from "@max-events/api-contracts";
import type { LeisureMood } from "@max-events/api-contracts";
import { BUCKET_LABELS, LEISURE_MOOD_LABELS, NEARBY_RADIUS_KM, NearbyView, STOP_KIND_LABELS, bucketCountLabel, chainPlanDraft, chainStopMeta, chainTitle, chainWindow, formatDistanceKm, nearbyCardWhen, nearbyEmptyTitle, nearbyErrorTitle, nearbyLocationRoute, nearbyOriginCaption, nearbyScreenTitle, type LeisureState, type NearbyMode, type NearbyState } from "./NearbyPage";
import { cardMatchesQuery, cardOnDay, moscowDayKey, nearbyDayOptions } from "./nearby-filters";
import { MOCK_NOW, leisureOptions, nearbyTimeline } from "../api/mock";
import type { LeisureChain, LeisureChainStop } from "../api/client";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const noop = () => {};

const ready: NearbyState = { status: "ready", timeline: nearbyTimeline(...MOSCOW) };
const relax = leisureOptions(3, "relax", ...MOSCOW);

const stop = (over: Partial<LeisureChainStop> = {}): LeisureChainStop => ({ kind: "place", placeId: "b1", eventId: null, title: "Парк Горького", startsAt: "2026-09-12T19:00:00+03:00", distanceKm: 0.4, priceRub: 400, free: false, ...over });

function viewHtml(over: { mode?: NearbyMode; state?: NearbyState; leisure?: LeisureState; hours?: number; mood?: LeisureMood; radiusKm?: number; searchOpen?: boolean; query?: string } = {}): string {
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
      onOpenLocation: noop,
      onOpenPlace: noop,
      radiusKm: over.radiusKm,
      searchOpen: over.searchOpen,
      query: over.query,
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
    expect(nearbyScreenTitle(false)).toBe("В городе");
    expect(nearbyErrorTitle(false)).toBe("Не удалось загрузить события в городе.");
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
  it("рисует переключатель режимов, дату и радиус внизу", () => {
    const html = viewHtml({ mode: "timeline" });

    expect(html).toContain("События");
    expect(html).toContain("На часы");
    expect(html).not.toContain("время московское");
    expect(html).not.toContain("Таймлайн");
    expect(html).toContain('aria-label="Дата"');
    expect(html).toContain("Сегодня");
    expect(html).toContain('aria-label="Радиус поиска"');
    expect(html).toContain('class="app-nb-dock"');
  });

  it("отмечает выбранный радиус среди тех же значений, что и настройки", () => {
    const html = viewHtml({ mode: "timeline", radiusKm: 5 });

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(">5 км<");
    expect(html).toContain(">1 км<");
    expect(html).toContain(">3 км<");
    expect(html).toContain(">10 км<");
    expect(html).toContain(">25 км<");
    expect(html).not.toContain("Радиус 5 км");
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

describe("точка на карте", () => {
  it("открывает площадку уже с маршрутом", () => {
    const card = nearbyTimeline(...MOSCOW).evening[0];
    expect(card).toBeDefined();
    if (card === undefined) return;
    expect(nearbyLocationRoute(card.place)).toEqual({
      name: "map",
      pin: { lat: card.place.latitude, lng: card.place.longitude },
      placeId: card.place.id,
      drawRoute: true,
    });
  });

  it("даёт отдельную кнопку маршрута на локации карточки", () => {
    const html = viewHtml({ mode: "timeline" });
    expect(html).toContain("app-nb-grid");
    expect(html).toContain("app-nb-dock");
    expect(html).toContain("Расстояние");
    expect(html).toContain('aria-label="Маршрут до');
  });
});

  describe("фильтр даты и поиска", () => {
  const card = {
    bucket: "evening" as const,
    event: { id: "c1", title: "Летний концерт", startsAt: "2026-09-12T19:00:00+03:00" },
    place: { title: "Пушкинская набережная" },
  };

  it("сегодняшний ключ совпадает с MOCK_NOW", () => {
    expect(moscowDayKey(MOCK_NOW)).toBe("2026-09-12");
    expect(nearbyDayOptions(MOCK_NOW)[0]).toEqual({ key: "2026-09-12", label: "Сегодня" });
    expect(nearbyDayOptions(MOCK_NOW)[1]?.label).toBe("Завтра");
  });

  it("карточку дня оставляет, чужой день — нет", () => {
    expect(cardOnDay(card, "2026-09-12", "2026-09-12")).toBe(true);
    expect(cardOnDay(card, "2026-09-13", "2026-09-12")).toBe(false);
  });

  it("форму слова ловит стеблем и id из assist", () => {
    expect(cardMatchesQuery(card, "концерты", null)).toBe(true);
    expect(cardMatchesQuery(card, "выставка", null)).toBe(false);
    expect(cardMatchesQuery(card, "выставка", new Set(["c1"]))).toBe(true);
  });

  it("открытый поиск рисует поле, а не переход в ассистента", () => {
    const html = viewHtml({ searchOpen: true, query: "парк" });
    expect(html).toContain('aria-label="Поиск рядом"');
    expect(html).not.toContain("MAX AI");
  });
});
