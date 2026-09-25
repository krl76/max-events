// START_MODULE_CONTRACT
// PURPOSE: Open-Meteo forecast client — precipitation and hourly snapshot at a lat/lng/hour, never throws.
// SCOPE: precipitationAt for smart-alerts; forecastAt for event cards (temp + WMO code + rain chance); null on HTTP/parse/network failure.
// DEPENDS: none (injectable fetch)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OPEN_METEO_FORECAST_URL - documented forecast host
// - WeatherFetch - injectable GET fetch
// - HourlyPrecip - mm and probability at one hour
// - HourlyForecast - temp, WMO code, mm and probability at one hour
// - TimedForecast - HourlyForecast plus the UTC instant of that hour
// - utcHourKey - YYYY-MM-DDTHH:00 in UTC
// - isRainy - precipitation or high probability
// - weatherConditionLabel - WMO weathercode -> short ru label
// - WeatherClient - precipitationAt, forecastAt, forecastHours
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

export type HourlyForecast = HourlyPrecip & {
  temperatureC: number;
  conditionCode: number;
};

export type TimedForecast = HourlyForecast & { at: Date };

export function utcHourKey(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00`;
}

export function isRainy(hour: HourlyPrecip, probabilityThreshold = 50): boolean {
  return hour.precipitationMm > 0 || hour.precipitationProbability >= probabilityThreshold;
}

export function weatherConditionLabel(code: number): string {
  if (code === 0 || code === 1) return "ясно";
  if (code === 2) return "облачно";
  if (code === 3) return "пасмурно";
  if (code === 45 || code === 48) return "туман";
  if (code >= 51 && code <= 57) return "морось";
  if (code >= 61 && code <= 67) return "дождь";
  if (code >= 71 && code <= 77) return "снег";
  if (code >= 80 && code <= 82) return "ливень";
  if (code >= 85 && code <= 86) return "снег";
  if (code >= 95) return "гроза";
  return "облачно";
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
      return pickPrecip(await response.json(), hour);
    } catch {
      return null;
    }
  }

  async forecastAt(latitude: number, longitude: number, at: Date): Promise<HourlyForecast | null> {
    const hour = utcHourKey(at);
    const url = `${this.baseUrl}?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&hourly=temperature_2m,weather_code,precipitation,precipitation_probability&timezone=UTC&forecast_days=16`;
    try {
      const response = await this.fetchImpl(url);
      if (!response.ok) return null;
      return pickForecast(await response.json(), hour);
    } catch {
      return null;
    }
  }

  async forecastHours(latitude: number, longitude: number): Promise<TimedForecast[] | null> {
    const url = `${this.baseUrl}?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&hourly=temperature_2m,weather_code,precipitation,precipitation_probability&timezone=UTC&forecast_days=16`;
    try {
      const response = await this.fetchImpl(url);
      if (!response.ok) return null;
      return pickAllForecasts(await response.json());
    } catch {
      return null;
    }
  }
}

function hourlyIndex(body: unknown, hour: string): { hourly: Record<string, unknown>; index: number } | null {
  if (!body || typeof body !== "object") return null;
  const hourly = (body as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const time = (hourly as { time?: unknown }).time;
  if (!Array.isArray(time)) return null;
  const index = time.findIndex((value) => value === hour);
  if (index < 0) return null;
  return { hourly: hourly as Record<string, unknown>, index };
}

function pickPrecip(body: unknown, hour: string): HourlyPrecip | null {
  const found = hourlyIndex(body, hour);
  if (!found) return null;
  const precipitation = found.hourly.precipitation;
  const probability = found.hourly.precipitation_probability;
  if (!Array.isArray(precipitation)) return null;
  const mm = precipitation[found.index];
  const prob = Array.isArray(probability) ? probability[found.index] : 0;
  if (typeof mm !== "number" || !Number.isFinite(mm)) return null;
  const chance = typeof prob === "number" && Number.isFinite(prob) ? Math.round(prob) : 0;
  return { precipitationMm: mm, precipitationProbability: chance };
}

function pickForecast(body: unknown, hour: string): HourlyForecast | null {
  const found = hourlyIndex(body, hour);
  return found ? pickForecastAt(found) : null;
}

function pickForecastAt(found: { hourly: Record<string, unknown>; index: number }): HourlyForecast | null {
  const precipitation = found.hourly.precipitation;
  const probability = found.hourly.precipitation_probability;
  if (!Array.isArray(precipitation)) return null;
  const mm = precipitation[found.index];
  const prob = Array.isArray(probability) ? probability[found.index] : 0;
  if (typeof mm !== "number" || !Number.isFinite(mm)) return null;
  const chance = typeof prob === "number" && Number.isFinite(prob) ? Math.round(prob) : 0;
  const temperatures = found.hourly.temperature_2m;
  const codes = found.hourly.weather_code ?? found.hourly.weathercode;
  if (!Array.isArray(temperatures) || !Array.isArray(codes)) return null;
  const temperatureC = temperatures[found.index];
  const conditionCode = codes[found.index];
  if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC)) return null;
  if (typeof conditionCode !== "number" || !Number.isFinite(conditionCode)) return null;
  return { precipitationMm: mm, precipitationProbability: chance, temperatureC, conditionCode };
}

function pickAllForecasts(body: unknown): TimedForecast[] | null {
  if (!body || typeof body !== "object") return null;
  const hourly = (body as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const time = (hourly as { time?: unknown }).time;
  if (!Array.isArray(time) || time.length === 0) return null;
  const rows: TimedForecast[] = [];
  for (let index = 0; index < time.length; index += 1) {
    const stamp = time[index];
    if (typeof stamp !== "string") continue;
    const forecast = pickForecastAt({ hourly: hourly as Record<string, unknown>, index });
    if (!forecast) continue;
    const at = new Date(`${stamp}:00.000Z`);
    if (Number.isNaN(at.getTime())) continue;
    rows.push({ ...forecast, at });
  }
  return rows.length === 0 ? null : rows;
}
