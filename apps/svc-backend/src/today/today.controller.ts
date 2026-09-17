// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the "What to do today?" digest — GET /api/today.
// SCOPE: Optional lat/lng query; CurrentUser identity; 400 on invalid geo.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./today.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TodayController - GET /today
// - parseOrigin - optional latitude/longitude pair
// END_MODULE_MAP

import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import type { TodayResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { TodayService, type GeoOrigin } from "./today.service";

@Controller("today")
export class TodayController {
  constructor(@Inject(TodayService) private readonly today: TodayService) {}

  @Get()
  async digest(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<TodayResponse> {
    return this.today.digest(user.id, new Date(), parseOrigin(query));
  }
}

export function parseOrigin(query: Record<string, string | undefined>): GeoOrigin | null {
  const latRaw = query.lat;
  const lngRaw = query.lng;
  if ((latRaw === undefined || latRaw === "") && (lngRaw === undefined || lngRaw === "")) return null;
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Invalid geo query");
  }
  return { latitude, longitude };
}
