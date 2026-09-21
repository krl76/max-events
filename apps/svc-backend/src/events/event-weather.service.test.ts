import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Event, Place } from "@max-events/api-contracts";
import { OPEN_METEO_FORECAST_URL, WeatherClient, type WeatherFetch } from "../smart-alerts/weather.client";
import { EventWeatherService } from "./event-weather.service";

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

function createService(options: { fetchImpl?: WeatherFetch; place?: Place | null; redis?: ReturnType<typeof createRedis> } = {}) {
  const calls: string[] = [];
  const fetchImpl: WeatherFetch = async (url) => {
    calls.push(url);
    return (options.fetchImpl ?? openMeteoOk())(url);
  };
  const weather = new WeatherClient(OPEN_METEO_FORECAST_URL, fetchImpl);
  const places = {
    getById: async (id: string) => {
      if (!options.place || options.place.id !== id) throw new NotFoundException("Place not found");
      return options.place;
    },
  };
  const redis = options.redis ?? createRedis();
  return { service: new EventWeatherService(weather, places, redis), calls, redis };
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
});
