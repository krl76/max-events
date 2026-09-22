// START_MODULE_CONTRACT
// PURPOSE: Catalog subscriptions — follow organizer/place/interest and DM on matching new events.
// SCOPE: CRUD for CurrentUser; create idempotent per target incl. the 23505 insert race; every returned row carries the target's display title (organization name, place title or the interest); matchesSubscription; notifyNewEvent unique users; bot failure does not throw.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, places/users/organizations/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventMatchInput - event fields used for matching
// - SubscriptionNotifyResult - sent/failed counts
// - toSubscriptionDto - entity plus the resolved target title to the Subscription contract
// - matchesSubscription - place/organizer/interest match against a new event
// - formatSubscriptionNotice - DM body
// - SubscriptionsService - create, list, remove, notifyNewEvent
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { CreateSubscription, Subscription } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { OrganizationsService } from "../organizations/organizations.service";
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
  if (row.type === "user") return row.targetUserId !== null && row.targetUserId === event.organizerUserId;
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
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
  ) {}

  /**
   * Titles are resolved for the whole list at once. Per-row lookups meant 2N+1 queries, and this list
   * is read on every event and place screen — not only on the profile — to answer whether the viewer
   * already follows that one target.
   */
  async list(userId: string): Promise<Subscription[]> {
    const rows = await this.subscriptions.find({ where: { userId }, order: { createdAt: "ASC" } });
    if (rows.length === 0) return [];
    const placeIds = unique(rows.map((row) => row.placeId));
    const organizerIds = unique([...rows.map((row) => row.organizerUserId), ...rows.map((row) => row.targetUserId)]);
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
    const organizerTitles = await this.organizerTitles(organizerIds);
    const placeTitles = new Map(places.map((place) => [place.id, place.title]));
    return rows.map((row) => toSubscriptionDto(row, this.titleOf(row, placeTitles, organizerTitles)));
  }

  /**
   * A subscription list of uuids is unreadable, and the miniapp has no way to resolve an organizer id
   * on its own. The organization name wins over the account name, so the list says what the event page
   * says. A target that vanished keeps a generic label rather than an empty line.
   */
  private titleOf(row: SubscriptionEntity, placeTitles: Map<string, string>, organizerTitles: Map<string, string>): string {
    if (row.type === "interest") return row.interest ?? "Интерес";
    if (row.type === "place") return (row.placeId ? placeTitles.get(row.placeId) : null) ?? "Место";
    if (row.type === "user") return (row.targetUserId ? organizerTitles.get(row.targetUserId) : null) ?? "Пользователь";
    return (row.organizerUserId ? organizerTitles.get(row.organizerUserId) : null) ?? "Организатор";
  }

  private async organizerTitles(organizerIds: string[]): Promise<Map<string, string>> {
    if (organizerIds.length === 0) return new Map();
    const organizations = await this.organizations.findByOrganizerUserIds(organizerIds);
    const titles = new Map(organizations.flatMap((row) => (row.organizerUserId ? [[row.organizerUserId, row.name] as const] : [])));
    const missing = organizerIds.filter((id) => !titles.has(id));
    if (missing.length === 0) return titles;
    // No organization behind the organizer: their own name is the next best thing a reader recognises.
    const users = await this.users.find({ where: { id: In(missing) } });
    for (const user of users) titles.set(user.id, [user.firstName, user.lastName].filter(Boolean).join(" "));
    return titles;
  }

  /** One row, through the same resolvers the list uses. */
  private async withTitle(row: SubscriptionEntity): Promise<Subscription> {
    const places = row.placeId ? await this.places.find({ where: { id: In([row.placeId]) } }) : [];
    const organizerTitles = await this.organizerTitles([row.organizerUserId, row.targetUserId].filter((id): id is string => id !== null));
    return toSubscriptionDto(row, this.titleOf(row, new Map(places.map((place) => [place.id, place.title])), organizerTitles));
  }

  async create(userId: string, payload: CreateSubscription): Promise<Subscription> {
    const fields = {
      userId,
      type: payload.type,
      organizerUserId: payload.type === "organizer" ? payload.organizerUserId : null,
      placeId: payload.type === "place" ? payload.placeId : null,
      targetUserId: payload.type === "user" ? payload.userId : null,
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
    if (fields.targetUserId) {
      if (fields.targetUserId === userId) throw new BadRequestException("Cannot follow yourself");
      const target = await this.users.findOneBy({ id: fields.targetUserId });
      if (!target) throw new NotFoundException("User not found");
    }
    const existing = await this.findSameTarget(userId, fields);
    if (existing) return this.withTitle(existing);
    try {
      return await this.withTitle(await this.subscriptions.save(this.subscriptions.create(fields)));
    } catch (error) {
      // UQ_subscriptions_user_*: a parallel follow tap must read back the winner, not 500.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findSameTarget(userId, fields);
      if (!winner) throw error;
      return this.withTitle(winner);
    }
  }

  private async findSameTarget(userId: string, fields: SubscriptionTarget): Promise<SubscriptionEntity | undefined> {
    return (await this.subscriptions.find({ where: { userId } })).find((row) => sameTarget(row, fields));
  }

  async remove(userId: string, subscriptionId: string): Promise<Subscription> {
    const row = await this.subscriptions.findOneBy({ id: subscriptionId });
    if (!row || row.userId !== userId) throw new NotFoundException("Subscription not found");
    const dto = await this.withTitle(row);
    await this.subscriptions.delete({ id: row.id });
    return dto;
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

type SubscriptionTarget = { type: SubscriptionEntity["type"]; organizerUserId: string | null; placeId: string | null; targetUserId: string | null; interest: string | null };

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

function sameTarget(row: SubscriptionEntity, fields: SubscriptionTarget): boolean {
  if (row.type !== fields.type) return false;
  if (fields.type === "organizer") return row.organizerUserId === fields.organizerUserId;
  if (fields.type === "place") return row.placeId === fields.placeId;
  if (fields.type === "user") return row.targetUserId === fields.targetUserId;
  return (row.interest ?? "").toLowerCase() === (fields.interest ?? "").toLowerCase();
}

export function toSubscriptionDto(row: SubscriptionEntity, title: string): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    organizerUserId: row.organizerUserId,
    placeId: row.placeId,
    targetUserId: row.targetUserId,
    interest: row.interest,
    title,
    createdAt: row.createdAt.toISOString(),
  };
}
