import { describe, expect, it } from "vitest";
import { mockEvents, mockPlaces } from "../api/mock";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { escapeHtml, eventMatchesMapCategory, filterMapEvents, filterMapPlaces, formatDrawnRoute, formatMapChange, formatMapHour, formatMapTemperature, formatTravelOption, MapSelectionCard, mapFriendsLine, mapHourGlyph, mapHourlyWindow, MAP_HOURLY_COLUMNS, mapNotice, mapRainHint, mapWeatherChipText, routeGlyphs, type MapNoticeInput } from "./MapScreen";

const NOTICE: MapNoticeInput = { mapFailed: false, tilesFailed: false, vectorFallback: false, loading: false, placesFailed: false, eventsFailed: false, markerCount: 4, query: "", anyLayerOn: true, geoDenied: false, locateOn: false };

describe("filterMapEvents", () => {
  it("keeps one category and still matches the map search", () => {
    const sport = mockEvents.filter((item) => item.category === "sport");
    expect(sport.length).toBeGreaterThan(0);
    expect(filterMapEvents(mockEvents, "sport", "").every((item) => eventMatchesMapCategory(item, "sport"))).toBe(true);
    expect(filterMapEvents(mockEvents, "sport", "").some((item) => item.category === "sport")).toBe(true);
    expect(filterMapEvents(mockEvents, undefined, "").length).toBe(mockEvents.length);
    const titled = sport[0];
    expect(filterMapEvents(mockEvents, "sport", titled.title.slice(0, 4)).every((item) => eventMatchesMapCategory(item, "sport") && item.title.toLowerCase().includes(titled.title.slice(0, 4).toLowerCase()))).toBe(true);
    expect(filterMapEvents(mockEvents, "volunteering", "этот запрос ничему не равен")).toEqual([]);
    expect(filterMapEvents(mockEvents, undefined, "спортик").every((item) => eventMatchesMapCategory(item, "sport"))).toBe(true);
    const picked = sport[0];
    expect(filterMapEvents(mockEvents, undefined, "что угодно", new Set([picked.id])).map((item) => item.id)).toEqual([picked.id]);
  });

  it("keeps an афиша card whose title is a sport match", () => {
    const football = { ...mockEvents[0], title: "Футбол во дворе", category: "afisha" as const };
    expect(eventMatchesMapCategory(football, "sport")).toBe(true);
    expect(filterMapEvents([football], "sport", "").map((item) => item.id)).toEqual([football.id]);
  });
});

describe("filterMapPlaces", () => {
  it("keeps venues of the matching family on a category chip", () => {
    expect(filterMapPlaces(mockPlaces, undefined, "").length).toBe(mockPlaces.length);
    expect(filterMapPlaces(mockPlaces, "sport", "").map((item) => item.title)).toEqual(["«Лужники»"]);
    expect(filterMapPlaces(mockPlaces, "afisha", "").map((item) => item.category)).toEqual(["museum"]);
    expect(filterMapPlaces(mockPlaces, "tourism", "").map((item) => item.title)).toEqual(["Парк Горького"]);
    expect(filterMapPlaces(mockPlaces, "volunteering", "").every((item) => item.category === "park" || item.category === "other")).toBe(true);
    expect(filterMapPlaces(mockPlaces, "afisha", "парк")).toEqual([]);
    expect(filterMapPlaces(mockPlaces, undefined, "этот запрос ничему не равен")).toEqual([]);
  });
});

describe("mapNotice", () => {
  it("says nothing when the map has objects and everything loaded", () => {
    expect(mapNotice(NOTICE)).toBeNull();
  });

  it("explains an empty map instead of leaving the canvas mute", () => {
    expect(mapNotice({ ...NOTICE, markerCount: 0 })).toBe("Рядом ничего не нашлось.");
    expect(mapNotice({ ...NOTICE, markerCount: 0, loading: true })).toBe("Ищем объекты рядом…");
    expect(mapNotice({ ...NOTICE, markerCount: 0, anyLayerOn: false })).toContain("слои выключены");
    expect(mapNotice({ ...NOTICE, markerCount: 0, query: "  джаз " })).toBe("По запросу «джаз» на карте ничего нет.");
    expect(mapNotice({ ...NOTICE, markerCount: 0, categoryLabel: "Спорт" })).toBe("В категории «Спорт» на карте ничего нет.");
  });

  it("names the broken source rather than blaming the map", () => {
    expect(mapNotice({ ...NOTICE, markerCount: 0, placesFailed: true, eventsFailed: true })).toContain("Карта на месте");
    // Событие без площадки не имеет координат, поэтому одного упавшего запроса хватает, чтобы карта опустела.
    expect(mapNotice({ ...NOTICE, markerCount: 0, placesFailed: true })).toContain("Объекты не загрузились");
    expect(mapNotice({ ...NOTICE, placesFailed: true })).toContain("Часть объектов не загрузилась");
    expect(mapNotice({ ...NOTICE, tilesFailed: true })).toContain("Подложка карты не отвечает");
    // The own basemap fell back to the standard one: the person sees not what they picked, and hears why
    expect(mapNotice({ ...NOTICE, vectorFallback: true })).toBe("Своя подложка здесь не открылась — показана стандартная.");
    // Dead tiles outrank the fallback line: nothing is drawn at all
    expect(mapNotice({ ...NOTICE, tilesFailed: true, vectorFallback: true })).toContain("Подложка карты не отвечает");
    expect(mapNotice({ ...NOTICE, mapFailed: true, markerCount: 0 })).toContain("Карта не загрузилась");
  });

  it("answers «показать, где я» when geolocation was refused", () => {
    expect(mapNotice({ ...NOTICE, geoDenied: true })).toBeNull();
    expect(mapNotice({ ...NOTICE, geoDenied: true, locateOn: true })).toContain("центр города");
  });
});

