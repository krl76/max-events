import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Event, Place } from "@max-events/api-contracts";
import { OPEN_METEO_FORECAST_URL, WeatherClient, type WeatherFetch } from "../smart-alerts/weather.client";
import { EventWeatherService, FORECAST_SOURCE } from "./event-weather.service";

const now = new Date("2026-09-12T10:00:00Z");
const startsAt = "2026-09-12T16:30:00.000Z";

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  title: "Джаз в парке",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d70",
  startsAt,
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
  weather: null,
  coverUrl: null,
};

const park: Place = {
  id: event.placeId!,
  title: "Парк Горького",
  address: "Крымский Вал, 9",
  city: "Москва",
  category: "park",
  latitude: 55.7298,
  longitude: 37.6019,
  published: true,
  logoUrl: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<WeatherFetch>> {
  return { ok: status >= 200 && status < 300, json: async () => body };
}

function openMeteoOk(): WeatherFetch {
  return async () =>
    jsonResponse(200, {
      hourly: {
        time: ["2026-09-12T16:00"],
        temperature_2m: [12.4],
        weather_code: [2],
        precipitation: [0],
        precipitation_probability: [40],
      },
    });
}

function createRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
  };
}

function createService(options: { fetchImpl?: WeatherFetch; place?: Place | null; redis?: { store: Map<string, string>; get: (key: string) => Promise<string | null>; set: (key: string, value: string, ...rest: unknown[]) => Promise<unknown> }; placeError?: Error } = {}) {
  const calls: string[] = [];
  const placeCalls: string[] = [];
  const fetchImpl: WeatherFetch = async (url) => {
    calls.push(url);
    return (options.fetchImpl ?? openMeteoOk())(url);
  };
  const weather = new WeatherClient(OPEN_METEO_FORECAST_URL, fetchImpl);
  const places = {
    getById: async (id: string) => {
      placeCalls.push(id);
      if (options.placeError) throw options.placeError;
      if (!options.place || options.place.id !== id) throw new NotFoundException("Place not found");
      return options.place;
    },
    list: async () => (options.place ? [options.place] : []),
  };
  const redis = options.redis ?? createRedis();
  return { service: new EventWeatherService(weather, places, redis), calls, placeCalls, redis };
}

