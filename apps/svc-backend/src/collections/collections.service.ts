// START_MODULE_CONTRACT
// PURPOSE: Shared collections — coauthors add events into three sections and share the collection into a MAX chat.
// SCOPE: create, addMember, addItem, get, listForUser, share (MaxBotClient.createChat).
// DEPENDS: typeorm, @max-events/api-contracts, events/users/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CollectionsService - membership-gated CRUD and chat share
// END_MODULE_MAP

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AddCollectionItemWrite, CollectionScreen } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { CollectionEntity, CollectionItemEntity, CollectionMemberEntity } from "./collection.entity";

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(CollectionEntity) private readonly collections: Repository<CollectionEntity>,
    @InjectRepository(CollectionMemberEntity) private readonly members: Repository<CollectionMemberEntity>,
    @InjectRepository(CollectionItemEntity) private readonly items: Repository<CollectionItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(ownerUserId: string, title: string): Promise<CollectionScreen> {
    const saved = await this.collections.save(this.collections.create({ ownerUserId, title, chatLink: null }));
    await this.members.save(this.members.create({ collectionId: saved.id, userId: ownerUserId }));
    return this.get(ownerUserId, saved.id);
  }

  async listForUser(userId: string): Promise<CollectionScreen[]> {
    const memberships = await this.members.find({ where: { userId } });
    const screens = [];
    for (const row of memberships) screens.push(await this.get(userId, row.collectionId));
    return screens;
  }

  async addMember(actorId: string, collectionId: string, userId: string): Promise<CollectionScreen> {
    const collection = await this.requireMember(actorId, collectionId);
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    const existing = await this.members.findOneBy({ collectionId, userId });
    if (!existing) await this.members.save(this.members.create({ collectionId, userId }));
    return this.get(actorId, collection.id);
  }

  async addItem(actorId: string, collectionId: string, payload: AddCollectionItemWrite): Promise<CollectionScreen> {
    await this.requireMember(actorId, collectionId);
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event) throw new NotFoundException("Event not found");
    const existing = await this.items.findOneBy({ collectionId, eventId: payload.eventId });
    if (!existing) {
      await this.items.save(this.items.create({ collectionId, eventId: payload.eventId, section: payload.section, addedByUserId: actorId }));
    }
    return this.get(actorId, collectionId);
  }

  async share(actorId: string, collectionId: string): Promise<CollectionScreen> {
    const collection = await this.requireMember(actorId, collectionId);
    const chat = await this.bot.createChat(collection.title);
    collection.chatLink = chat?.link ?? collection.chatLink;
    await this.collections.save(collection);
    return this.get(actorId, collectionId);
  }

  async get(actorId: string, collectionId: string): Promise<CollectionScreen> {
    const collection = await this.requireMember(actorId, collectionId);
    const memberRows = await this.members.find({ where: { collectionId } });
    const itemRows = await this.items.find({ where: { collectionId } });
    const members = [];
    for (const row of memberRows) {
      const user = await this.users.findOneBy({ id: row.userId });
      if (user) members.push(toFriendDto(user));
    }
    const events = await this.events.find();
    const eventById = new Map(events.map((row) => [row.id, row]));
    const items = [];
    for (const row of itemRows) {
      const event = eventById.get(row.eventId);
      const adder = await this.users.findOneBy({ id: row.addedByUserId });
      if (!event || !adder) continue;
      items.push({
        id: row.id,
        collectionId,
        eventId: row.eventId,
        section: row.section,
        addedBy: toFriendDto(adder),
        addedAt: row.addedAt.toISOString(),
        event: toEventDto(event),
      });
    }
    return {
      collection: {
        id: collection.id,
        ownerUserId: collection.ownerUserId,
        title: collection.title,
        chatLink: collection.chatLink,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      },
      members,
      items,
    };
  }

  private async requireMember(userId: string, collectionId: string): Promise<CollectionEntity> {
    const collection = await this.collections.findOneBy({ id: collectionId });
    if (!collection) throw new NotFoundException("Collection not found");
    const member = await this.members.findOneBy({ collectionId, userId });
    if (!member) throw new ForbiddenException("Not a collection member");
    return collection;
  }
}
