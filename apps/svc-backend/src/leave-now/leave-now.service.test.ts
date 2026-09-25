import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { haversineMeters } from "../plans/plans.service";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { formatLeaveNowText, LeaveNowService, shouldLeaveNow, walkingMinutes } from "./leave-now.service";

const now = new Date("2026-09-12T10:00:00Z");
const hostId = "00000000-0000-4000-8000-00000000000a";
const dimaId = "00000000-0000-4000-8000-0000000000b1";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const venueId = "00000000-0000-4000-8000-0000000000p1";
const originPlaceId = "00000000-0000-4000-8000-0000000000p2";
const planId = "00000000-0000-4000-8000-0000000000c1";

const origin = { latitude: 55.75, longitude: 37.62 };
const venue = { latitude: 55.747, longitude: 37.584 };
const travel = walkingMinutes(haversineMeters(origin, venue.latitude, venue.longitude));

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    if (values) return values.includes(cell);
    if (value && typeof value === "object" && "_value" in value) {
      const bound = (value as { _value: Date })._value;
      if (bound instanceof Date && cell instanceof Date) return cell.getTime() > bound.getTime();
    }
    return cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => entity,
  };
}

function createService(options: { startsInMin: number; dimaStatus?: PlanParticipantEntity["status"]; withOrigin?: boolean; hostLeaveNow?: boolean } = { startsInMin: travel + 20 }) {
  const startsAt = new Date(now.getTime() + options.startsInMin * 60_000);
  const meetingAt = new Date(startsAt.getTime() - 20 * 60_000);
  const plans = createStoreRepo<PlanEntity>([
    {
      id: planId,
      hostUserId: hostId,
      eventId,
      meetingPoint: "у метро",
      meetingAt,
      chatLink: null,
      reminderSentAt: null,
      leaveNowSentAt: null,
      createdAt: now,
      updatedAt: now,
    } as PlanEntity,
  ]);
  const participants = createStoreRepo<PlanParticipantEntity>([
    {
      id: "part-1",
      planId,
      userId: dimaId,
      status: options.dimaStatus ?? "confirmed",
      reminderSentAt: null,
      leaveNowSentAt: null,
      createdAt: now,
      updatedAt: now,
    } as PlanParticipantEntity,
  ]);
  const events = createStoreRepo<EventEntity>([
    {
      id: eventId,
      title: "The Weekend Tribute",
      placeId: venueId,
      startsAt,
      published: true,
    } as EventEntity,
  ]);
  const places = createStoreRepo<PlaceEntity>([{ id: venueId, title: "Парк", latitude: venue.latitude, longitude: venue.longitude, published: true } as PlaceEntity, { id: originPlaceId, title: "Дом", latitude: origin.latitude, longitude: origin.longitude, published: true } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([{ id: hostId, maxUserId: "1" } as UserEntity, { id: dimaId, maxUserId: "2" } as UserEntity]);
  const checkIns = createStoreRepo<CheckInEntity>(options.withOrigin === false ? [] : [{ id: "c1", userId: hostId, eventId: null, placeId: originPlaceId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity, { id: "c2", userId: dimaId, eventId: null, placeId: originPlaceId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity]);
  const sent: string[] = [];
  const bot = {
    sendMessage: async (maxUserId: string, text: string) => {
      sent.push(`${maxUserId}:${text}`);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new LeaveNowService(plans as unknown as Repository<PlanEntity>, participants as unknown as Repository<PlanParticipantEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, checkIns as unknown as Repository<CheckInEntity>, createStoreRepo<ProfileEntity>(options.hostLeaveNow === false ? [{ userId: hostId, city: "Москва", interests: [], smartAlerts: { leaveNow: false, weather: true, friendLeft: true, listDigest: true, quietHoursEnabled: false, quietHoursFrom: "23:00", quietHoursTo: "09:00" }, privacy: { visitHistory: "friends", routes: "friends" }, recommendationsEnabled: true, updatedAt: now } as ProfileEntity] : []) as unknown as Repository<ProfileEntity>, bot);
  return { service, sent, plans, participants };
}

describe("formatLeaveNowText and shouldLeaveNow", () => {
  it("matches the README early-arrival phrasing", () => {
    expect(formatLeaveNowText("Концерт", 48, 28, 20)).toContain("будешь за 20 минут до начала");
    expect(shouldLeaveNow(48, 28)).toBe(true);
    expect(shouldLeaveNow(180, 28)).toBe(false);
    expect(shouldLeaveNow(10, 28)).toBe(false);
    expect(shouldLeaveNow(20, 0)).toBe(false);
  });
});

describe("LeaveNowService.tick", () => {
  it("DMs host and confirmed participants when leaving now arrives ~20 min early", async () => {
    const { service, sent, plans } = createService({ startsInMin: travel + 20 });
    const result = await service.tick(now);
    expect(travel).toBeGreaterThan(0);
    expect(result.sent).toBe(2);
    expect(sent).toHaveLength(2);
    expect(sent.every((row) => row.includes("будешь за 20 минут до начала"))).toBe(true);
    expect(sent.every((row) => row.includes(`До места ${travel} мин`))).toBe(true);
    expect(plans.store[0]?.leaveNowSentAt).toEqual(now);
    const again = await service.tick(now);
    expect(again.sent).toBe(0);
  });

  it("skips declined invitees and users without a last check-in origin", async () => {
    const declined = createService({ startsInMin: travel + 20, dimaStatus: "declined" });
    await declined.service.tick(now);
    expect(declined.sent).toHaveLength(1);
    expect(declined.sent[0]?.startsWith("1:")).toBe(true);

    const noOrigin = createService({ startsInMin: travel + 20, withOrigin: false });
    await expect(noOrigin.service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(noOrigin.sent).toHaveLength(0);
  });

  it("does not notify when the event is still far beyond travel plus the early window", async () => {
    const { service, sent } = createService({ startsInMin: travel + 120 });
    await expect(service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("skips a user who disabled leaveNow alerts", async () => {
    const { service, sent, plans } = createService({ startsInMin: travel + 20, hostLeaveNow: false });
    const result = await service.tick(now);
    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.startsWith("2:")).toBe(true);
    expect(plans.store[0]?.leaveNowSentAt).toBeNull();
  });
});
