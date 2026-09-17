// START_MODULE_CONTRACT
// PURPOSE: Leave-now engine — walking time from the user's last check-in to the plan event place, one MAX DM when leaving now arrives ~20 min early.
// SCOPE: tick() for host + confirmed participants; skipped without origin or venue; leaveNowSentAt dedup; notify errors do not abort the loop.
// DEPENDS: typeorm, plans/events/places/users/check-ins, max-bot, ../plans/plans.service haversineMeters
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WALK_M_PER_MIN - walking speed used for travel minutes
// - LEAVE_EARLY_MAX_MIN - max early-arrival window that still triggers «выходи сейчас»
// - LeaveNowTickResult - sent/failed counts
// - walkingMinutes - meters to minutes
// - formatLeaveNowText - DM body with travel and early-arrival
// - shouldLeaveNow - trigger when leaving now arrives 0..LEAVE_EARLY_MAX_MIN early
// - LeaveNowService - tick cycle
// END_MODULE_MAP

import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThan, Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { haversineMeters } from "../plans/plans.service";
import { DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { ProfileEntity } from "../users/profile.entity";
import { readAlertPrefs } from "../users/profiles.service";
import { UserEntity } from "../users/user.entity";

export const WALK_M_PER_MIN = 80;
export const LEAVE_EARLY_MAX_MIN = 30;

export type LeaveNowTickResult = { sent: number; failed: number };

export function walkingMinutes(meters: number): number {
  return Math.max(0, Math.round(meters / WALK_M_PER_MIN));
}

export function shouldLeaveNow(minutesUntilStart: number, travelMinutes: number, earlyMax = LEAVE_EARLY_MAX_MIN): boolean {
  if (travelMinutes <= 0) return false;
  if (minutesUntilStart < travelMinutes) return false;
  return minutesUntilStart - travelMinutes <= earlyMax;
}

export function formatLeaveNowText(title: string, minutesUntilStart: number, travelMinutes: number, earlyMinutes: number): string {
  return `«${title}» через ${minutesUntilStart} мин. До места ${travelMinutes} мин. Если выйти сейчас — будешь за ${earlyMinutes} минут до начала`;
}

@Injectable()
export class LeaveNowService {
  private readonly logger = new Logger(LeaveNowService.name);
  private running = false;

  constructor(
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(PlanParticipantEntity) private readonly participants: Repository<PlanParticipantEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async tick(now = new Date()): Promise<LeaveNowTickResult> {
    if (this.running) return { sent: 0, failed: 0 };
    this.running = true;
    const result: LeaveNowTickResult = { sent: 0, failed: 0 };
    try {
      const upcoming = await this.plans.find({ where: { meetingAt: MoreThan(now) } });
      if (upcoming.length === 0) return result;
      const eventIds = [...new Set(upcoming.map((row) => row.eventId))];
      const planIds = upcoming.map((row) => row.id);
      const [events, participantRows] = await Promise.all([this.events.find({ where: { id: In(eventIds) } }), this.participants.find({ where: { planId: In(planIds) } })]);
      const eventById = new Map(events.map((row) => [row.id, row]));
      const userIds = [...new Set([...upcoming.map((row) => row.hostUserId), ...participantRows.map((row) => row.userId)])];
      const checkIns = userIds.length === 0 ? [] : await this.checkIns.find({ where: { userId: In(userIds) } });
      const profileRows = userIds.length === 0 ? [] : await this.profiles.find({ where: { userId: In(userIds) } });
      const prefsByUser = new Map(profileRows.map((row) => [row.userId, readAlertPrefs(row)]));
      const originEventIds = [...new Set(checkIns.map((row) => row.eventId).filter((id): id is string => id !== null))];
      const originEvents = originEventIds.length === 0 ? [] : await this.events.find({ where: { id: In(originEventIds) } });
      const originEventById = new Map(originEvents.map((row) => [row.id, row]));
      const placeIds = [...new Set([...events.map((row) => row.placeId), ...checkIns.map((row) => row.placeId), ...originEvents.map((row) => row.placeId)].filter((id): id is string => id !== null))];
      const placeRows = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
      const placeById = new Map(placeRows.map((row) => [row.id, row]));
      const userRows = userIds.length === 0 ? [] : await this.users.find({ where: { id: In(userIds) } });
      const userById = new Map(userRows.map((row) => [row.id, row]));
      const latestCheckIn = latestCheckInByUser(checkIns);

      for (const plan of upcoming) {
        const event = eventById.get(plan.eventId);
        if (!event || event.published === false || event.startsAt.getTime() <= now.getTime()) continue;
        const venueId = event.placeId;
        const venue = venueId ? placeById.get(venueId) : undefined;
        if (!venue) continue;
        const minutesUntilStart = Math.round((event.startsAt.getTime() - now.getTime()) / 60_000);
        const recipients: Array<{ userId: string; mark: () => Promise<void> }> = [];
        if (!plan.leaveNowSentAt) {
          recipients.push({
            userId: plan.hostUserId,
            mark: async () => {
              plan.leaveNowSentAt = now;
              await this.plans.save(plan);
            },
          });
        }
        for (const row of participantRows.filter((item) => item.planId === plan.id && item.status === "confirmed" && !item.leaveNowSentAt)) {
          recipients.push({
            userId: row.userId,
            mark: async () => {
              row.leaveNowSentAt = now;
              await this.participants.save(row);
            },
          });
        }
        for (const recipient of recipients) {
          const user = userById.get(recipient.userId);
          if (!user) {
            result.failed += 1;
            continue;
          }
          const prefs = prefsByUser.get(recipient.userId) ?? DEFAULT_SMART_ALERTS;
          if (!prefs.leaveNow) continue;
          const origin = originFromCheckIn(latestCheckIn.get(recipient.userId), originEventById, placeById);
          if (!origin) continue;
          const travel = walkingMinutes(haversineMeters(origin, venue.latitude, venue.longitude));
          if (!shouldLeaveNow(minutesUntilStart, travel)) continue;
          const earlyMinutes = minutesUntilStart - travel;
          const text = formatLeaveNowText(event.title, minutesUntilStart, travel, earlyMinutes);
          try {
            const ok = await this.bot.sendMessage(user.maxUserId, text);
            if (!ok) {
              result.failed += 1;
              continue;
            }
            await recipient.mark();
            result.sent += 1;
          } catch {
            this.logger.warn(`Leave-now DM failed for plan ${plan.id}`);
            result.failed += 1;
          }
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}

function latestCheckInByUser(rows: CheckInEntity[]): Map<string, CheckInEntity> {
  const latest = new Map<string, CheckInEntity>();
  for (const row of rows) {
    const prev = latest.get(row.userId);
    if (!prev || row.checkedInAt.getTime() > prev.checkedInAt.getTime()) latest.set(row.userId, row);
  }
  return latest;
}

function originFromCheckIn(row: CheckInEntity | undefined, events: Map<string, EventEntity>, places: Map<string, PlaceEntity>): { latitude: number; longitude: number } | null {
  if (!row) return null;
  const placeId = row.placeId ?? (row.eventId ? events.get(row.eventId)?.placeId : null);
  const place = placeId ? places.get(placeId) : undefined;
  if (!place) return null;
  return { latitude: place.latitude, longitude: place.longitude };
}
