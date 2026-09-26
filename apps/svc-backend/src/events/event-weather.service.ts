// START_MODULE_CONTRACT
// PURPOSE: Attach Open-Meteo EventWeather snapshots to catalog/detail Event DTOs and serve hourly/map reads.
// SCOPE: Future events with place coordinates; Redis cache per rounded lat/lng + UTC hour; hourly strip and map-now from the same Open-Meteo series; provider/place failures stay null.
// DEPENDS: @max-events/api-contracts, ../smart-alerts/weather.client, ../places/places.service, ../redis/redis.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEATHER_CACHE_TTL_SECONDS - Redis TTL for a successful hourly snapshot
// - WEATHER_MISS_TTL_SECONDS - shorter TTL for cached provider/out-of-range misses
// - FORECAST_SOURCE - Open-Meteo; printed on the event page, never a different provider
// - FORECAST_STEP_HOURS - hours between two columns of the strip
// - FORECAST_COLUMNS - how many columns that strip holds
// - HOURLY_MAX_SPAN_MS - widest from->to window the hourly endpoint accepts
// - EventWeatherHour - one column: time, temperature, condition and whether it falls inside the event
// - EventWeatherService - attach snapshots; hourlyForEvent; hoursAt; mapNow
// - EventForecast - HTTP payload of the event strip, matching the miniapp schema
// - MapWeatherNow - HTTP payload of the map chip: now, and what it changes to
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { EventWeatherSchema, type Event, type EventWeather, type Place } from "@max-events/api-contracts";
import { REDIS_CLIENT } from "../redis/redis.module";
import { PlacesService } from "../places/places.service";
import { isRainy, utcHourKey, weatherConditionLabel, WeatherClient, type HourlyForecast, type TimedForecast } from "../smart-alerts/weather.client";

export const WEATHER_CACHE_TTL_SECONDS = 3600;
export const WEATHER_MISS_TTL_SECONDS = 300;
export const FORECAST_SOURCE = "Open-Meteo";
export const FORECAST_STEP_HOURS = 2;
export const FORECAST_COLUMNS = 5;
export const HOURLY_MAX_SPAN_MS = 48 * 60 * 60 * 1000;

export type EventWeatherHour = {
  at: string;
  temperatureC: number;
  conditionCode: number;
  condition: string;
  withinEvent: boolean;
};

export type EventForecast = {
  source: string;
  hours: EventWeatherHour[];
  note: string | null;
};

export type MapWeatherNow = {
  temperatureC: number;
  condition: string;
  changesAt: string | null;
  changesTo: string | null;
};

type WeatherCache = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...rest: unknown[]) => Promise<unknown>;
};

type PlaceLookup = {
  getById: (id: string) => Promise<Place>;
  list: (query: { city?: string; offset: number; limit?: number }) => Promise<Place[]>;
};

