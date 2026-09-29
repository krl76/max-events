// START_MODULE_CONTRACT
// PURPOSE: Contextual smart alerts — rain before a plan event, and «друг уже вышел» when a confirmed member leaves.
// SCOPE: tick() weather (Open-Meteo, once per plan) and friend-left (leaveNowSentAt or venue check-in) DMs; notify errors do not abort.
// DEPENDS: typeorm, plans/events/places/users/check-ins, max-bot, ./weather.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEATHER_WINDOW_MS - look-ahead for rain alerts
// - SmartAlertTickResult - sent/failed counts
// - formatWeatherAlertText - rain DM body
// - formatFriendLeftText - friend-left DM body
// - SmartAlertsService - tick cycle
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
import { DEFAULT_SMART_ALERTS, type SmartAlertSettings } from "@max-events/api-contracts";
import { ProfileEntity } from "../users/profile.entity";
import { readAlertPrefs } from "../users/profiles.service";
import { UserEntity } from "../users/user.entity";

export const WEATHER_WINDOW_MS = 3 * 60 * 60 * 1000;

export type SmartAlertTickResult = { sent: number; failed: number };

export function formatWeatherAlertText(title: string): string {
  return `«${title}». Похоже, будет дождь. Встречаемся не у входа, а внутри?`;
}

export function formatFriendLeftText(title: string, name: string): string {
  return `«${title}». ${name} уже вышел.`;
}

@Injectable()
export class SmartAlertsService {
  private readonly logger = new Logger(SmartAlertsService.name);
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

  async tick(now = new Date()): Promise<SmartAlertTickResult> {
    if (this.running) return { sent: 0, failed: 0 };
    this.running = true;
    const result: SmartAlertTickResult = { sent: 0, failed: 0 };
    try {
      const upcoming = await this.plans.find({ where: { meetingAt: MoreThan(now) } });
      if (upcoming.length === 0) return result;
      const eventIds = [...new Set(upcoming.map((row) => row.eventId))];
      const planIds = upcoming.map((row) => row.id);
      const [events, participantRows] = await Promise.all([this.events.find({ where: { id: In(eventIds) } }), this.participants.find({ where: { planId: In(planIds) } })]);
      const eventById = new Map(events.map((row) => [row.id, row]));
      const venueIds = [...new Set(events.map((row) => row.placeId).filter((id): id is string => id !== null))];
      const places = venueIds.length === 0 ? [] : await this.places.find({ where: { id: In(venueIds) } });
      const placeById = new Map(places.map((row) => [row.id, row]));
      const userIds = [...new Set([...upcoming.map((row) => row.hostUserId), ...participantRows.map((row) => row.userId)])];
      const [userRows, checkIns] = await Promise.all([userIds.length === 0 ? Promise.resolve([] as UserEntity[]) : this.users.find({ where: { id: In(userIds) } }), userIds.length === 0 ? Promise.resolve([] as CheckInEntity[]) : this.checkIns.find({ where: { userId: In(userIds) } })]);
      const userById = new Map(userRows.map((row) => [row.id, row]));
      const latestCheckIn = latestCheckInByUser(checkIns);
      const profileRows = userIds.length === 0 ? [] : await this.profiles.find({ where: { userId: In(userIds) } });
      const prefsByUser = new Map(profileRows.map((row) => [row.userId, readAlertPrefs(row)]));

      for (const plan of upcoming) {
        const event = eventById.get(plan.eventId);
        if (!event || event.published === false || event.startsAt.getTime() <= now.getTime()) continue;
        const confirmed = participantRows.filter((row) => row.planId === plan.id && row.status === "confirmed");
        const audienceIds = [plan.hostUserId, ...confirmed.map((row) => row.userId)];
        // Rain and «пора выходить» leave from LeaveNowService, so one tick can fold both into a single sentence.
        await this.sendFriendLeft(plan, event, confirmed, audienceIds, userById, latestCheckIn, prefsByUser, now, result);
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async sendFriendLeft(plan: PlanEntity, event: EventEntity, confirmed: PlanParticipantEntity[], audienceIds: string[], userById: Map<string, UserEntity>, latestCheckIn: Map<string, CheckInEntity>, prefsByUser: Map<string, SmartAlertSettings>, now: Date, result: SmartAlertTickResult): Promise<void> {
    const leavers: Array<{ userId: string; mark: () => Promise<void> }> = [];
    if (!plan.friendLeftBroadcastAt && hasLeft(plan.leaveNowSentAt, event, latestCheckIn.get(plan.hostUserId))) {
      leavers.push({
        userId: plan.hostUserId,
        mark: async () => {
          plan.friendLeftBroadcastAt = now;
          await this.plans.save(plan);
        },
      });
    }
    for (const row of confirmed) {
      if (row.friendLeftBroadcastAt) continue;
      if (!hasLeft(row.leaveNowSentAt, event, latestCheckIn.get(row.userId))) continue;
      leavers.push({
        userId: row.userId,
        mark: async () => {
          row.friendLeftBroadcastAt = now;
          await this.participants.save(row);
        },
      });
    }
    for (const leaver of leavers) {
      const leaverUser = userById.get(leaver.userId);
      if (!leaverUser) {
        result.failed += 1;
        continue;
      }
      const name = leaverUser.lastName ? `${leaverUser.firstName} ${leaverUser.lastName}` : leaverUser.firstName;
      const text = formatFriendLeftText(event.title, name);
      const others = audienceIds.filter((id) => id !== leaver.userId && (prefsByUser.get(id) ?? DEFAULT_SMART_ALERTS).friendLeft);
      if (others.length === 0) {
        await leaver.mark();
        continue;
      }
      let delivered = 0;
      for (const userId of others) {
        const user = userById.get(userId);
        if (!user) {
          result.failed += 1;
          continue;
        }
        const ok = await this.dm(user, text);
        if (ok) {
          result.sent += 1;
          delivered += 1;
        } else result.failed += 1;
      }
      if (delivered > 0) await leaver.mark();
    }
  }

  private async dm(user: UserEntity, text: string): Promise<boolean> {
    try {
      return await this.bot.sendMessage(user.maxUserId, text);
    } catch {
      this.logger.warn(`Smart-alert DM failed for user ${user.id}`);
      return false;
    }
  }
}

function hasLeft(leaveNowSentAt: Date | null, event: EventEntity, checkIn: CheckInEntity | undefined): boolean {
  if (leaveNowSentAt) return true;
  if (!checkIn) return false;
  if (checkIn.eventId === event.id) return true;
  return checkIn.placeId !== null && checkIn.placeId === event.placeId;
}

function latestCheckInByUser(rows: CheckInEntity[]): Map<string, CheckInEntity> {
  const latest = new Map<string, CheckInEntity>();
  for (const row of rows) {
    const prev = latest.get(row.userId);
    if (!prev || row.checkedInAt.getTime() > prev.checkedInAt.getTime()) latest.set(row.userId, row);
  }
  return latest;
}
