// START_MODULE_CONTRACT
// PURPOSE: Persist one participation status per user per event and aggregate per-event counters.
// SCOPE: set/replace, delete, get current user row, stats (six status counts + myStatus + friendsCount from the friend graph).
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../events/event.entity, ../friends/friends.service, ./participation.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ParticipationsService - set/get/remove/stats against ParticipationEntity
// - toParticipationDto - map ParticipationEntity to the api-contracts Participation shape
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Participation, ParticipationCounts, ParticipationStats, ParticipationStatus } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "./participation.entity";

const EMPTY_COUNTS: ParticipationCounts = {
  wants_to_go: 0,
  probably_going: 0,
  going: 0,
  looking_for_company: 0,
  looking_for_travel_buddy: 0,
  looking_for_after_event_company: 0,
};

@Injectable()
export class ParticipationsService {
  constructor(
    @InjectRepository(ParticipationEntity)
    private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async set(userId: string, eventId: string, status: ParticipationStatus): Promise<Participation> {
    await this.assertEvent(eventId);
    const existing = await this.participations.findOneBy({ userId, eventId });
    if (existing) {
      existing.status = status;
      return toParticipationDto(await this.participations.save(existing));
    }
    const saved = await this.participations.save(this.participations.create({ userId, eventId, status }));
    return toParticipationDto(saved);
  }

  async getMine(userId: string, eventId: string): Promise<Participation> {
    await this.assertEvent(eventId);
    const existing = await this.participations.findOneBy({ userId, eventId });
    if (!existing) throw new NotFoundException("Participation not found");
    return toParticipationDto(existing);
  }

  async remove(userId: string, eventId: string): Promise<Participation> {
    await this.assertEvent(eventId);
    const existing = await this.participations.findOneBy({ userId, eventId });
    if (!existing) throw new NotFoundException("Participation not found");
    await this.participations.delete({ id: existing.id });
    return toParticipationDto(existing);
  }

  async stats(userId: string, eventId: string): Promise<ParticipationStats> {
    await this.assertEvent(eventId);
    const rows = await this.participations.find({ where: { eventId } });
    const counts = { ...EMPTY_COUNTS };
    for (const row of rows) counts[row.status] += 1;
    const mine = rows.find((row) => row.userId === userId);
    const friendIds = await this.friends.friendIds(userId);
    const friendsCount = rows.filter((row) => row.userId !== userId && friendIds.has(row.userId)).length;
    return { counts, friendsCount, myStatus: mine?.status ?? null };
  }

  private async assertEvent(eventId: string): Promise<void> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
  }
}

export function toParticipationDto(row: ParticipationEntity): Participation {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