const WEATHER = { temperatureC: 19, condition: "ясно", changesAt: "2026-09-12T19:00:00+03:00", changesTo: "дождь" };
const WALK = { mode: "walk" as const, minutes: 18, distanceKm: 1.4, transfers: null };
const METRO = { mode: "metro" as const, minutes: 9, distanceKm: 1.4, transfers: 1 };

describe("map chrome formatting", () => {
  it("signs the temperature and names the change that is coming", () => {
    expect(formatMapTemperature(WEATHER)).toBe("+19°");
    expect(formatMapTemperature({ ...WEATHER, temperatureC: -4.4 })).toBe("-4°");
    expect(formatMapChange(WEATHER)).toMatch(/^дождь в \d\d:\d\d$/);
    expect(formatMapChange({ ...WEATHER, changesAt: null, changesTo: null })).toBeNull();
    expect(mapWeatherChipText(WEATHER)).toBe("+19°");
    expect(mapWeatherChipText(null)).toBe("—");
  });

  it("asks for eight hours from the current UTC hour", () => {
    const { from, to } = mapHourlyWindow(new Date("2026-09-21T12:10:00.000Z"));

    expect(from.toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-21T19:00:00.000Z");
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(MAP_HOURLY_COLUMNS - 1);
  });

  it("picks a strip glyph from the WMO code and prints the hour in Russian", () => {
    expect(mapHourGlyph(0)).toBe("sun");
    expect(mapHourGlyph(2)).toBe("weather");
    expect(mapHourGlyph(61)).toBe("rain");
    expect(formatMapHour("2026-09-21T16:00:00.000Z")).toMatch(/^\d\d:\d\d$/);
  });

  it("advises the metro only when there is rain to dodge and a metro to dodge it with", () => {
    expect(mapRainHint(WEATHER, [WALK, METRO])).toMatch(/^Дождь с \d\d:\d\d — метро суше, зонт не понадобится$/);
    expect(mapRainHint(WEATHER, [WALK])).toBeNull();
    expect(mapRainHint({ ...WEATHER, changesTo: "ясно" }, [WALK, METRO])).toBeNull();
    expect(mapRainHint(null, [WALK, METRO])).toBeNull();
  });

  it("splits a travel option into the minutes and the reason under them", () => {
    expect(formatTravelOption(WALK)).toEqual({ value: "18 мин", note: "пешком · 1,4 км" });
    expect(formatTravelOption(METRO)).toEqual({ value: "9 мин", note: "метро · 1 пересадка" });
    expect(formatTravelOption({ ...METRO, transfers: 0 })).toEqual({ value: "9 мин", note: "метро · без пересадок" });
    expect(formatTravelOption({ ...METRO, transfers: 2 })).toEqual({ value: "9 мин", note: "метро · 2 пересадки" });
    expect(formatTravelOption({ mode: "car", minutes: 8, distanceKm: 1.4, transfers: null })).toEqual({ value: "8 мин", note: "на машине · 1,4 км" });
  });

  it("shows walk, walk+metro or car glyphs for the drawn OSM line", () => {
    expect(routeGlyphs("foot")).toEqual(["walk"]);
    expect(routeGlyphs("metro")).toEqual(["walk", "metro"]);
    expect(routeGlyphs("driving")).toEqual(["car"]);
    expect(formatDrawnRoute(12)).toBe("12 мин");
    expect(formatDrawnRoute(60)).toBe("1 ч");
    expect(formatDrawnRoute(104)).toBe("1 ч 44 мин");
  });

  it("prints travel times as information, with one button to build the route", () => {
    const html = renderToStaticMarkup(
      createElement(MapSelectionCard, {
        title: "памятник Георгию Жукову",
        subtitle: "Манежная площадь",
        category: null,
        friendsLine: null,
        travel: [WALK, METRO, { mode: "car", minutes: 8, distanceKm: 1.4, transfers: null }],
        rainHint: null,
        metroSteps: null,
        metroFar: false,
        onRoute: () => {},
        onClose: () => {},
      }),
    );

    expect(html).toContain("18 мин");
    expect(html).toContain("9 мин");
    expect(html).toContain("8 мин");
    expect(html).toContain("Построить маршрут");
    expect(html).not.toContain("Пешком");
    expect(html).not.toContain("На машине");
    expect(html).not.toContain("app-map16-travel-item--on");
  });

  it("names the friends who were at the selected place, in the past tense the layer answers in", () => {
    const place = mockPlaces[0];
    const visit = (names: string[]) => ({ place, friends: names.map((name, index) => ({ id: String(index), name, avatarUrl: null })), lastVisitAt: "2026-09-16T20:00:00+03:00" });

    expect(mapFriendsLine(undefined)).toBeNull();
    expect(mapFriendsLine(visit(["Анна Соколова"]))).toBe("Были здесь: Анна");
    expect(mapFriendsLine(visit(["Анна Соколова", "Дима Кузнецов"]))).toBe("Анна и Дима были здесь");
    expect(mapFriendsLine(visit(["Анна Соколова", "Дима Кузнецов", "Катя Орлова"]))).toBe("Анна, Дима и ещё 1 были здесь");
  });

  it("escapes the venue title before it goes into a divIcon, which takes html and not nodes", () => {
    expect(escapeHtml('<b>"Депо" & Co</b>')).toBe("&lt;b&gt;&quot;Депо&quot; &amp; Co&lt;/b&gt;");
  });
});
