// START_MODULE_CONTRACT
// PURPOSE: Organizer paid promotion campaigns — period, status, billing stamp; no ranking side effects here.
// SCOPE: create/list/recordPayment; listActive in-window rows; lazy complete when endsAt passes.
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
import { Repository } from "typeorm";
import type { CreatePromotionWrite, PromotionCampaign, PromotionType, RecordPromotionPaymentWrite } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PromotionCampaignEntity } from "./promotion-campaign.entity";

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(PromotionCampaignEntity) private readonly campaigns: Repository<PromotionCampaignEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
  ) {}

  async create(actorId: string, eventId: string, payload: CreatePromotionWrite, now = new Date()): Promise<PromotionCampaign> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (endsAt.getTime() < startsAt.getTime()) throw new BadRequestException("endsAt must not be before startsAt");
    const expired = endsAt.getTime() <= now.getTime();
    const saved = await this.campaigns.save(
      this.campaigns.create({
        eventId: event.id,
        organizerUserId: actorId,
        type: payload.type,
        status: expired ? "completed" : "active",
        startsAt,
        endsAt,
        tariffCode: payload.tariffCode.trim(),
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
    row.paidAt = payload.paidAt ? new Date(payload.paidAt) : now;
    return toPromotionDto(await this.campaigns.save(row));
  }

  async listActive(now = new Date(), type?: PromotionType): Promise<PromotionCampaign[]> {
    const where: { status: "active"; type?: PromotionType } = { status: "active" };
    if (type) where.type = type;
    const rows = await this.campaigns.find({ where, order: { startsAt: "ASC", id: "ASC" } });
    return rows.filter((row) => row.startsAt.getTime() <= now.getTime() && row.endsAt.getTime() > now.getTime()).map(toPromotionDto);
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
