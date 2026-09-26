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

import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThan, Repository } from "typeorm";
import { DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { haversineMeters } from "../plans/plans.service";
import { writeInbox } from "../smart-alerts/deliver-invite";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { formatWeatherAlertText, WEATHER_WINDOW_MS } from "../smart-alerts/smart-alerts.service";
import { isRainy, WeatherClient } from "../smart-alerts/weather.client";
import { inQuietHours } from "../subscriptions/subscriptions.service";
import { miniappLink, withAppLink } from "../time/human-when";
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

/** Rain and «пора выходить» for the same event, as one sentence. */
export function formatCombinedDepartureText(title: string, minutesUntilStart: number, travelMinutes: number, earlyMinutes: number): string {
  return `«${title}» через ${minutesUntilStart} мин, и похоже, будет дождь. До места ${travelMinutes} мин. Если выйти сейчас — будешь за ${earlyMinutes} минут до начала`;
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
    @Optional() @Inject(WeatherClient) private readonly weather?: WeatherClient,
    @Optional() @InjectRepository(NotificationEntity) private readonly notices?: Repository<NotificationEntity>,
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
        const rainy = await this.forecastRain(plan, event, venue, now);
        const audience: Array<{ userId: string; markLeave: (() => Promise<void>) | null }> = [];
        audience.push({
          userId: plan.hostUserId,
          markLeave: plan.leaveNowSentAt
            ? null
            : async () => {
                plan.leaveNowSentAt = now;
                await this.plans.save(plan);
              },
        });
        for (const row of participantRows.filter((item) => item.planId === plan.id && item.status === "confirmed")) {
          audience.push({
            userId: row.userId,
            markLeave: row.leaveNowSentAt
              ? null
              : async () => {
                  row.leaveNowSentAt = now;
                  await this.participants.save(row);
                },
          });
        }
        let rainLeft = false;
        for (const recipient of audience) {
          const user = userById.get(recipient.userId);
          if (!user) {
            result.failed += 1;
            if (rainy) rainLeft = true;
            continue;
          }
          const prefs = prefsByUser.get(recipient.userId) ?? DEFAULT_SMART_ALERTS;
          const origin = originFromCheckIn(latestCheckIn.get(recipient.userId), originEventById, placeById);
          const travel = origin ? walkingMinutes(haversineMeters(origin, venue.latitude, venue.longitude)) : 0;
          const leaveDue = recipient.markLeave !== null && prefs.leaveNow && origin !== null && shouldLeaveNow(minutesUntilStart, travel);
          const rainDue = rainy && prefs.weather;
          if (!leaveDue && !rainDue) continue;
          const earlyMinutes = minutesUntilStart - travel;
          const raw = leaveDue && rainDue ? formatCombinedDepartureText(event.title, minutesUntilStart, travel, earlyMinutes) : leaveDue ? formatLeaveNowText(event.title, minutesUntilStart, travel, earlyMinutes) : formatWeatherAlertText(event.title);
          const text = withAppLink(raw, miniappLink(`plan-${plan.id}`));
          const quietRain = !leaveDue && inQuietHours(prefs, now);
          try {
            if (!quietRain) {
              const ok = await this.bot.sendMessage(user.maxUserId, text);
              if (!ok) {
                result.failed += 1;
                if (rainDue) rainLeft = true;
                continue;
              }
              result.sent += 1;
            }
            await writeInbox(this.notices, {
              userId: user.id,
              type: leaveDue ? "leave-now" : "weather",
              actorUserId: null,
              title: text,
              body: "",
              link: { target: "plan", id: plan.id },
              urgent: leaveDue,
            });
            if (leaveDue && recipient.markLeave) await recipient.markLeave();
            if (rainDue && quietRain && !this.notices) rainLeft = true;
          } catch {
            this.logger.warn(`Leave-now DM failed for plan ${plan.id}`);
            result.failed += 1;
            if (rainDue) rainLeft = true;
          }
        }
        if (rainy && !rainLeft) {
          plan.weatherAlertSentAt = now;
          await this.plans.save(plan);
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async forecastRain(plan: PlanEntity, event: EventEntity, venue: PlaceEntity, now: Date): Promise<boolean> {
    if (!this.weather || plan.weatherAlertSentAt) return false;
    const until = event.startsAt.getTime() - now.getTime();
    if (until <= 0 || until > WEATHER_WINDOW_MS) return false;
    const hour = await this.weather.precipitationAt(venue.latitude, venue.longitude, event.startsAt);
    return Boolean(hour && isRainy(hour));
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
