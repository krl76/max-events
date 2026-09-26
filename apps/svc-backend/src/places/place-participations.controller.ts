// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for place-level social status.
// SCOPE: PUT /places/:placeId/participation; body { status } including null to clear; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./place-participations.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceParticipationsController - PUT /places/:placeId/participation
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Inject, Param, ParseUUIDPipe, Put } from "@nestjs/common";
import { PlaceParticipationWriteSchema, type PlaceParticipation } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { PlaceParticipationsService } from "./place-participations.service";

@Controller("places/:placeId/participation")
export class PlaceParticipationsController {
  constructor(@Inject(PlaceParticipationsService) private readonly participations: PlaceParticipationsService) {}

  @Put()
  async set(@CurrentUser() user: UserEntity, @Param("placeId", ParseUUIDPipe) placeId: string, @Body() body: unknown): Promise<PlaceParticipation> {
    const parsed = PlaceParticipationWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid participation payload");
    return this.participations.set(user.id, placeId, parsed.data.status);
  }
}
