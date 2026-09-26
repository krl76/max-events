// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for current map weather and an hourly series at a point.
// SCOPE: GET /weather (city or lat/lng); GET /weather/hourly (lat/lng + from/to, span capped at 48h).
// DEPENDS: @nestjs/common, ./event-weather.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeatherController - GET /weather and GET /weather/hourly
// END_MODULE_MAP

import { BadRequestException, Controller, Get, Inject, NotFoundException, Query } from "@nestjs/common";
import { TimestampSchema } from "@max-events/api-contracts";
import { EventWeatherService, HOURLY_MAX_SPAN_MS, type EventForecast, type MapWeatherNow } from "./event-weather.service";

@Controller("weather")
export class WeatherController {
  constructor(@Inject(EventWeatherService) private readonly weather: EventWeatherService) {}

  @Get()
  async now(@Query() query: Record<string, string | undefined>): Promise<MapWeatherNow> {
    const point = await this.resolvePoint(query);
    const snapshot = await this.weather.mapNow(point.latitude, point.longitude);
    if (!snapshot) throw new NotFoundException("Weather not found");
    return snapshot;
  }

  @Get("hourly")
  async hourly(@Query() query: Record<string, string | undefined>): Promise<EventForecast> {
    const latitude = parseCoord(query.lat, -90, 90);
    const longitude = parseCoord(query.lng, -180, 180);
    if (latitude === undefined || longitude === undefined) throw new BadRequestException("Invalid weather query");
    const from = parseTimestamp(query.from);
    const to = parseTimestamp(query.to);
    if (!from || !to || to.getTime() <= from.getTime() || to.getTime() - from.getTime() > HOURLY_MAX_SPAN_MS) {
      throw new BadRequestException("Invalid weather query");
    }
    return this.weather.hoursAt(latitude, longitude, from, to);
  }

  private async resolvePoint(query: Record<string, string | undefined>): Promise<{ latitude: number; longitude: number }> {
    const latitude = parseCoord(query.lat, -90, 90);
    const longitude = parseCoord(query.lng, -180, 180);
    const hasLat = query.lat !== undefined && query.lat !== "";
    const hasLng = query.lng !== undefined && query.lng !== "";
    if (hasLat !== hasLng) throw new BadRequestException("Invalid weather query");
    if (hasLat && hasLng) {
      if (latitude === undefined || longitude === undefined) throw new BadRequestException("Invalid weather query");
      return { latitude, longitude };
    }
    const city = query.city?.trim();
    if (!city) throw new BadRequestException("Invalid weather query");
    const coords = await this.weather.coordsForCity(city);
    if (!coords) throw new NotFoundException("Weather not found");
    return coords;
  }
}

function parseCoord(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function parseTimestamp(value: string | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = TimestampSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return new Date(parsed.data);
}
