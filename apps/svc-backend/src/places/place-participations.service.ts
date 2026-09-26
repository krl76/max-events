// START_MODULE_CONTRACT
// PURPOSE: Viewer social status on a published place — not a slot booking.
// SCOPE: set() writes or clears one row per user+place; unpublished/unknown places 404.
// DEPENDS: typeorm, @max-events/api-contracts, ./places.service, ./place-participation.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceParticipationsService - set status or clear
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ParticipationStatus, PlaceParticipation } from "@max-events/api-contracts";
import { PlaceParticipationEntity } from "./place-participation.entity";
import { PlacesService } from "./places.service";

@Injectable()
export class PlaceParticipationsService {
  constructor(
    @InjectRepository(PlaceParticipationEntity) private readonly rows: Repository<PlaceParticipationEntity>,
    @Inject(PlacesService) private readonly places: PlacesService,
  ) {}

  async set(userId: string, placeId: string, status: ParticipationStatus | null): Promise<PlaceParticipation> {
    await this.places.getById(placeId);
    const existing = await this.rows.findOneBy({ userId, placeId });
    if (status === null) {
      if (existing) await this.rows.remove(existing);
      return { placeId, status: null };
    }
    if (existing) {
      existing.status = status;
      await this.rows.save(existing);
      return { placeId, status };
    }
    await this.rows.save(this.rows.create({ userId, placeId, status }));
    return { placeId, status };
  }
}
