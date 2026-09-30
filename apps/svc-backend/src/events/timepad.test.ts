import { describe, expect, it } from "vitest";
import { categoryFromTimepad, fetchTimepadCatalog, mapTimepadEvent, TIMEPAD_SOURCE } from "./timepad";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("mapTimepadEvent", () => {
  it("keeps an upcoming Moscow lecture with its clock, place and ticket price", () => {
    const mapped = mapTimepadEvent(
      {
        id: 88,
        name: "  Лекция о городе  ",
        description_short: "Как менялась Москва.",
        starts_at: "2026-10-03T16:00:00+03:00",
        ends_at: "2026-10-03T18:00:00+03:00",
        url: "https://timepad.ru/event/88",
        poster_image: { default_url: "https://timepad.ru/poster/88.jpg" },
        categories: [{ name: "Экскурсии" }],
        location: { city: "Москва", address: "ул. Волхонка, 12", coordinates: [55.7447, 37.605] },
        ticket_types: [{ price: 0 }, { price: 700 }],
      },
      now,
    );

    expect(mapped).toMatchObject({
      externalId: "88",
      title: "Лекция о городе",
      category: "tourism",
      city: "Москва",
      isPaid: true,
      priceRub: 700,
      source: TIMEPAD_SOURCE,
      startsAt: new Date("2026-10-03T13:00:00.000Z"),
      place: { title: "ул. Волхонка, 12", latitude: 55.7447, longitude: 37.605, source: TIMEPAD_SOURCE },
    });
  });

  it("drops a past start and a city we do not import", () => {
    expect(mapTimepadEvent({ id: 1, name: "Вчера", starts_at: "2026-09-01T19:00:00+03:00", location: { city: "Москва" } }, now)).toBeNull();
    expect(mapTimepadEvent({ id: 2, name: "Казань", starts_at: "2026-10-10T19:00:00+03:00", location: { city: "Казань" } }, now)).toBeNull();
  });

  it("reads sport and volunteering from category names", () => {
    expect(categoryFromTimepad(["Йога"])).toBe("sport");
    expect(categoryFromTimepad(["Благотворительность"])).toBe("volunteering");
    expect(categoryFromTimepad(["Концерт"])).toBe("afisha");
  });
});

describe("fetchTimepadCatalog", () => {
  it("returns an incomplete empty catalog when TimePad asks for a token", async () => {
    const catalog = await fetchTimepadCatalog(now, (async () => new Response(JSON.stringify({ message: "Запрос требует указание токена" }), { status: 403 })) as typeof fetch);

    expect(catalog).toEqual({ events: [], cities: ["Москва", "Санкт-Петербург"], complete: false, source: TIMEPAD_SOURCE });
  });

  it("maps a public page when TimePad answers", async () => {
    const catalog = await fetchTimepadCatalog(
      now,
      (async () =>
        new Response(
          JSON.stringify({
            values: [
              {
                id: 5,
                name: "Концерт",
                starts_at: "2026-10-05T19:00:00+03:00",
                location: { city: "Санкт-Петербург", address: "Дворцовая, 2", coordinates: [59.94, 30.31] },
                ticket_types: [],
              },
            ],
          }),
          { status: 200 },
        )) as typeof fetch,
    );

    expect(catalog.complete).toBe(true);
    expect(catalog.events).toHaveLength(1);
    expect(catalog.events[0]).toMatchObject({ title: "Концерт", city: "Санкт-Петербург", isPaid: false, source: TIMEPAD_SOURCE });
  });
});
