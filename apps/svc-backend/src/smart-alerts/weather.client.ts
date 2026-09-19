// START_MODULE_CONTRACT
// PURPOSE: Open-Meteo forecast client — precipitation at a lat/lng/hour, never throws.
// SCOPE: precipitationAt returns mm + probability for the UTC hour, or null on HTTP/parse/network failure.
// DEPENDS: none (injectable fetch)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OPEN_METEO_FORECAST_URL - documented forecast host
// - WeatherFetch - injectable GET fetch
// - HourlyPrecip - mm and probability at one hour
// - utcHourKey - YYYY-MM-DDTHH:00 in UTC
// - isRainy - precipitation or high probability
// - WeatherClient - precipitationAt
// END_MODULE_MAP

import { Injectable, Optional } from "@nestjs/common";

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type WeatherFetch = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export type HourlyPrecip = {
  precipitationMm: number;
  precipitationProbability: number;
};

export function utcHourKey(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00`;
}

export function isRainy(hour: HourlyPrecip, probabilityThreshold = 50): boolean {
  return hour.precipitationMm > 0 || hour.precipitationProbability >= probabilityThreshold;
}

@Injectable()
export class WeatherClient {
  constructor(
    @Optional() private readonly baseUrl: string = OPEN_METEO_FORECAST_URL,
    @Optional() private readonly fetchImpl: WeatherFetch = fetch as WeatherFetch,
  ) {}

  async precipitationAt(latitude: number, longitude: number, at: Date): Promise<HourlyPrecip | null> {
    const hour = utcHourKey(at);
    const url = `${this.baseUrl}?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&hourly=precipitation,precipitation_probability&timezone=UTC`;
    try {
      const response = await this.fetchImpl(url);
      if (!response.ok) return null;
      return pickHour(await response.json(), hour);
    } catch {
      return null;
    }
  }
}

function pickHour(body: unknown, hour: string): HourlyPrecip | null {
  if (!body || typeof body !== "object") return null;
  const hourly = (body as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const time = (hourly as { time?: unknown }).time;
  const precipitation = (hourly as { precipitation?: unknown }).precipitation;
  const probability = (hourly as { precipitation_probability?: unknown }).precipitation_probability;
  if (!Array.isArray(time) || !Array.isArray(precipitation)) return null;
  const index = time.findIndex((value) => value === hour);
  if (index < 0) return null;
  const mm = precipitation[index];
  const prob = Array.isArray(probability) ? probability[index] : 0;
  if (typeof mm !== "number" || !Number.isFinite(mm)) return null;
  const chance = typeof prob === "number" && Number.isFinite(prob) ? prob : 0;
  return { precipitationMm: mm, precipitationProbability: chance };
}
