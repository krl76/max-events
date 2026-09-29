// START_MODULE_CONTRACT
// PURPOSE: Weekend list digest — nearby upcoming events from the user's lists, one MAX DM per event set.
// SCOPE: tick() on Fri/Sat Moscow; 15 km from last check-in; listDigest pref; unique (user, weekend, fingerprint).
// DEPENDS: typeorm, lists/events/places/users/check-ins/profiles, max-bot, nearby haversine, moscowDateKey
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LIST_DIGEST_MAX_KM - nearby radius matching «Рядом со мной»
// - ListDigestTickResult - sent/failed counts
// - WeekendWindow - Saturday–Sunday bounds
// - moscowWeekday - 0=Sun .. 6=Sat in Europe/Moscow
// - weekendWindow - Saturday–Sunday bounds when now is Fri/Sat Moscow
// - digestFingerprint - sha256 of sorted event ids
// - formatListDigestText - README «В субботу рядом будет N …»
// - ListDigestService - tick cycle
// END_MODULE_MAP

import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, QueryFailedError, Repository } from "typeorm";
import { DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { haversineKm } from "../geo/haversine";
import { PlaceEntity } from "../places/place.entity";
import { inQuietHours } from "../subscriptions/subscriptions.service";
import { moscowDateKey } from "../time/moscow-date";
import { ProfileEntity } from "../users/profile.entity";
import { readAlertPrefs } from "../users/profiles.service";
import { UserEntity } from "../users/user.entity";
import { ListDigestSendEntity } from "./list-digest.entity";

export const LIST_DIGEST_MAX_KM = 15;

export type ListDigestTickResult = { sent: number; failed: number };
export type WeekendWindow = { windowKey: string; saturdayKey: string; sundayKey: string; from: Date; to: Date };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function moscowWeekday(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(date);
  const index = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  return index < 0 ? -1 : index;
}

export function weekendWindow(now: Date): WeekendWindow | null {
  const weekday = moscowWeekday(now);
  if (weekday !== 5 && weekday !== 6) return null;
  const today = moscowDateKey(now);
  const saturdayKey = weekday === 6 ? today : addCalendarDays(today, 1);
  const sundayKey = addCalendarDays(saturdayKey, 1);
  const from = new Date(`${saturdayKey}T00:00:00+03:00`);
  const to = new Date(`${addCalendarDays(saturdayKey, 2)}T00:00:00+03:00`);
  return { windowKey: `weekend:${saturdayKey}`, saturdayKey, sundayKey, from, to };
}

export function digestFingerprint(eventIds: string[]): string {
  return createHash("sha256")
    .update([...eventIds].sort().join(","))
    .digest("hex");
}

export function formatListDigestText(count: number, saturdayCount: number): string {
  const when = saturdayCount > 0 ? "В субботу" : "В воскресенье";
  return `${when} рядом будет ${count} ${eventWord(count)} из твоего списка`;
}

@Injectable()
export class ListDigestService {
  private readonly logger = new Logger(ListDigestService.name);
  private running = false;

  constructor(
    @InjectRepository(ListEntity) private readonly lists: Repository<ListEntity>,
    @InjectRepository(ListItemEntity) private readonly items: Repository<ListItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(ListDigestSendEntity) private readonly sends: Repository<ListDigestSendEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async tick(now = new Date()): Promise<ListDigestTickResult> {
    if (this.running) return { sent: 0, failed: 0 };
    this.running = true;
    const result: ListDigestTickResult = { sent: 0, failed: 0 };
    try {
      const window = weekendWindow(now);
      if (!window) return result;
      const weekendEvents = await this.events.find({ where: { published: true, startsAt: MoreThanOrEqual(window.from) } });
      const inWindow = weekendEvents.filter((row) => row.startsAt.getTime() >= window.from.getTime() && row.startsAt.getTime() < window.to.getTime() && row.published !== false);
      if (inWindow.length === 0) return result;
      const eventById = new Map(inWindow.map((row) => [row.id, row]));
      const eventIds = [...eventById.keys()];
      const itemRows = await this.items.find({ where: { eventId: In(eventIds) } });
      if (itemRows.length === 0) return result;
      const listIds = [...new Set(itemRows.map((row) => row.listId))];
      const listRows = await this.lists.find({ where: { id: In(listIds) } });
      const listById = new Map(listRows.map((row) => [row.id, row]));
      const userIds = [...new Set(listRows.map((row) => row.userId))];
      const [userRows, profileRows, checkIns, sentRows] = await Promise.all([this.users.find({ where: { id: In(userIds) } }), this.profiles.find({ where: { userId: In(userIds) } }), this.checkIns.find({ where: { userId: In(userIds) } }), this.sends.find({ where: { userId: In(userIds), windowKey: window.windowKey } })]);
      const userById = new Map(userRows.map((row) => [row.id, row]));
      const prefsByUser = new Map(profileRows.map((row) => [row.userId, readAlertPrefs(row)]));
      const latestCheckIn = latestCheckInByUser(checkIns);
      const sentFingerprints = new Set(sentRows.map((row) => `${row.userId}:${row.fingerprint}`));
      const venueIds = [...new Set(inWindow.map((row) => row.placeId).filter((id): id is string => id !== null))];
      const originEventIds = [...new Set(checkIns.map((row) => row.eventId).filter((id): id is string => id !== null))];
      const originEvents = originEventIds.length === 0 ? [] : await this.events.find({ where: { id: In(originEventIds) } });
      const originEventById = new Map(originEvents.map((row) => [row.id, row]));
      const placeIds = [...new Set([...venueIds, ...checkIns.map((row) => row.placeId).filter((id): id is string => id !== null), ...originEvents.map((row) => row.placeId).filter((id): id is string => id !== null)])];
      const placeRows = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
      const placeById = new Map(placeRows.map((row) => [row.id, row]));

      const eventsByUser = new Map<string, Set<string>>();
      for (const item of itemRows) {
        if (!item.eventId) continue;
        const list = listById.get(item.listId);
        if (!list || !eventById.has(item.eventId)) continue;
        const set = eventsByUser.get(list.userId) ?? new Set<string>();
        set.add(item.eventId);
        eventsByUser.set(list.userId, set);
      }

      for (const [userId, ids] of eventsByUser) {
        const prefs = prefsByUser.get(userId) ?? DEFAULT_SMART_ALERTS;
        if (!prefs.listDigest) continue;
        const user = userById.get(userId);
        if (!user) {
          result.failed += 1;
          continue;
        }
        const origin = originFromCheckIn(latestCheckIn.get(userId), originEventById, placeById);
        if (!origin) continue;
        const nearby = [...ids].flatMap((id) => {
          const event = eventById.get(id);
          if (!event?.placeId) return [];
          const place = placeById.get(event.placeId);
          if (!place) return [];
          const km = haversineKm(origin.latitude, origin.longitude, place.latitude, place.longitude);
          return km <= LIST_DIGEST_MAX_KM ? [event] : [];
        });
        if (nearby.length === 0) continue;
        const nearbyIds = nearby.map((row) => row.id);
        const fingerprint = digestFingerprint(nearbyIds);
        if (sentFingerprints.has(`${userId}:${fingerprint}`)) continue;
        if (inQuietHours(prefs, now)) continue;
        const saturdayCount = nearby.filter((row) => moscowDateKey(row.startsAt) === window.saturdayKey).length;
        const text = formatListDigestText(nearby.length, saturdayCount);
        try {
          const ok = await this.bot.sendMessage(user.maxUserId, text);
          if (!ok) {
            result.failed += 1;
            continue;
          }
          try {
            await this.sends.save(this.sends.create({ userId, windowKey: window.windowKey, fingerprint, eventCount: nearby.length }));
          } catch (error) {
            if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
          }
          sentFingerprints.add(`${userId}:${fingerprint}`);
          result.sent += 1;
        } catch {
          this.logger.warn(`List-digest DM failed for user ${userId}`);
          result.failed += 1;
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}

function addCalendarDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function eventWord(count: number): string {
  const n10 = count % 10;
  const n100 = count % 100;
  if (n10 === 1 && n100 !== 11) return "событие";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "события";
  return "событий";
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