@Injectable()
export class EventWeatherService {
  constructor(
    @Inject(WeatherClient) private readonly weather: WeatherClient,
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

  async hourlyForEvent(event: Event, now = new Date()): Promise<EventForecast> {
    const empty: EventForecast = { source: FORECAST_SOURCE, hours: [], note: null };
    if (!event.placeId) return empty;
    const place = await this.placeOrNull(event.placeId);
    if (!place) return empty;
    const series = await this.loadHours(place.latitude, place.longitude, now);
    if (!series) return empty;
    const start = floorHour(new Date(event.startsAt));
    const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const picked: TimedForecast[] = [];
    const hours: EventWeatherHour[] = [];
    for (let index = 0; index < FORECAST_COLUMNS; index += 1) {
      const at = new Date(start.getTime() + index * FORECAST_STEP_HOURS * 60 * 60 * 1000);
      const row = series.find((item) => utcHourKey(item.at) === utcHourKey(at));
      if (!row) continue;
      picked.push(row);
      hours.push(toHour(row, at.getTime() <= end.getTime()));
    }
    return { source: FORECAST_SOURCE, hours, note: rainNote(picked) };
  }

  async hoursAt(latitude: number, longitude: number, from: Date, to: Date, now = new Date()): Promise<EventForecast> {
    const empty: EventForecast = { source: FORECAST_SOURCE, hours: [], note: null };
    const series = await this.loadHours(latitude, longitude, now);
    if (!series) return empty;
    const picked = series.filter((row) => row.at.getTime() >= from.getTime() && row.at.getTime() <= to.getTime());
    return { source: FORECAST_SOURCE, hours: picked.map((row) => toHour(row, true)), note: rainNote(picked) };
  }

  async mapNow(latitude: number, longitude: number, now = new Date()): Promise<MapWeatherNow | null> {
    const series = await this.loadHours(latitude, longitude, now);
    if (!series) return null;
    const currentKey = utcHourKey(now);
    const current = series.find((row) => utcHourKey(row.at) === currentKey) ?? series.find((row) => row.at.getTime() >= now.getTime());
    if (!current) return null;
    const nowLabel = weatherConditionLabel(current.conditionCode);
    const change = series.find((row) => row.at.getTime() > current.at.getTime() && changeToLabel(row) !== nowLabel);
    return {
      temperatureC: current.temperatureC,
      condition: nowLabel,
      changesAt: change ? change.at.toISOString() : null,
      changesTo: change ? changeToLabel(change) : null,
    };
  }

  async coordsForCity(city: string): Promise<{ latitude: number; longitude: number } | null> {
    const [place] = await this.places.list({ city, offset: 0, limit: 1 });
    return place ? { latitude: place.latitude, longitude: place.longitude } : null;
  }

  private async placeOrNull(placeId: string): Promise<Place | null> {
    try {
      return await this.places.getById(placeId);
    } catch {
      return null;
    }
  }

  private async loadHours(latitude: number, longitude: number, now: Date): Promise<TimedForecast[] | null> {
    const key = `weather:hours:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${utcHourKey(now)}`;
    try {
      const raw = await this.redis.get(key);
      if (raw === "null") return null;
      if (raw) {
        const parsed = parseCachedHours(raw);
        if (parsed) return parsed;
      }
    } catch {
      // miss and fetch
    }
    const hours = await this.weather.forecastHours(latitude, longitude);
    try {
      await this.redis.set(key, hours === null ? "null" : JSON.stringify(hours.map((row) => ({ ...row, at: row.at.toISOString() }))), "EX", hours ? WEATHER_CACHE_TTL_SECONDS : WEATHER_MISS_TTL_SECONDS);
    } catch {
      // catalog must not 500 because the cache backend blipped
    }
    return hours;
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

function changeToLabel(row: TimedForecast): string {
  return isRainy(row) ? "дождь" : weatherConditionLabel(row.conditionCode);
}

function floorHour(at: Date): Date {
  return new Date(`${utcHourKey(at)}:00.000Z`);
}

function toHour(row: TimedForecast, withinEvent: boolean): EventWeatherHour {
  return {
    at: row.at.toISOString(),
    temperatureC: row.temperatureC,
    conditionCode: row.conditionCode,
    condition: weatherConditionLabel(row.conditionCode),
    withinEvent,
  };
}

function rainNote(rows: TimedForecast[]): string | null {
  const rainy = rows.find((row) => isRainy(row));
  if (!rainy) return null;
  const time = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(rainy.at);
  return `Дождь с ${time}, вероятность ${rainy.precipitationProbability}%`;
}

function parseCachedHours(raw: string): TimedForecast[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const rows: TimedForecast[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      if (typeof row.at !== "string" || typeof row.temperatureC !== "number" || typeof row.conditionCode !== "number") return null;
      if (typeof row.precipitationMm !== "number" || typeof row.precipitationProbability !== "number") return null;
      const at = new Date(row.at);
      if (Number.isNaN(at.getTime())) return null;
      rows.push({ at, temperatureC: row.temperatureC, conditionCode: row.conditionCode, precipitationMm: row.precipitationMm, precipitationProbability: row.precipitationProbability });
    }
    return rows;
  } catch {
    return null;
  }
}
