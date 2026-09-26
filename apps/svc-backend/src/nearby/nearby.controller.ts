// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for nearby timeline and free-window leisure options.
// SCOPE: GET /nearby?latitude&longitude; GET /nearby/free?hours&mood&latitude&longitude.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NearbyController - timeline and leisure
// END_MODULE_MAP

import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { LeisureMoodSchema, type LeisureOption, type NearbyTimeline } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { NearbyService } from "./nearby.service";

@Controller("nearby")
export class NearbyController {
  constructor(@Inject(NearbyService) private readonly nearby: NearbyService) {}

  @Get("free")
  leisure(@CurrentUser() user: UserEntity, @Query("latitude") latitude?: string, @Query("longitude") longitude?: string, @Query("hours") hours?: string, @Query("mood") mood?: string, @Query("radiusKm") radiusKm?: string): Promise<LeisureOption[]> {
    const [lat, lng] = parseCoords(latitude, longitude);
    const parsedHours = Number(hours);
    if (!Number.isInteger(parsedHours) || parsedHours < 1 || parsedHours > 8) throw new BadRequestException("Invalid hours");
    const parsedMood = LeisureMoodSchema.safeParse(mood);
    if (!parsedMood.success) throw new BadRequestException("Invalid mood");
    return this.nearby.leisure(lat, lng, parsedHours, parsedMood.data, user.id, new Date(), parseRadiusKm(radiusKm));
  }

  @Get()
  timeline(@Query("latitude") latitude?: string, @Query("longitude") longitude?: string, @Query("radiusKm") radiusKm?: string): Promise<NearbyTimeline> {
    return this.nearby.timeline(...parseCoords(latitude, longitude), new Date(), parseRadiusKm(radiusKm));
  }
}

function parseCoords(latitude?: string, longitude?: string): [number, number] {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new BadRequestException("Invalid coordinates");
  }
  return [lat, lng];
}

function parseRadiusKm(value?: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) throw new BadRequestException("Invalid radius");
  return parsed;
}
