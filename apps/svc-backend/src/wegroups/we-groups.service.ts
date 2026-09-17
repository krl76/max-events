// START_MODULE_CONTRACT
// PURPOSE: «Мы» trip groups — members, MAX chat, bound events/places, archive to history.
// SCOPE: create with members+chat; addEvent/addPlace; list/get; archive by owner.
// DEPENDS: typeorm, @max-events/api-contracts, events/places/users/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsService - membership-gated group lifecycle
// - toWeGroupDto - entity to WeGroup
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { CreateWeGroupWrite, WeGroup, WeGroupScreen } from "@max-events/api-contracts";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity } from "./we-group.entity";

@Injectable()
export class WeGroupsService {
  constructor(
    @InjectRepository(WeGroupEntity) private readonly groups: Repository<WeGroupEntity>,
    @InjectRepository(WeGroupMemberEntity) private readonly members: Repository<WeGroupMemberEntity>,
    @InjectRepository(WeGroupItemEntity) private readonly items: Repository<WeGroupItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(ownerUserId: string, payload: CreateWeGroupWrite): Promise<WeGroupScreen> {
    const memberIds = [...new Set([ownerUserId, ...payload.memberIds])];
    const users = memberIds.length === 0 ? [] : await this.users.find({ where: { id: In(memberIds) } });
    if (users.length !== memberIds.length) throw new NotFoundException("User not found");
    const saved = await this.groups.save(this.groups.create({ ownerUserId, title: payload.title.trim(), chatLink: null, status: "active", archivedAt: null }));
    for (const userId of memberIds) {
      await this.members.save(this.members.create({ groupId: saved.id, userId }));
    }
    try {
      const chat = await this.bot.createChat(saved.title);
      if (chat) {
        saved.chatLink = chat.link;
        await this.groups.save(saved);
      }
    } catch {
      // Creating the group must not fail because MAX chat sync failed.
    }
    return this.get(ownerUserId, saved.id);
  }

  async listForUser(userId: string): Promise<WeGroupScreen[]> {
    const memberships = await this.members.find({ where: { userId } });
    const groupIds = memberships.map((row) => row.groupId);
    if (groupIds.length === 0) return [];
    const groups = await this.groups.find({ where: { id: In(groupIds) }, order: { createdAt: "DESC", id: "ASC" } });
    return Promise.all(groups.map((group) => this.toScreen(group)));
  }

  async get(actorId: string, groupId: string): Promise<WeGroupScreen> {
    const group = await this.requireMember(actorId, groupId);
    return this.toScreen(group);
  }

  async addEvent(actorId: string, groupId: string, eventId: string): Promise<WeGroupScreen> {
    const group = await this.requireActiveMember(actorId, groupId);
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    try {
      await this.items.save(this.items.create({ groupId: group.id, eventId, placeId: null }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.get(actorId, groupId);
  }

  async addPlace(actorId: string, groupId: string, placeId: string): Promise<WeGroupScreen> {
    const group = await this.requireActiveMember(actorId, groupId);
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    try {
      await this.items.save(this.items.create({ groupId: group.id, eventId: null, placeId }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.get(actorId, groupId);
  }

  async archive(actorId: string, groupId: string, now = new Date()): Promise<WeGroupScreen> {
    const group = await this.requireMember(actorId, groupId);
    if (group.ownerUserId !== actorId) throw new ForbiddenException("Only the owner can archive the group");
    if (group.status === "archived") return this.toScreen(group);
    group.status = "archived";
    group.archivedAt = now;
    await this.groups.save(group);
    return this.toScreen(group);
  }

  private async requireActiveMember(actorId: string, groupId: string): Promise<WeGroupEntity> {
    const group = await this.requireMember(actorId, groupId);
    if (group.status === "archived") throw new ConflictException("Group is archived");
    return group;
  }

  private async requireMember(actorId: string, groupId: string): Promise<WeGroupEntity> {
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException("Group not found");
    const membership = await this.members.findOneBy({ groupId, userId: actorId });
    if (!membership) throw new ForbiddenException("Not a group member");
    return group;
  }

  private async toScreen(group: WeGroupEntity): Promise<WeGroupScreen> {
    const [memberRows, itemRows] = await Promise.all([this.members.find({ where: { groupId: group.id } }), this.items.find({ where: { groupId: group.id } })]);
    const userIds = memberRows.map((row) => row.userId);
    const users = userIds.length === 0 ? [] : await this.users.find({ where: { id: In(userIds) } });
    const userById = new Map(users.map((row) => [row.id, row]));
    const eventIds = itemRows.map((row) => row.eventId).filter((id): id is string => id !== null);
    const placeIds = itemRows.map((row) => row.placeId).filter((id): id is string => id !== null);
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds) } });
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
    return {
      group: toWeGroupDto(group),
      members: memberRows.map((row) => userById.get(row.userId)).filter((row): row is UserEntity => row !== undefined).map(toFriendDto),
      events: events.map((row) => toEventDto(row)),
      places: places.map(toPlaceDto),
    };
  }
}

export function toWeGroupDto(row: WeGroupEntity): WeGroup {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    chatLink: row.chatLink,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}
