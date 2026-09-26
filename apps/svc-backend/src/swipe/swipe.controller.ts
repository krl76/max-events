// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the swipe deck of экран 09.
// SCOPE: GET /discover/swipe?category=&latitude=&longitude=; POST /discover/swipe/:placeId { decision } → 204.
// DEPENDS: @nestjs/common, ../auth/auth.guard, ./swipe.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SwipeController - list the deck and record a swipe
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { parseSwipeCategory, parseSwipeDecision, SwipeService, type SwipeCandidate } from "./swipe.service";

@Controller("discover/swipe")
export class SwipeController {
  constructor(@Inject(SwipeService) private readonly swipe: SwipeService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<SwipeCandidate[]> {
    return this.swipe.list(user.id, parseSwipeCategory(query.category), parseOrigin(query));
  }

  @Post(":placeId")
  @HttpCode(204)
  async decide(@CurrentUser() user: UserEntity, @Param("placeId", ParseUUIDPipe) placeId: string, @Body() body: unknown): Promise<void> {
    await this.swipe.decide(user.id, placeId, parseSwipeDecision(body));
  }
}

function parseOrigin(query: Record<string, string | undefined>): { latitude: number; longitude: number } | null {
  const hasLat = query.latitude !== undefined && query.latitude !== "";
  const hasLng = query.longitude !== undefined && query.longitude !== "";
  if (hasLat !== hasLng) throw new BadRequestException("Invalid swipe query");
  if (!hasLat) return null;
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Invalid swipe query");
  }
  return { latitude, longitude };
}
