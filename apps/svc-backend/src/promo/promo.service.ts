// START_MODULE_CONTRACT
// PURPOSE: Organizer promocodes, early-access window, and refer-a-friend / special-offer campaigns.
// SCOPE: create/list codes; setBookingOpensAt; redeem inside a booking transaction; list bookings; campaign fulfillments; the referral code a participant can share.
// DEPENDS: typeorm, @max-events/api-contracts, events/bookings
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - toPromoDto - entity to PromoCode
// - PromoService - CRUD, early access, redeem, booking list, campaigns, activeReferral, campaignExistsInTransaction
// - toCampaignDto - entity to PromoCampaign
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, QueryFailedError, Repository } from "typeorm";
import type { CreatePromoCampaignWrite, CreatePromoCodeWrite, OrganizerBookingRow, PromoCampaign, PromoCode } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { UserEntity } from "../users/user.entity";
import { PromoCampaignEntity } from "./promo-campaign.entity";
import { PromoCodeEntity } from "./promo-code.entity";
import { PromoFulfillmentEntity } from "./promo-fulfillment.entity";

@Injectable()
export class PromoService {
  constructor(
    @InjectRepository(PromoCodeEntity) private readonly codes: Repository<PromoCodeEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(PromoCampaignEntity) private readonly campaigns: Repository<PromoCampaignEntity>,
  ) {}

