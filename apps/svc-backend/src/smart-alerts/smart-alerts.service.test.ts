import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { formatFriendLeftText, formatWeatherAlertText, SmartAlertsService } from "./smart-alerts.service";
import type { HourlyPrecip, WeatherClient } from "./weather.client";

const now = new Date("2026-09-12T10:00:00Z");
const hostId = "00000000-0000-4000-8000-00000000000a";
const dimaId = "00000000-0000-4000-8000-0000000000b1";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const venueId = "00000000-0000-4000-8000-0000000000p1";
const planId = "00000000-0000-4000-8000-0000000000c1";
const startsAt = new Date("2026-09-12T12:00:00Z");
const meetingAt = new Date("2026-09-12T11:40:00Z");

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
    save: async (entity: T) => entity,
  };
}

function createService(options: { rain?: HourlyPrecip | null; dimaLeft?: boolean; dimaCheckInAtVenue?: boolean; dimaStatus?: PlanParticipantEntity["status"]; hostWeather?: boolean } = {}) {
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
      weatherAlertSentAt: null,
      friendLeftBroadcastAt: null,
      createdAt: now,
      updatedAt: now,
    } as PlanEntity,
  ]);
  const participants = createStoreRepo<PlanParticipantEntity>([
    {
      id: "00000000-0000-4000-8000-0000000000d1",
      planId,
      userId: dimaId,
      status: options.dimaStatus ?? "confirmed",
      reminderSentAt: null,
      leaveNowSentAt: options.dimaLeft ? now : null,
      friendLeftBroadcastAt: null,
      createdAt: now,
      updatedAt: now,
    } as PlanParticipantEntity,
  ]);
  const events = createStoreRepo<EventEntity>([{ id: eventId, title: "The Weekend Tribute", placeId: venueId, startsAt, published: true } as EventEntity]);
  const places = createStoreRepo<PlaceEntity>([{ id: venueId, title: "Парк", latitude: 55.747, longitude: 37.584, published: true } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([{ id: hostId, maxUserId: "1", firstName: "Саша", lastName: null } as UserEntity, { id: dimaId, maxUserId: "2", firstName: "Дима", lastName: null } as UserEntity]);
  const checkIns = createStoreRepo<CheckInEntity>(options.dimaCheckInAtVenue ? [{ id: "c1", userId: dimaId, eventId, placeId: null, visitDate: null, checkedInAt: now } as CheckInEntity] : []);
  const sent: string[] = [];
  const bot = {
    sendMessage: async (maxUserId: string, text: string) => {
      sent.push(`${maxUserId}:${text}`);
      return true;
    },
  } as unknown as MaxBotClient;
  const weather = {
    precipitationAt: async () => options.rain ?? null,
  } as unknown as WeatherClient;
  const service = new SmartAlertsService(plans as unknown as Repository<PlanEntity>, participants as unknown as Repository<PlanParticipantEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, checkIns as unknown as Repository<CheckInEntity>, createStoreRepo<ProfileEntity>(options.hostWeather === false ? [{ userId: hostId, city: "Москва", interests: [], smartAlerts: { leaveNow: true, weather: false, friendLeft: true, listDigest: true }, privacy: { visitHistory: "friends", routes: "friends" }, recommendationsEnabled: true, updatedAt: now } as ProfileEntity] : []) as unknown as Repository<ProfileEntity>, bot, weather);
  return { service, sent, plans, participants };
}

describe("smart alert copy", () => {
  it("uses the README rain phrasing and names the friend who left", () => {
    expect(formatWeatherAlertText("Концерт")).toBe("«Концерт». Похоже, будет дождь. Встречаемся не у входа, а внутри?");
    expect(formatFriendLeftText("Концерт", "Дима")).toBe("«Концерт». Дима уже вышел.");
  });
});

describe("SmartAlertsService.tick", () => {
  it("DMs the plan when Open-Meteo reports rain in the event hour", async () => {
    const { service, sent, plans } = createService({ rain: { precipitationMm: 1.2, precipitationProbability: 70 } });
    const result = await service.tick(now);
    expect(result.sent).toBe(2);
    expect(sent.every((row) => row.includes("Похоже, будет дождь"))).toBe(true);
    expect(plans.store[0]?.weatherAlertSentAt).toEqual(now);
    const again = await service.tick(now);
    expect(again.sent).toBe(0);
  });

  it("does not send a weather DM when the forecast is dry or the provider fails", async () => {
    const dry = createService({ rain: { precipitationMm: 0, precipitationProbability: 10 } });
    await expect(dry.service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(dry.sent).toHaveLength(0);

    const down = createService({ rain: null });
    await expect(down.service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(down.sent).toHaveLength(0);
  });

  it("notifies others when a confirmed friend has leaveNowSentAt", async () => {
    const { service, sent, participants } = createService({ dimaLeft: true });
    const result = await service.tick(now);
    expect(result.sent).toBe(1);
    expect(sent).toEqual(["1:«The Weekend Tribute». Дима уже вышел."]);
    expect(participants.store[0]?.friendLeftBroadcastAt).toEqual(now);
    const again = await service.tick(now);
    expect(again.sent).toBe(0);
  });

  it("skips weather DMs for a user who disabled weather alerts", async () => {
    const { service, sent } = createService({ rain: { precipitationMm: 1.2, precipitationProbability: 70 }, hostWeather: false });
    const result = await service.tick(now);
    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.startsWith("2:")).toBe(true);
  });

  it("treats a venue check-in as left and skips declined members", async () => {
    const atVenue = createService({ dimaCheckInAtVenue: true });
    await atVenue.service.tick(now);
    expect(atVenue.sent).toEqual(["1:«The Weekend Tribute». Дима уже вышел."]);

    const declined = createService({ dimaLeft: true, dimaStatus: "declined" });
    await expect(declined.service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(declined.sent).toHaveLength(0);
  });
});
