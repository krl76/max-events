// START_MODULE_CONTRACT
// PURPOSE: Catalog subscriptions — follow organizer/place/interest and DM on matching new events.
// SCOPE: CRUD for CurrentUser; matchesSubscription; notifyNewEvent unique users; bot failure does not throw.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, places/users/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - matchesSubscription - place/organizer/interest match against a new event
// - formatSubscriptionNotice - DM body
// - SubscriptionsService - create, list, remove, notifyNewEvent
// END_MODULE_MAP

import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { CreateSubscription, Subscription } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { SubscriptionEntity } from "./subscription.entity";

export type SubscriptionNotifyResult = { sent: number; failed: number };

export type EventMatchInput = {
  title: string;
  description: string;
  category: string;
  placeId: string | null;
  organizerUserId: string | null;
};

export function matchesSubscription(event: EventMatchInput, row: SubscriptionEntity): boolean {
  if (row.type === "place") return row.placeId !== null && row.placeId === event.placeId;
  if (row.type === "organizer") return row.organizerUserId !== null && row.organizerUserId === event.organizerUserId;
  if (!row.interest) return false;
  const needle = row.interest.toLowerCase();
  return `${event.category} ${event.title} ${event.description}`.toLowerCase().includes(needle);
}

export function formatSubscriptionNotice(title: string): string {
  return `Новое событие по подписке: «${title}»`;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(SubscriptionEntity) private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async list(userId: string): Promise<Subscription[]> {
    const rows = await this.subscriptions.find({ where: { userId } });
    return rows.map(toSubscriptionDto);
  }

  async create(userId: string, payload: CreateSubscription): Promise<Subscription> {
    const fields = {
      userId,
      type: payload.type,
      organizerUserId: payload.type === "organizer" ? payload.organizerUserId : null,
      placeId: payload.type === "place" ? payload.placeId : null,
      interest: payload.type === "interest" ? payload.interest : null,
    };
    if (fields.placeId) {
      const place = await this.places.findOneBy({ id: fields.placeId });
      if (!place) throw new NotFoundException("Place not found");
    }
    if (fields.organizerUserId) {
      const organizer = await this.users.findOneBy({ id: fields.organizerUserId });
      if (!organizer) throw new NotFoundException("Organizer not found");
    }
    const existing = (await this.subscriptions.find({ where: { userId } })).find((row) => sameTarget(row, fields));
    if (existing) return toSubscriptionDto(existing);
    const saved = await this.subscriptions.save(this.subscriptions.create(fields));
    return toSubscriptionDto(saved);
  }

  async remove(userId: string, subscriptionId: string): Promise<Subscription> {
    const row = await this.subscriptions.findOneBy({ id: subscriptionId });
    if (!row || row.userId !== userId) throw new NotFoundException("Subscription not found");
    await this.subscriptions.delete({ id: row.id });
    return toSubscriptionDto(row);
  }

  async notifyNewEvent(event: EventEntity): Promise<SubscriptionNotifyResult> {
    const result: SubscriptionNotifyResult = { sent: 0, failed: 0 };
    const rows = await this.subscriptions.find();
    const matchedUserIds = [...new Set(rows.filter((row) => matchesSubscription(event, row)).map((row) => row.userId))];
    if (matchedUserIds.length === 0) return result;
    const users = await this.users.find();
    const text = formatSubscriptionNotice(event.title);
    for (const userId of matchedUserIds) {
      const user = users.find((row) => row.id === userId);
      if (!user) {
        result.failed += 1;
        continue;
      }
      let ok = false;
      try {
        ok = await this.bot.sendMessage(user.maxUserId, text);
      } catch {
        ok = false;
      }
      if (!ok) {
        this.logger.warn(`Subscription notify failed for user ${userId}`);
        result.failed += 1;
        continue;
      }
      result.sent += 1;
    }
    return result;
  }
}

function sameTarget(
  row: SubscriptionEntity,
  fields: { type: SubscriptionEntity["type"]; organizerUserId: string | null; placeId: string | null; interest: string | null },
): boolean {
  if (row.type !== fields.type) return false;
  if (fields.type === "organizer") return row.organizerUserId === fields.organizerUserId;
  if (fields.type === "place") return row.placeId === fields.placeId;
  return (row.interest ?? "").toLowerCase() === (fields.interest ?? "").toLowerCase();
}

export function toSubscriptionDto(row: SubscriptionEntity): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    organizerUserId: row.organizerUserId,
    placeId: row.placeId,
    interest: row.interest,
    createdAt: row.createdAt.toISOString(),
  };
}