  async create(actorId: string, eventId: string, payload: CreatePromoCodeWrite): Promise<PromoCode> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const code = payload.code.trim().toUpperCase();
    if (!code || code.length > 40) throw new BadRequestException("Invalid promo payload");
    try {
      const saved = await this.codes.save(
        this.codes.create({
          eventId: event.id,
          organizerUserId: actorId,
          code,
          maxRedemptions: payload.maxRedemptions ?? null,
          redeemedCount: 0,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }),
      );
      return toPromoDto(saved);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") throw new ConflictException("Promo code already exists");
      throw error;
    }
  }

  async list(actorId: string, eventId: string): Promise<PromoCode[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.codes.find({ where: { eventId }, order: { createdAt: "ASC" } });
    return rows.map(toPromoDto);
  }

  async setEarlyAccess(actorId: string, eventId: string, bookingOpensAt: Date): Promise<{ bookingOpensAt: string }> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    event.bookingOpensAt = bookingOpensAt;
    await this.events.save(event);
    return { bookingOpensAt: bookingOpensAt.toISOString() };
  }

  async listBookings(actorId: string, eventId: string): Promise<OrganizerBookingRow[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.bookings.find({ where: { eventId }, order: { createdAt: "ASC" } });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventId: row.eventId,
      status: row.status,
      promoCode: row.promoCode ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async redeemInTransaction(manager: EntityManager, event: EventEntity, rawCode: string | undefined, now: Date): Promise<string | null> {
    const opensAt = event.bookingOpensAt;
    const early = opensAt != null && now.getTime() < opensAt.getTime();
    const code = rawCode?.trim().toUpperCase();
    if (!early && !code) return null;
    if (!code) throw new ForbiddenException("Early access requires a promo code");
    const row = await manager.findOne(PromoCodeEntity, { where: { eventId: event.id, code }, lock: { mode: "pessimistic_write" } });
    if (!row) throw new ForbiddenException("Invalid promo code");
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) throw new ForbiddenException("Promo code expired");
    if (row.maxRedemptions !== null && row.redeemedCount >= row.maxRedemptions) throw new ForbiddenException("Promo code exhausted");
    row.redeemedCount += 1;
    await manager.save(PromoCodeEntity, row);
    return code;
  }

  async createCampaign(actorId: string, eventId: string, payload: CreatePromoCampaignWrite): Promise<PromoCampaign> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const code = payload.code.trim().toUpperCase();
    const title = payload.title.trim();
    if (!code || code.length > 40 || !title) throw new BadRequestException("Invalid campaign payload");
    try {
      const saved = await this.campaigns.save(
        this.campaigns.create({
          eventId: event.id,
          organizerUserId: actorId,
          type: payload.type,
          status: "active",
          code,
          title,
          maxFulfillments: payload.maxFulfillments ?? null,
          fulfillmentCount: 0,
          completedAt: null,
        }),
      );
      return toCampaignDto(saved);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") throw new ConflictException("Campaign code already exists");
      throw error;
    }
  }

  async listCampaigns(actorId: string, eventId: string): Promise<PromoCampaign[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.campaigns.find({ where: { eventId }, order: { createdAt: "ASC" } });
    return rows.map(toCampaignDto);
  }

  /**
   * The refer-a-friend code a participant can share for this event. A campaign owns one code for
   * everyone who spreads it — there is no per-user code — so any viewer of a published event gets
   * the same active campaign, and a completed or absent campaign is a 404 rather than an empty box.
   */
  async activeReferral(eventId: string): Promise<PromoCampaign> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const rows = await this.campaigns.find({ where: { eventId, type: "refer_a_friend", status: "active" }, order: { createdAt: "ASC" } });
    const campaign = rows[0];
    if (!campaign) throw new NotFoundException("Referral campaign not found");
    return toCampaignDto(campaign);
  }

  async campaignExistsInTransaction(manager: EntityManager, eventId: string, rawCode: string): Promise<boolean> {
    const code = rawCode.trim().toUpperCase();
    if (!code) return false;
    const campaign = await manager.findOne(PromoCampaignEntity, { where: { eventId, code } });
    return campaign !== null;
  }

  async recordFulfillmentInTransaction(manager: EntityManager, event: EventEntity, userId: string, bookingId: string, rawCode: string | undefined, now: Date): Promise<void> {
    const code = rawCode?.trim().toUpperCase();
    if (!code) return;
    const campaign = await manager.findOne(PromoCampaignEntity, { where: { eventId: event.id, code }, lock: { mode: "pessimistic_write" } });
    if (!campaign) throw new ForbiddenException("Invalid referral code");
    if (campaign.status !== "active") return;
    if (campaign.type === "refer_a_friend") {
      const user = await manager.findOne(UserEntity, { where: { id: userId } });
      if (!user || user.createdAt.getTime() < campaign.createdAt.getTime()) return;
      const prior = await manager.count(BookingEntity, { where: { userId, eventId: event.id, status: "active" } });
      if (prior > 1) return;
    }
    if (campaign.maxFulfillments !== null && campaign.fulfillmentCount >= campaign.maxFulfillments) {
      campaign.status = "completed";
      campaign.completedAt = now;
      await manager.save(PromoCampaignEntity, campaign);
      return;
    }
    try {
      await manager.save(PromoFulfillmentEntity, manager.create(PromoFulfillmentEntity, { campaignId: campaign.id, referredUserId: userId, bookingId }));
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") return;
      throw error;
    }
    campaign.fulfillmentCount += 1;
    if (campaign.maxFulfillments !== null && campaign.fulfillmentCount >= campaign.maxFulfillments) {
      campaign.status = "completed";
      campaign.completedAt = now;
    }
    await manager.save(PromoCampaignEntity, campaign);
  }

  async releaseInTransaction(manager: EntityManager, event: EventEntity, code: string | null): Promise<void> {
    if (!code) return;
    const row = await manager.findOne(PromoCodeEntity, { where: { eventId: event.id, code }, lock: { mode: "pessimistic_write" } });
    if (!row) return;
    row.redeemedCount = Math.max(0, row.redeemedCount - 1);
    await manager.save(PromoCodeEntity, row);
  }

  async releaseFulfillmentInTransaction(manager: EntityManager, bookingId: string): Promise<void> {
    const row = await manager.findOne(PromoFulfillmentEntity, { where: { bookingId }, lock: { mode: "pessimistic_write" } });
    if (!row) return;
    const campaign = await manager.findOne(PromoCampaignEntity, { where: { id: row.campaignId }, lock: { mode: "pessimistic_write" } });
    await manager.delete(PromoFulfillmentEntity, { id: row.id });
    if (!campaign) return;
    campaign.fulfillmentCount = Math.max(0, campaign.fulfillmentCount - 1);
    if (campaign.status === "completed" && (campaign.maxFulfillments === null || campaign.fulfillmentCount < campaign.maxFulfillments)) {
      campaign.status = "active";
      campaign.completedAt = null;
    }
    await manager.save(PromoCampaignEntity, campaign);
  }

  private async requireOwnedEvent(actorId: string, eventId: string): Promise<EventEntity> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (event.organizerUserId !== actorId) throw new ForbiddenException("Not the organizer");
    return event;
  }
}

export function toCampaignDto(row: PromoCampaignEntity): PromoCampaign {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    status: row.status,
    code: row.code,
    title: row.title,
    maxFulfillments: row.maxFulfillments,
    fulfillmentCount: row.fulfillmentCount,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export function toPromoDto(row: PromoCodeEntity): PromoCode {
  return {
    id: row.id,
    eventId: row.eventId,
    code: row.code,
    maxRedemptions: row.maxRedemptions,
    redeemedCount: row.redeemedCount,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
