import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { ListDigestSendEntity } from "./list-digest.entity";
import { formatListDigestText, ListDigestService, weekendWindow } from "./list-digest.service";

const friday = new Date("2026-09-11T10:00:00Z");
const sunday = new Date("2026-09-13T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const listId = "00000000-0000-4000-8000-0000000000c1";
const nearPlaceId = "00000000-0000-4000-8000-0000000000p1";
const farPlaceId = "00000000-0000-4000-8000-0000000000p2";
const originPlaceId = "00000000-0000-4000-8000-0000000000p3";

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
      if (bound instanceof Date && cell instanceof Date) return cell.getTime() >= bound.getTime();
      return true;
    }
    return cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    save: async (entity: T) => {
      if (!store.includes(entity)) store.push(entity);
      return entity;
    },
  };
}

function eventRow(id: string, placeId: string, startsAt: Date): EventEntity {
  return { id, title: id, placeId, startsAt, published: true } as EventEntity;
}

function createService(options: { eventIds?: string[]; far?: boolean; digestEnabled?: boolean; now?: Date } = {}) {
  const now = options.now ?? friday;
  const ids = options.eventIds ?? ["00000000-0000-4000-8000-0000000000e1", "00000000-0000-4000-8000-0000000000e2", "00000000-0000-4000-8000-0000000000e3", "00000000-0000-4000-8000-0000000000e4"];
  const placeId = options.far ? farPlaceId : nearPlaceId;
  const startsAt = new Date("2026-09-12T09:00:00Z");
  const events = ids.map((id) => eventRow(id, placeId, startsAt));
  const lists = createStoreRepo<ListEntity>([{ id: listId, userId, title: "Хочу сходить", preset: "want_to_go" } as ListEntity]);
  const items = createStoreRepo<ListItemEntity>(ids.map((eventId, index) => ({ id: `item-${index}`, listId, eventId, placeId: null }) as ListItemEntity));
  const eventRepo = createStoreRepo<EventEntity>(events);
  const places = createStoreRepo<PlaceEntity>([{ id: nearPlaceId, latitude: 55.747, longitude: 37.584, published: true } as PlaceEntity, { id: farPlaceId, latitude: 59.93, longitude: 30.31, published: true } as PlaceEntity, { id: originPlaceId, latitude: 55.75, longitude: 37.62, published: true } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([{ id: userId, maxUserId: "1", firstName: "Саша" } as UserEntity]);
  const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId, eventId: null, placeId: originPlaceId, visitDate: "2026-09-11", checkedInAt: now } as CheckInEntity]);
  const profiles = createStoreRepo<ProfileEntity>(options.digestEnabled === false ? [{ userId, city: "Москва", interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS, listDigest: false }, privacy: { visitHistory: "friends", routes: "friends" }, recommendationsEnabled: true, bio: "", coverUrl: null, updatedAt: now } as ProfileEntity] : []);
  const sends = createStoreRepo<ListDigestSendEntity>();
  const sent: string[] = [];
  const bot = {
    sendMessage: async (maxUserId: string, text: string) => {
      sent.push(`${maxUserId}:${text}`);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new ListDigestService(lists as unknown as Repository<ListEntity>, items as unknown as Repository<ListItemEntity>, eventRepo as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, checkIns as unknown as Repository<CheckInEntity>, profiles as unknown as Repository<ProfileEntity>, sends as unknown as Repository<ListDigestSendEntity>, bot);
  return { service, sent, sends };
}

describe("weekendWindow and formatListDigestText", () => {
  it("opens the Moscow weekend on Friday and Saturday, not Sunday", () => {
    const fri = weekendWindow(friday);
    expect(fri?.saturdayKey).toBe("2026-09-12");
    expect(fri?.windowKey).toBe("weekend:2026-09-12");
    expect(weekendWindow(new Date("2026-09-12T10:00:00Z"))?.saturdayKey).toBe("2026-09-12");
    expect(weekendWindow(sunday)).toBeNull();
  });

  it("matches the README phrasing for four Saturday events", () => {
    expect(formatListDigestText(4, 4)).toBe("В субботу рядом будет 4 события из твоего списка");
    expect(formatListDigestText(1, 0)).toBe("В воскресенье рядом будет 1 событие из твоего списка");
  });
});

describe("ListDigestService.tick", () => {
  it("DMs a nearby weekend digest and does not resend the same event set", async () => {
    const { service, sent, sends } = createService();
    const first = await service.tick(friday);
    expect(first.sent).toBe(1);
    expect(sent).toEqual(["1:В субботу рядом будет 4 события из твоего списка"]);
    expect(sends.store).toHaveLength(1);
    const second = await service.tick(friday);
    expect(second.sent).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("skips far events, opted-out users, and Sunday ticks", async () => {
    const far = createService({ far: true });
    await expect(far.service.tick(friday)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(far.sent).toHaveLength(0);

    const off = createService({ digestEnabled: false });
    await expect(off.service.tick(friday)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(off.sent).toHaveLength(0);

    const onSunday = createService({ now: sunday });
    await expect(onSunday.service.tick(sunday)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(onSunday.sent).toHaveLength(0);
  });
});
