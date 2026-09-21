// START_MODULE_CONTRACT
// PURPOSE: Attach Open-Meteo EventWeather snapshots to catalog/detail Event DTOs.
// SCOPE: Future events with place coordinates; Redis cache per rounded lat/lng + UTC hour; provider/place failures stay null.
// DEPENDS: @max-events/api-contracts, ../smart-alerts/weather.client, ../places/places.service, ../redis/redis.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEATHER_CACHE_TTL_SECONDS - Redis TTL for a successful hourly snapshot
// - WEATHER_MISS_TTL_SECONDS - shorter TTL for cached provider/out-of-range misses
// - EventWeatherService.attach - fill weather on a batch of Event DTOs; Redis/provider failures stay null
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { EventWeatherSchema, type Event, type EventWeather, type Place } from "@max-events/api-contracts";
import { REDIS_CLIENT } from "../redis/redis.module";
import { PlacesService } from "../places/places.service";
import { utcHourKey, weatherConditionLabel, WeatherClient, type HourlyForecast } from "../smart-alerts/weather.client";

export const WEATHER_CACHE_TTL_SECONDS = 3600;
export const WEATHER_MISS_TTL_SECONDS = 300;

type WeatherCache = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...rest: unknown[]) => Promise<unknown>;
};

type PlaceLookup = {
  getById: (id: string) => Promise<Place>;
};

@Injectable()
export class EventWeatherService {
  constructor(
    private readonly weather: WeatherClient,
    @Inject(PlacesService) private readonly places: PlaceLookup,
    @Inject(REDIS_CLIENT) private readonly redis: WeatherCache,
  ) {}

  async attach(events: Event[], now = new Date()): Promise<Event[]> {
    const placeIds = [...new Set(events.map((event) => event.placeId).filter((id): id is string => id !== null))];
    const places = new Map<string, Place>();
    await Promise.all(
      placeIds.map(async (id) => {
        try {
          places.set(id, await this.places.getById(id));
        } catch {
          // unpublished, missing, or places outage → that event stays weather:null
        }
      }),
    );

    const inflight = new Map<string, Promise<EventWeather | null>>();
    const load = (key: string, latitude: number, longitude: number, at: Date) => {
      const pending = inflight.get(key);
      if (pending) return pending;
      const next = this.loadSnapshot(key, latitude, longitude, at);
      inflight.set(key, next);
      return next;
    };

    return Promise.all(
      events.map(async (event) => {
        try {
          if (Date.parse(event.startsAt) <= now.getTime() || !event.placeId) return { ...event, weather: null };
          const place = places.get(event.placeId);
          if (!place) return { ...event, weather: null };
          const at = new Date(event.startsAt);
          return { ...event, weather: await load(cacheKey(place.latitude, place.longitude, at), place.latitude, place.longitude, at) };
        } catch {
          return { ...event, weather: null };
        }
      }),
    );
  }

  private async loadSnapshot(key: string, latitude: number, longitude: number, at: Date): Promise<EventWeather | null> {
    const cached = await readCache(this.redis, key);
    if (cached.hit) return cached.value;
    const forecast = await this.weather.forecastAt(latitude, longitude, at);
    const snapshot = forecast ? toSnapshot(forecast) : null;
    await writeCache(this.redis, key, snapshot, snapshot ? WEATHER_CACHE_TTL_SECONDS : WEATHER_MISS_TTL_SECONDS);
    return snapshot;
  }
}

function cacheKey(latitude: number, longitude: number, at: Date): string {
  return `weather:forecast:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${utcHourKey(at)}`;
}

type CacheRead = { hit: true; value: EventWeather | null } | { hit: false };

async function readCache(redis: WeatherCache, key: string): Promise<CacheRead> {
  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) return { hit: false };
    if (raw === "null") return { hit: true, value: null };
    const parsed = EventWeatherSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { hit: true, value: parsed.data } : { hit: false };
  } catch {
    return { hit: false };
  }
}

async function writeCache(redis: WeatherCache, key: string, value: EventWeather | null, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value === null ? "null" : JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // catalog must not 500 because the cache backend blipped
  }
}

function toSnapshot(forecast: HourlyForecast): EventWeather {
  return {
    temperatureC: forecast.temperatureC,
    condition: weatherConditionLabel(forecast.conditionCode),
    conditionCode: forecast.conditionCode,
    precipitationProbability: Math.min(100, Math.max(0, forecast.precipitationProbability)),
  };
}
