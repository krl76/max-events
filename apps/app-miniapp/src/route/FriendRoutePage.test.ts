import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FriendRouteScreen } from "../api/client";
import { accusativeName, firstName, genitiveName, routeDayLabel, routeStopMeta, routeStopsLine, FriendRouteView, type FriendRouteState } from "./FriendRoutePage";
import { friendRoute, mockFriendIds, mockFriends } from "../api/mock";

const noop = () => {};

const mock = friendRoute(mockFriendIds[0]) as Exclude<ReturnType<typeof friendRoute>, string>;
const route: FriendRouteScreen = { friend: mock.friend, stops: mock.stops };

const view = (state: FriendRouteState, friend = mockFriends[0]) => renderToStaticMarkup(createElement(FriendRouteView, { state, friend, onBack: noop, onOpenPlace: noop, onRepeatAsPlan: noop, onInvite: noop, onRetry: noop }));

describe("name forms", () => {
  it("takes the first name off a full one", () => {
    expect(firstName("Анна Кравцова")).toBe("Анна");
    expect(firstName("Олег")).toBe("Олег");
  });

  it("declines the title into the genitive, «Маршрут Анны»", () => {
    expect(genitiveName("Анна Кравцова")).toBe("Анны");
    expect(genitiveName("Олег Демидов")).toBe("Олега");
    expect(genitiveName("Дмитрий Орлов")).toBe("Дмитрия");
    expect(genitiveName("Мария Белова")).toBe("Марии");
    expect(genitiveName("Катя")).toBe("Кати");
    expect(genitiveName("Саша")).toBe("Саши");
    expect(genitiveName("Игорь")).toBe("Игоря");
  });

  it("uses the accusative for «Позвать … на событие»", () => {
    expect(accusativeName("Олег Демидов")).toBe("Олега");
    expect(accusativeName("Анна Кравцова")).toBe("Анну");
    expect(accusativeName("Мария Белова")).toBe("Марию");
  });

  it("moves the stem of a name that does not keep it, «Пётр» -> «Петра»", () => {
    expect(genitiveName("Пётр Новиков")).toBe("Петра");
    expect(accusativeName("Пётр Новиков")).toBe("Петра");
    expect(genitiveName("Павел Ефимов")).toBe("Павла");
    expect(genitiveName("Лев")).toBe("Льва");
    // «Фёдор» ударение не двигает: общего правила «ё -> е» здесь быть не должно.
    expect(genitiveName("Фёдор Кузьмин")).toBe("Фёдора");
  });

  it("leaves a name the rules do not cover alone rather than inventing a form", () => {
    expect(genitiveName("Ли")).toBe("Ли");
    expect(accusativeName("Ли")).toBe("Ли");
  });
});

describe("route meta", () => {
  it("names the day of the first stop the way the design does", () => {
    expect(routeDayLabel("2026-09-12T11:20:00+03:00")).toMatch(/^[А-ЯЁ][а-яё]+, \d{1,2} \S+$/);
  });

  it("has no day to name without a clock on the stops", () => {
    expect(routeDayLabel(null)).toBeNull();
    expect(routeDayLabel("не дата")).toBeNull();
  });

  it("joins the time and the note, and keeps whichever half it has", () => {
    expect(routeStopMeta("2026-09-12T11:20:00+03:00", "завтрак")).toMatch(/^\d{2}:\d{2} · завтрак$/);
    expect(routeStopMeta(null, "завтрак")).toBe("завтрак");
    expect(routeStopMeta(null, null)).toBeNull();
  });

  it("puts the day before the number of stops under the friend name", () => {
    expect(routeStopsLine(route)).toContain(`${route.stops.length} мест`);
    expect(routeStopsLine({ friend: route.friend, stops: [] })).toBe("0 мест");
  });
});

describe("FriendRouteView", () => {
  it("declines the title and lists the stops in order with their clock and note", () => {
    const html = view({ status: "ready", route });

    expect(html).toContain(`Маршрут ${genitiveName(route.friend.name)}`);
    expect(html).toContain(route.friend.name);
    expect(html).toContain(route.stops[0].place.title);
    expect(html).toContain(routeStopMeta(route.stops[0].visitedAt, route.stops[0].note)!);
    expect(html).toContain("В список");
    expect(html).toContain("Повторить маршрут как план");
  });

  it("numbers the stops from one and closes the rail on the last of them", () => {
    const html = view({ status: "ready", route });

    expect(html).toContain(">1<");
    expect(html).toContain(`>${route.stops.length}<`);
    expect([...html.matchAll(/app-froute-stop--last/g)].length).toBeGreaterThan(0);
  });

  it("offers nothing to repeat when the viewer has already seen every stop", () => {
    const html = view({ status: "ready", route: { friend: route.friend, stops: [] } });

    expect(html).toContain("Все места из этого маршрута ты уже видел.");
    expect(html).not.toContain("Повторить маршрут как план");
  });

  it("treats a closed route as a state of the screen, not as an error", () => {
    const html = view({ status: "closed" }, mockFriends[3]);

    expect(html).toContain(`${firstName(mockFriends[3].name)} не показывает свои маршруты`);
    expect(html).toContain("Это его настройка приватности, а не ошибка.");
    expect(html).toContain(`Позвать ${accusativeName(mockFriends[3].name)} на событие`);
    expect(html).not.toContain("Не удалось загрузить маршрут.");
  });

  it("renders loading and error states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось загрузить маршрут.");
  });
});
