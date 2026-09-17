// START_MODULE_CONTRACT
// PURPOSE: Organizer paid promotion campaigns and their catalog/map/target application.
// SCOPE: create/list/recordPayment; listActive in-window paid published rows; placements and visit-history targeting.
// DEPENDS: typeorm, @max-events/api-contracts, events
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - toPromotionDto - entity to PromotionCampaign
// - PromotionService - CRUD, payment stamp, active window query
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { CreatePromotionWrite, PromotionCampaign, PromotionPlacements, PromotionType, RecordPromotionPaymentWrite, TargetedPromotionsResponse } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { PromotionCampaignEntity } from "./promotion-campaign.entity";

const CATEGORY_RU: Record<string, string> = { afisha: "афиша", volunteering: "волонтёрство", tourism: "туризм", sport: "спорт" };

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(PromotionCampaignEntity) private readonly campaigns: Repository<PromotionCampaignEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
  ) {}

  async create(actorId: string, eventId: string, payload: CreatePromotionWrite, now = new Date()): Promise<PromotionCampaign> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) throw new BadRequestException("endsAt must not be before startsAt");
    if (payload.type === "target_collection" && payload.audience == null) throw new BadRequestException("target_collection requires audience");
    const tariffCode = payload.tariffCode.trim();
    if (!tariffCode) throw new BadRequestException("Invalid promotion payload");
    const expired = endsAt.getTime() <= now.getTime();
    const saved = await this.campaigns.save(
      this.campaigns.create({
        eventId: event.id,
        organizerUserId: actorId,
        type: payload.type,
        status: expired ? "completed" : "active",
        startsAt,
        endsAt,
        tariffCode,
        priceRub: payload.priceRub,
        paidAt: null,
        audience: payload.audience ?? null,
        completedAt: expired ? endsAt : null,
      }),
    );
    return toPromotionDto(saved);
  }

  async list(actorId: string, eventId: string, now = new Date()): Promise<PromotionCampaign[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.campaigns.find({ where: { eventId }, order: { startsAt: "ASC", id: "ASC" } });
    await this.expireOverdue(rows, now);
    return rows.map(toPromotionDto);
  }

  async recordPayment(actorId: string, eventId: string, campaignId: string, payload: RecordPromotionPaymentWrite, now = new Date()): Promise<PromotionCampaign> {
    await this.requireOwnedEvent(actorId, eventId);
    const row = await this.campaigns.findOneBy({ id: campaignId, eventId });
    if (!row) throw new NotFoundException("Promotion campaign not found");
    await this.expireOverdue([row], now);
    row.paidAt = payload.paidAt ? new Date(payload.paidAt) : now;
    return toPromotionDto(await this.campaigns.save(row));
  }

  async listActive(now = new Date(), type?: PromotionType): Promise<PromotionCampaign[]> {
    const where: { status: "active"; type?: PromotionType } = { status: "active" };
    if (type) where.type = type;
    const rows = await this.campaigns.find({ where, order: { startsAt: "ASC", id: "ASC" } });
    await this.expireOverdue(rows, now);
    const inWindow = rows.filter((row) => row.status === "active" && row.paidAt != null && row.startsAt.getTime() <= now.getTime() && row.endsAt.getTime() > now.getTime());
    if (inWindow.length === 0) return [];
    const published = await this.events.find({ where: { id: In(inWindow.map((row) => row.eventId)), published: true } });
    const publishedIds = new Set(published.map((row) => row.id));
    return inWindow.filter((row) => publishedIds.has(row.eventId)).map(toPromotionDto);
  }

  async promotedEventIds(now = new Date()): Promise<Set<string>> {
    const rows = await this.listActive(now);
    return new Set(rows.filter((row) => row.type !== "target_collection").map((row) => row.eventId));
  }

  async pinEventIds(now = new Date()): Promise<Set<string>> {
    return new Set((await this.listActive(now, "pin")).map((row) => row.eventId));
  }

  async placements(now = new Date()): Promise<PromotionPlacements> {
    const active = await this.listActive(now);
    const eventIds = [...new Set(active.map((row) => row.eventId))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds), published: true } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = [...new Set(events.map((row) => row.placeId).filter((id): id is string => id !== null))];
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds), published: true } });
    const placeById = new Map(places.map((row) => [row.id, row]));
    const banners = [];
    const pins = [];
    const boostedEventIds: string[] = [];
    for (const campaign of active) {
      const event = eventById.get(campaign.eventId);
      if (!event) continue;
      const dto = toEventDto(event, true);
      if (campaign.type === "banner") banners.push(dto);
      if (campaign.type === "boost") boostedEventIds.push(event.id);
      if (campaign.type === "pin" && event.placeId) {
        const place = placeById.get(event.placeId);
        if (place) pins.push({ event: dto, place: toPlaceDto(place) });
      }
    }
    return { banners, pins, boostedEventIds };
  }

  async targetedFor(userId: string, now = new Date()): Promise<TargetedPromotionsResponse> {
    const campaigns = await this.listActive(now, "target_collection");
    if (campaigns.length === 0) return { collections: [] };
    const checkIns = await this.checkIns.find({ where: { userId } });
    const visitedIds = [...new Set(checkIns.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const visited = visitedIds.length === 0 ? [] : await this.events.find({ where: { id: In(visitedIds) } });
    const visitedById = new Map(visited.map((row) => [row.id, row]));
    const promotedIds = [...new Set(campaigns.map((row) => row.eventId))];
    const promoted = promotedIds.length === 0 ? [] : await this.events.find({ where: { id: In(promotedIds), published: true } });
    const promotedById = new Map(promoted.map((row) => [row.id, row]));
    const collections = [];
    for (const campaign of campaigns) {
      const audience = campaign.audience;
      const event = promotedById.get(campaign.eventId);
      if (!audience || !event) continue;
      const since = now.getTime() - audience.windowDays * 86_400_000;
      const visits = checkIns.filter((row) => {
        if (!row.eventId || row.checkedInAt.getTime() < since) return false;
        const visitedEvent = visitedById.get(row.eventId);
        if (!visitedEvent) return false;
        return !audience.category || visitedEvent.category === audience.category;
      });
      if (visits.length < audience.minVisits) continue;
      const label = audience.category ? CATEGORY_RU[audience.category] ?? audience.category : "событий";
      collections.push({
        campaign,
        event: toEventDto(event, true),
        explanation: `${visits.length} посещений категории «${label}» за ${audience.windowDays} дней`,
      });
    }
    return { collections };
  }

  private async expireOverdue(rows: PromotionCampaignEntity[], now: Date): Promise<void> {
    for (const row of rows) {
      if (row.status !== "active" || row.endsAt.getTime() > now.getTime()) continue;
      row.status = "completed";
      row.completedAt = row.endsAt;
      await this.campaigns.save(row);
    }
  }

  private async requireOwnedEvent(actorId: string, eventId: string): Promise<EventEntity> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (event.organizerUserId !== actorId) throw new ForbiddenException("Not the organizer");
    return event;
  }
}

export function toPromotionDto(row: PromotionCampaignEntity): PromotionCampaign {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    tariffCode: row.tariffCode,
    priceRub: row.priceRub,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    audience: row.audience,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
