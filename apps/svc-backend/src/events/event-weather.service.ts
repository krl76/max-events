// START_MODULE_CONTRACT
// PURPOSE: Attach Open-Meteo EventWeather snapshots to catalog/detail Event DTOs.
// SCOPE: Future events with place coordinates; Redis cache per rounded lat/lng + UTC hour; provider/place failures stay null.
// DEPENDS: @max-events/api-contracts, ../smart-alerts/weather.client, ../places/places.service, ../redis/redis.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEATHER_CACHE_TTL_SECONDS - Redis TTL for a successful hourly snapshot
// - EventWeatherService.attach - fill weather on a batch of Event DTOs
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventWeatherSchema, type Event, type EventWeather, type Place } from "@max-events/api-contracts";
import { REDIS_CLIENT } from "../redis/redis.module";
import { PlacesService } from "../places/places.service";
import { utcHourKey, weatherConditionLabel, WeatherClient, type HourlyForecast } from "../smart-alerts/weather.client";

export const WEATHER_CACHE_TTL_SECONDS = 3600;

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
    return Promise.all(events.map((event) => this.attachOne(event, now)));
  }

  private async attachOne(event: Event, now: Date): Promise<Event> {
    return { ...event, weather: await this.forecastFor(event, now) };
  }

  private async forecastFor(event: Event, now: Date): Promise<EventWeather | null> {
    if (Date.parse(event.startsAt) <= now.getTime()) return null;
    if (!event.placeId) return null;
    let place: Place;
    try {
      place = await this.places.getById(event.placeId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
    const at = new Date(event.startsAt);
    const key = cacheKey(place.latitude, place.longitude, at);
    const cached = await readCache(this.redis, key);
    if (cached) return cached;
    const forecast = await this.weather.forecastAt(place.latitude, place.longitude, at);
    if (!forecast) return null;
    const snapshot = toSnapshot(forecast);
    await this.redis.set(key, JSON.stringify(snapshot), "EX", WEATHER_CACHE_TTL_SECONDS);
    return snapshot;
  }
}

function cacheKey(latitude: number, longitude: number, at: Date): string {
  return `weather:forecast:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${utcHourKey(at)}`;
}

async function readCache(redis: WeatherCache, key: string): Promise<EventWeather | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    const parsed = EventWeatherSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
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
