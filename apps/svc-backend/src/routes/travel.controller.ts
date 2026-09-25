// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for walk/metro tiles from the viewer to a map pin.
// SCOPE: GET /travel?placeId=&latitude=&longitude= (lat/lng aliases). 400 on a lone coord; 404 on an unpublished place.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./routes.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TravelController - GET /travel
// - parseTravelQuery - placeId + origin pair or 400
// END_MODULE_MAP

import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { IdSchema, type TravelOption } from "@max-events/api-contracts";
import { RoutesService } from "./routes.service";

@Controller("travel")
export class TravelController {
  constructor(@Inject(RoutesService) private readonly routes: RoutesService) {}

  @Get()
  options(@Query() query: Record<string, string | undefined>): Promise<TravelOption[]> {
    const parsed = parseTravelQuery(query);
    return this.routes.travelToPlace(parsed.placeId, { latitude: parsed.latitude, longitude: parsed.longitude });
  }
}

export function parseTravelQuery(query: Record<string, string | undefined>): { placeId: string; latitude: number; longitude: number } {
  const placeId = IdSchema.safeParse(query.placeId);
  if (!placeId.success) throw new BadRequestException("Invalid travel query");
  const latRaw = nonempty(query.latitude) ?? nonempty(query.lat);
  const lngRaw = nonempty(query.longitude) ?? nonempty(query.lng);
  const hasLat = latRaw !== undefined;
  const hasLng = lngRaw !== undefined;
  if (hasLat !== hasLng || !hasLat || !hasLng) throw new BadRequestException("Invalid travel query");
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Invalid travel query");
  }
  return { placeId: placeId.data, latitude, longitude };
}

function nonempty(value: string | undefined): string | undefined {
  return value !== undefined && value !== "" ? value : undefined;
}
