// START_MODULE_CONTRACT
// PURPOSE: UGC micro-events — minimal create, author auto-joins, capacity-locked join/leave, published immediately.
// SCOPE: list/create/join/leave; every DTO carries its participantIds; unpublished rows are hidden from the public list.
// DEPENDS: typeorm, @max-events/api-contracts, places/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventsService - create/list/join/leave
// - toMicroEventDto - entity plus its participant ids to the MicroEvent contract
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { MicroEventSchema, type CreateMicroEventWrite, type Friend, type MicroEvent } from "@max-events/api-contracts";
import { toFriendDto } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { UsersService } from "../users/users.service";
import { MicroEventEntity, MicroEventParticipantEntity } from "./micro-event.entity";

@Injectable()
export class MicroEventsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MicroEventEntity) private readonly events: Repository<MicroEventEntity>,
    @InjectRepository(MicroEventParticipantEntity) private readonly participants: Repository<MicroEventParticipantEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async list(): Promise<MicroEvent[]> {
    const rows = (await this.events.find({ where: { published: true, status: "open" } })).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    if (rows.length === 0) return [];
    // One batch for the whole page instead of a participant query per row.
    const participants = await this.participants.find({ where: { microEventId: In(rows.map((row) => row.id)) } });
    const byEvent = new Map<string, string[]>();
    for (const row of participants) byEvent.set(row.microEventId, [...(byEvent.get(row.microEventId) ?? []), row.userId]);
    const friends = await this.friendsOf([...new Set(participants.map((row) => row.userId))]);
    return rows.map((row) => toMicroEventDto(row, byEvent.get(row.id) ?? [], friends));
  }

  async create(userId: string, payload: CreateMicroEventWrite): Promise<MicroEvent> {
    await this.users.assertCanPublish(userId);
    if (payload.placeId) {
      const place = await this.places.findOneBy({ id: payload.placeId });
      if (!place) throw new NotFoundException("Place not found");
    }
    const saved = await this.events.save(
      this.events.create({
        authorId: userId,
        title: payload.title,
        startsAt: new Date(payload.startsAt),
        locationText: payload.locationText ?? null,
        placeId: payload.placeId ?? null,
        participantsLimit: payload.participantsLimit,
        status: "open",
        published: true,
      }),
    );
    await this.participants.save(this.participants.create({ microEventId: saved.id, userId }));
    return this.toDto(saved);
  }

  async join(userId: string, id: string): Promise<MicroEvent> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(MicroEventEntity, { where: { id }, lock: { mode: "pessimistic_write" } });
      if (!event || !event.published || event.status !== "open") throw new NotFoundException("Micro-event not found");
      const taken = await manager.find(MicroEventParticipantEntity, { where: { microEventId: id } });
      const ids = taken.map((row) => row.userId);
      if (ids.includes(userId)) return toMicroEventDto(event, ids, await this.friendsOf(ids));
      if (ids.length >= event.participantsLimit) throw new ConflictException("No seats left");
      await manager.save(MicroEventParticipantEntity, manager.create(MicroEventParticipantEntity, { microEventId: id, userId }));
      const next = [...ids, userId];
      return toMicroEventDto(event, next, await this.friendsOf(next));
    });
  }

  async leave(userId: string, id: string): Promise<MicroEvent> {
    const event = await this.events.findOneBy({ id });
    if (!event) throw new NotFoundException("Micro-event not found");
    const existing = await this.participants.findOneBy({ microEventId: id, userId });
    if (!existing) throw new ForbiddenException("Not a participant");
    await this.participants.delete({ id: existing.id });
    return this.toDto(event);
  }

  async unpublish(id: string): Promise<void> {
    const event = await this.events.findOneBy({ id });
    if (!event) throw new NotFoundException("Micro-event not found");
    event.published = false;
    await this.events.save(event);
  }

  private async toDto(row: MicroEventEntity): Promise<MicroEvent> {
    const participants = await this.participants.find({ where: { microEventId: row.id } });
    const ids = participants.map((item) => item.userId);
    return toMicroEventDto(row, ids, await this.friendsOf(ids));
  }

  private async friendsOf(ids: string[]): Promise<Friend[]> {
    const users = await this.users.findByIds(ids);
    return users.map(toFriendDto);
  }
}

export function toMicroEventDto(row: MicroEventEntity, participantIds: string[], friends: Friend[] = []): MicroEvent {
  const ids = [...participantIds].sort();
  const byId = new Map(friends.map((friend) => [friend.id, friend]));
  return MicroEventSchema.parse({
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    locationText: row.locationText,
    placeId: row.placeId,
    participantsLimit: row.participantsLimit,
    participantsCount: ids.length,
    participantIds: ids,
    participants: ids.flatMap((id) => {
      const friend = byId.get(id);
      return friend ? [friend] : [];
    }),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });
}
