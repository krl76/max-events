// START_MODULE_CONTRACT
// PURPOSE: Event-tied plans — create/list/get, invite/confirm, MAX chat, meeting-time reminders.
// SCOPE: PlanCard with distance to event place when origin is set; chat/DM best-effort; declined users skipped on remind.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/friends/places/users/max-bot, reminders window helper
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GeoOrigin - lat/lng origin for distance
// - PlanRemindResult - sent/failed counts
// - haversineMeters - distance from origin to a lat/lng
// - formatPlanReminderText - DM body for the meeting
// - formatPlanInviteText - invite DM body
// - PlansService - create, list, get, addParticipant, respond, remove, remindMeeting
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AutoPlanProposal, CreatePlanWrite, Plan, PlanCard, PlanParticipantStatus, Place } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { isInReminderWindow } from "../reminders/reminders.service";
import { UserEntity } from "../users/user.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { PlanEntity } from "./plan.entity";

export type GeoOrigin = { latitude: number; longitude: number };
export type PlanRemindResult = { sent: number; failed: number };

const WALK_M_PER_MIN = 80;
const FOOD_RADIUS_KM = 2;
const MEETUP_BUFFER_MIN = 20;
const DINNER_MIN = 70;

export function haversineMeters(from: GeoOrigin, latitude: number, longitude: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(latitude - from.latitude);
  const dLon = toRad(longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.max(0, Math.round(meters));
}

export function formatPlanReminderText(title: string, meetingPoint: string, meetingAt: Date): string {
  return `Напоминание: сбор «${title}» ${meetingPoint} в ${meetingAt.toISOString()}`;
}

export function formatPlanInviteText(title: string, meetingPoint: string, meetingAt: Date, chatLink: string | null): string {
  const chat = chatLink ? ` Чат: ${chatLink}` : "";
  return `Тебя зовут в план «${title}». Сбор ${meetingAt.toISOString()} ${meetingPoint}.${chat}`;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(PlanParticipantEntity) private readonly participants: Repository<PlanParticipantEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(hostUserId: string, payload: CreatePlanWrite): Promise<PlanCard> {
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event) throw new NotFoundException("Event not found");
    const ids = [...new Set(payload.participantIds)];
    if (ids.includes(hostUserId)) throw new BadRequestException("Invalid plan payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (ids.some((id) => !allowed.has(id))) throw new BadRequestException("Invalid plan payload");
    const saved = await this.plans.save(
      this.plans.create({
        hostUserId,
        eventId: event.id,
        meetingPoint: payload.meetingPoint,
        meetingAt: new Date(payload.meetingAt),
        chatLink: null,
        reminderSentAt: null,
        leaveNowSentAt: null,
        weatherAlertSentAt: null,
        friendLeftBroadcastAt: null,
      }),
    );
    for (const userId of ids) {
      await this.participants.save(this.participants.create({ planId: saved.id, userId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null }));
    }
    try {
      const chat = await this.bot.createChat(`План: ${event.title}`);
      if (chat) {
        saved.chatLink = chat.link;
        await this.plans.save(saved);
      }
    } catch {
      this.logger.warn(`Plan chat create failed for ${saved.id}`);
    }
    const users = await this.users.find();
    for (const userId of ids) {
      const user = users.find((row) => row.id === userId);
      if (!user) continue;
      try {
        await this.bot.sendMessage(user.maxUserId, formatPlanInviteText(event.title, saved.meetingPoint, saved.meetingAt, saved.chatLink));
      } catch {
        this.logger.warn(`Plan invite DM failed for ${saved.id}`);
      }
    }
    return this.toCard(saved, event, null);
  }

  async generateAutoplan(hostUserId: string, eventId: string, origin: GeoOrigin): Promise<AutoPlanProposal> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const venue = event.placeId ? await this.places.findOneBy({ id: event.placeId }) : null;
    const meters = venue ? haversineMeters(origin, venue.latitude, venue.longitude) : 0;
    const travelMinutes = Math.max(0, Math.round(meters / WALK_M_PER_MIN));
    const foodPlaces: Place[] = [];
    if (venue) {
      const all = await this.places.find({ where: { published: true, category: "food" } });
      const ranked = all
        .map((place) => ({ place, km: haversineMeters({ latitude: venue.latitude, longitude: venue.longitude }, place.latitude, place.longitude) / 1000 }))
        .filter((row) => row.km <= FOOD_RADIUS_KM)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      for (const row of ranked) foodPlaces.push(toPlaceDto(row.place));
    }
    const meetupAt = new Date(event.startsAt.getTime() - (travelMinutes + MEETUP_BUFFER_MIN) * 60_000);
    const dinnerAt = new Date(meetupAt.getTime() - DINNER_MIN * 60_000);
    const meetingPoint = foodPlaces[0]?.title ?? venue?.address ?? event.city;
    const card = await this.create(hostUserId, { eventId, participantIds: [], meetingPoint, meetingAt: meetupAt.toISOString() });
    const timeline = [];
    if (foodPlaces[0]) timeline.push({ at: dinnerAt.toISOString(), label: "ужин", detail: foodPlaces[0].title });
    timeline.push({ at: new Date(dinnerAt.getTime() + DINNER_MIN * 60_000).toISOString(), label: "дорога", detail: `${travelMinutes} мин до места` });
    timeline.push({ at: meetupAt.toISOString(), label: "встреча", detail: meetingPoint });
    timeline.push({ at: event.startsAt.toISOString(), label: "событие", detail: event.title });
    return { plan: card, travelMinutes, foodPlaces, timeline };
  }

  async list(userId: string, origin: GeoOrigin | null = null): Promise<PlanCard[]> {
    const all = await this.plans.find();
    const mine = [];
    for (const plan of all) {
      if (await this.canView(userId, plan)) mine.push(plan);
    }
    mine.sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime() || a.id.localeCompare(b.id));
    const cards: PlanCard[] = [];
    for (const plan of mine) {
      const event = await this.events.findOneBy({ id: plan.eventId });
      if (!event) continue;
      cards.push(await this.toCard(plan, event, origin));
    }
    return cards;
  }

  async get(userId: string, planId: string, origin: GeoOrigin | null = null): Promise<PlanCard> {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException("Plan not found");
    if (!(await this.canView(userId, plan))) throw new ForbiddenException("Cannot view another user's plan");
    const event = await this.events.findOneBy({ id: plan.eventId });
    if (!event) throw new NotFoundException("Event not found");
    return this.toCard(plan, event, origin);
  }

  async addParticipant(hostUserId: string, planId: string, userId: string): Promise<PlanCard> {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException("Plan not found");
    if (plan.hostUserId !== hostUserId) throw new ForbiddenException("Cannot edit another user's plan");
    if (userId === hostUserId) throw new BadRequestException("Invalid plan payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (!allowed.has(userId)) throw new BadRequestException("Invalid plan payload");
    const existing = (await this.participants.find({ where: { planId } })).find((row) => row.userId === userId);
    if (!existing) {
      await this.participants.save(this.participants.create({ planId, userId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null }));
    }
    return this.get(hostUserId, planId);
  }

  async respond(userId: string, planId: string, status: "confirmed" | "declined"): Promise<PlanCard> {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException("Plan not found");
    const row = (await this.participants.find({ where: { planId } })).find((item) => item.userId === userId);
    if (!row) throw new ForbiddenException("Cannot respond to this plan");
    row.status = status;
    await this.participants.save(row);
    return this.get(userId, planId);
  }

  async remove(hostUserId: string, planId: string): Promise<void> {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException("Plan not found");
    if (plan.hostUserId !== hostUserId) throw new ForbiddenException("Cannot delete another user's plan");
    const rows = await this.participants.find({ where: { planId } });
    for (const row of rows) await this.participants.delete({ id: row.id });
    await this.plans.delete({ id: planId });
  }

  async remindMeeting(now = new Date()): Promise<PlanRemindResult> {
    const result: PlanRemindResult = { sent: 0, failed: 0 };
    const plans = await this.plans.find();
    const events = await this.events.find();
    const users = await this.users.find();
    const participants = await this.participants.find();
    for (const plan of plans) {
      if (!isInReminderWindow(plan.meetingAt, now)) continue;
      const event = events.find((row) => row.id === plan.eventId);
      if (!event) continue;
      const text = formatPlanReminderText(event.title, plan.meetingPoint, plan.meetingAt);
      const host = users.find((row) => row.id === plan.hostUserId);
      if (host && !plan.reminderSentAt) {
        const sent = await this.dm(host, text, () => {
          plan.reminderSentAt = now;
          return this.plans.save(plan);
        });
        if (sent) result.sent += 1;
        else result.failed += 1;
      }
      for (const row of participants.filter((item) => item.planId === plan.id)) {
        if (row.status === "declined" || row.reminderSentAt) continue;
        const user = users.find((item) => item.id === row.userId);
        if (!user) {
          result.failed += 1;
          continue;
        }
        const sent = await this.dm(user, text, () => {
          row.reminderSentAt = now;
          return this.participants.save(row);
        });
        if (sent) result.sent += 1;
        else result.failed += 1;
      }
    }
    return result;
  }

  private async dm(user: UserEntity, text: string, mark: () => Promise<unknown>): Promise<boolean> {
    let ok = false;
    try {
      ok = await this.bot.sendMessage(user.maxUserId, text);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.logger.warn(`Plan reminder failed for user ${user.id}`);
      return false;
    }
    await mark();
    return true;
  }

  private async canView(userId: string, plan: PlanEntity): Promise<boolean> {
    if (plan.hostUserId === userId) return true;
    const rows = await this.participants.find({ where: { planId: plan.id } });
    return rows.some((row) => row.userId === userId);
  }

  private async toCard(plan: PlanEntity, event: EventEntity, origin: GeoOrigin | null): Promise<PlanCard> {
    const rows = await this.participants.find({ where: { planId: plan.id } });
    const users = await this.users.find();
    const userById = new Map(users.map((row) => [row.id, row]));
    const planDto: Plan = {
      id: plan.id,
      eventId: plan.eventId,
      participants: rows.flatMap((row) => {
        const user = userById.get(row.userId);
        return user ? [{ friend: toFriendDto(user), status: row.status as PlanParticipantStatus }] : [];
      }),
      meetingPoint: plan.meetingPoint,
      meetingAt: plan.meetingAt.toISOString(),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
    let distanceMeters = 0;
    if (origin && event.placeId) {
      const place = await this.places.findOneBy({ id: event.placeId });
      if (place) distanceMeters = haversineMeters(origin, place.latitude, place.longitude);
    }
    return { plan: planDto, event: toEventDto(event), distanceMeters };
  }
}
