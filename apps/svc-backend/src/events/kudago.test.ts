import { describe, expect, it } from "vitest";
import { categoryFromKudago, fetchKudagoCatalog, isKudagoCover, mapKudagoEvent, publicCoverUrl, rubFromKudago } from "./kudago";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("mapKudagoEvent", () => {
  it("keeps an upcoming Moscow concert with its place, price and cover", () => {
    const mapped = mapKudagoEvent(
      {
        id: 42,
        title: "  Джаз в филармонии  ",
        description: "Вечер <b>с оркестром</b>",
        categories: ["concert"],
        is_free: false,
        price: "от 1 500 рублей",
        favorites_count: 80,
        site_url: "https://kudago.com/msk/event/jazz/",
        images: [{ image: "https://media.kudago.com/images/event/ab/jazz.jpg" }],
        dates: [{ start: Math.floor(new Date("2026-10-02T16:00:00.000Z").getTime() / 1000), end: Math.floor(new Date("2026-10-02T19:00:00.000Z").getTime() / 1000) }],
        place: { id: 7, title: "Филармония", address: "ул. Тверская, 1", coords: { lat: 55.76, lon: 37.61 } },
      },
      "Москва",
      now,
    );

    expect(mapped).toMatchObject({
      externalId: "42",
      title: "Джаз в филармонии",
      description: "Вечер с оркестром",
      category: "afisha",
      city: "Москва",
      isPaid: true,
      priceRub: 1500,
      popularity: 80,
      coverUrl: "https://media.kudago.com/images/event/ab/jazz.jpg",
      place: { externalId: "7", title: "Филармония", category: "other", latitude: 55.76, longitude: 37.61 },
    });
  });

  it("drops a showing that has already ended and keeps a future concert with its clock time", () => {
    const ended = mapKudagoEvent({ id: 1, title: "Прошло", dates: [{ start: 1_600_000_000, end: 1_600_000_100 }] }, "Москва", now);
    const open = mapKudagoEvent(
      {
        id: 2,
        title: "Выставка",
        categories: ["exhibition"],
        is_free: true,
        dates: [{ start: Math.floor(new Date("2026-10-10T16:00:00.000Z").getTime() / 1000), end: Math.floor(new Date("2026-10-10T19:00:00.000Z").getTime() / 1000), start_date: "2026-10-10", start_time: "19:00:00" }],
      },
      "Москва",
      now,
    );

    expect(ended).toBeNull();
    expect(open?.startsAt.toISOString()).toBe("2026-10-10T16:00:00.000Z");
    expect(open?.isPaid).toBe(false);
  });

  it("drops a startless exhibition without a schedule instead of stamping the import clock", () => {
    const mapped = mapKudagoEvent({ id: 3, title: "Полотна", categories: ["exhibition", "tour"], is_free: false, price: "", dates: [{ start: -62135433000, end: Math.floor(new Date("2026-10-30T20:00:00.000Z").getTime() / 1000), is_startless: true }] }, "Москва", now);

    expect(categoryFromKudago(["exhibition", "tour"])).toBe("afisha");
    expect(mapped).toBeNull();
  });

  it("uses the next Moscow opening from schedules, not midnight", () => {
    const mapped = mapKudagoEvent(
      {
        id: 4,
        title: "Фестиваль",
        is_free: true,
        dates: [
          {
            start_date: "2026-10-01",
            start_time: null,
            start: Math.floor(new Date("2026-09-30T21:00:00.000Z").getTime() / 1000),
            end_date: "2026-10-10",
            end: Math.floor(new Date("2026-10-10T21:00:00.000Z").getTime() / 1000),
            schedules: [
              { days_of_week: [0, 1, 2, 3, 4], start_time: "11:00:00", end_time: "21:00:00" },
              { days_of_week: [5, 6], start_time: "10:00:00", end_time: "22:00:00" },
            ],
          },
        ],
      },
      "Москва",
      now,
    );

    expect(mapped?.startsAt.toISOString()).toBe("2026-10-01T08:00:00.000Z");
    expect(mapped?.endsAt?.toISOString()).toBe("2026-10-01T18:00:00.000Z");
  });

  it("reads sport and a place-less event", () => {
    expect(categoryFromKudago(["sport"])).toBe("sport");
    const mapped = mapKudagoEvent({ id: 9, title: "Забег", categories: ["sport"], is_free: true, place: null, dates: [{ start: Math.floor(new Date("2026-10-01T08:00:00.000Z").getTime() / 1000), end: null }] }, "Санкт-Петербург", now);
    expect(mapped?.category).toBe("sport");
    expect(mapped?.place).toBeNull();
    expect(mapped?.city).toBe("Санкт-Петербург");
  });

  it("maps social to volunteering and recreation to tourism, keeping concert as афиша", () => {
    expect(categoryFromKudago(["social"])).toBe("volunteering");
    expect(categoryFromKudago(["recreation"])).toBe("tourism");
    expect(categoryFromKudago(["quest"])).toBe("tourism");
    expect(categoryFromKudago(["concert"])).toBe("afisha");
  });
});

describe("kudago covers", () => {
  it("proxies only the KudaGo image host", () => {
    expect(isKudagoCover("https://media.kudago.com/images/event/a.jpg")).toBe(true);
    expect(isKudagoCover("https://evil.example/images/a.jpg")).toBe(false);
    expect(publicCoverUrl("https://media.kudago.com/thumbs/640x384/images/event/a.jpg")).toBe(`/api/media/cover?src=${encodeURIComponent("https://media.kudago.com/thumbs/640x384/images/event/a.jpg")}`);
    expect(publicCoverUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });
});

describe("rubFromKudago", () => {
  it("treats a free flag as free even when the price line is filled", () => {
    expect(rubFromKudago("500 рублей", true)).toEqual({ isPaid: false, priceRub: null });
  });
});

describe("fetchKudagoCatalog", () => {
  it("walks pages for both cities and stops on the last page", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const location = new URL(url).searchParams.get("location");
      const page = new URL(url).searchParams.get("page");
      const body = page === "1" ? { next: "next", results: [{ id: location === "msk" ? 1 : 2, title: location, is_free: true, dates: [{ start: Math.floor(new Date("2026-10-03T18:00:00.000Z").getTime() / 1000) }] }] } : { next: null, results: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const catalog = await fetchKudagoCatalog(now, fetchImpl);

    expect(catalog.complete).toBe(true);
    expect(catalog.events.map((event) => event.city).sort()).toEqual(["Москва", "Санкт-Петербург"]);
    expect(calls.some((url) => url.includes("location=msk"))).toBe(true);
    expect(calls.some((url) => url.includes("location=spb"))).toBe(true);
  });
});