describe("EventWeatherService.attach", () => {
  it("fills weather from Open-Meteo for a future event with coordinates", async () => {
    const { service } = createService({ place: park });
    const [attached] = await service.attach([event], now);
    expect(attached.weather).toEqual({ temperatureC: 12.4, condition: "облачно", conditionCode: 2, precipitationProbability: 40 });
  });

  it("leaves weather null for a past event, missing place, or provider failure", async () => {
    const past = { ...event, startsAt: "2026-09-12T09:00:00.000Z" };
    const { service: pastService, calls: pastCalls } = createService({ place: park });
    expect((await pastService.attach([past], now))[0]?.weather).toBeNull();
    expect(pastCalls).toHaveLength(0);

    const { service: noPlace } = createService({ place: null });
    expect((await noPlace.attach([event], now))[0]?.weather).toBeNull();

    const { service: down } = createService({ place: park, fetchImpl: async () => jsonResponse(503, {}) });
    expect((await down.attach([event], now))[0]?.weather).toBeNull();
  });

  it("reuses the Redis cache for the same hour and coordinates", async () => {
    const redis = createRedis();
    const { service, calls } = createService({ place: park, redis });
    await service.attach([event], now);
    await service.attach([event], now);
    expect(calls).toHaveLength(1);
    expect([...redis.store.keys()][0]).toMatch(/^weather:forecast:55\.73:37\.60:2026-09-12T16:00$/);
  });

  it("caches a provider miss so the next list does not re-fetch", async () => {
    const redis = createRedis();
    const { service, calls } = createService({ place: park, redis, fetchImpl: async () => jsonResponse(503, {}) });
    expect((await service.attach([event], now))[0]?.weather).toBeNull();
    expect((await service.attach([event], now))[0]?.weather).toBeNull();
    expect(calls).toHaveLength(1);
    expect([...redis.store.values()][0]).toBe("null");
  });

  it("returns a snapshot when Redis get or set throws", async () => {
    const getBoom = {
      store: new Map<string, string>(),
      get: async () => {
        throw new Error("redis get");
      },
      set: async () => "OK",
    };
    const { service: fromGet } = createService({ place: park, redis: getBoom });
    expect((await fromGet.attach([event], now))[0]?.weather?.condition).toBe("облачно");

    const setBoom = {
      store: new Map<string, string>(),
      get: async () => null,
      set: async () => {
        throw new Error("redis set");
      },
    };
    const { service: fromSet } = createService({ place: park, redis: setBoom });
    expect((await fromSet.attach([event], now))[0]?.weather?.temperatureC).toBe(12.4);
  });

  it("yields weather null when place lookup throws a non-404 error", async () => {
    const { service } = createService({ place: park, placeError: new Error("places down") });
    await expect(service.attach([event], now)).resolves.toEqual([{ ...event, weather: null }]);
  });

  it("loads a shared place once for two events at the same venue", async () => {
    const other = { ...event, id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8e" };
    const { service, placeCalls, calls } = createService({ place: park });
    const attached = await service.attach([event, other], now);
    expect(placeCalls).toEqual([park.id]);
    expect(calls).toHaveLength(1);
    expect(attached.every((row) => row.weather !== null)).toBe(true);
  });
});

function openMeteoHours(): WeatherFetch {
  return async () =>
    jsonResponse(200, {
      hourly: {
        time: ["2026-09-12T16:00", "2026-09-12T17:00", "2026-09-12T18:00", "2026-09-12T20:00", "2026-09-12T22:00", "2026-09-13T00:00"],
        temperature_2m: [12.4, 12.0, 11.1, 9.0, 8.2, 7.0],
        weather_code: [2, 2, 2, 61, 61, 3],
        precipitation: [0, 0, 0, 1.1, 0.4, 0],
        precipitation_probability: [40, 40, 45, 80, 70, 20],
      },
    });
}

describe("EventWeatherService.hourlyForEvent", () => {
  it("builds the two-hour strip, credits Open-Meteo, and notes the first rain", async () => {
    const { service, calls } = createService({ place: park, fetchImpl: openMeteoHours() });
    const forecast = await service.hourlyForEvent({ ...event, endsAt: "2026-09-12T19:00:00.000Z" }, now);
    expect(forecast.source).toBe(FORECAST_SOURCE);
    expect(forecast.hours.map((hour) => hour.at)).toEqual(["2026-09-12T16:00:00.000Z", "2026-09-12T18:00:00.000Z", "2026-09-12T20:00:00.000Z", "2026-09-12T22:00:00.000Z", "2026-09-13T00:00:00.000Z"]);
    expect(forecast.hours[0]?.withinEvent).toBe(true);
    expect(forecast.hours[2]?.withinEvent).toBe(false);
    expect(forecast.hours[2]?.condition).toBe("дождь");
    expect(forecast.note).toContain("вероятность 80%");
    expect(calls).toHaveLength(1);
  });

  it("returns an empty strip without a place or when the provider is down", async () => {
    const noPlace = createService({ place: null, fetchImpl: openMeteoHours() }).service;
    await expect(noPlace.hourlyForEvent({ ...event, placeId: null }, now)).resolves.toEqual({ source: FORECAST_SOURCE, hours: [], note: null });
    const down = createService({ place: park, fetchImpl: async () => jsonResponse(503, {}) }).service;
    await expect(down.hourlyForEvent(event, now)).resolves.toEqual({ source: FORECAST_SOURCE, hours: [], note: null });
  });
});

describe("EventWeatherService.mapNow and hoursAt", () => {
  it("reports the current hour and the first later change", async () => {
    const { service } = createService({ place: park, fetchImpl: openMeteoHours() });
    const atStart = new Date("2026-09-12T16:10:00Z");
    await expect(service.mapNow(park.latitude, park.longitude, atStart)).resolves.toEqual({
      temperatureC: 12.4,
      condition: "облачно",
      changesAt: "2026-09-12T20:00:00.000Z",
      changesTo: "дождь",
    });
  });

  it("names rain as the coming change while the WMO code is still cloudy", async () => {
    const fetchImpl: WeatherFetch = async () =>
      jsonResponse(200, {
        hourly: {
          time: ["2026-09-12T16:00", "2026-09-12T17:00", "2026-09-12T20:00"],
          temperature_2m: [12.4, 11.8, 9.0],
          weather_code: [2, 2, 61],
          precipitation: [0, 0, 1.1],
          precipitation_probability: [20, 80, 90],
        },
      });
    const { service } = createService({ place: park, fetchImpl });
    await expect(service.mapNow(park.latitude, park.longitude, new Date("2026-09-12T16:10:00Z"))).resolves.toEqual({
      temperatureC: 12.4,
      condition: "облачно",
      changesAt: "2026-09-12T17:00:00.000Z",
      changesTo: "дождь",
    });
  });

  it("filters the series to the asked-for window", async () => {
    const { service } = createService({ place: park, fetchImpl: openMeteoHours() });
    const forecast = await service.hoursAt(park.latitude, park.longitude, new Date("2026-09-12T18:00:00Z"), new Date("2026-09-12T20:00:00Z"), now);
    expect(forecast.hours.map((hour) => hour.at)).toEqual(["2026-09-12T18:00:00.000Z", "2026-09-12T20:00:00.000Z"]);
    expect(forecast.source).toBe(FORECAST_SOURCE);
  });

  it("resolves city coords from a published place", async () => {
    const { service } = createService({ place: park });
    await expect(service.coordsForCity("Москва")).resolves.toEqual({ latitude: park.latitude, longitude: park.longitude });
    await expect(createService({ place: null }).service.coordsForCity("Казань")).resolves.toBeNull();
  });
});
