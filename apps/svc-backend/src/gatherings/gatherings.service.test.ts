import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { Friend } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { GatheringInviteeEntity } from "./gathering-invitee.entity";
import { GatheringEntity } from "./gathering.entity";
import { availabilityOf, GatheringsService } from "./gatherings.service";

const now = new Date("2026-09-12T10:00:00Z");
const hostId = "00000000-0000-4000-8000-00000000000a";
const dimaId = "00000000-0000-4000-8000-0000000000b1";
const katyaId = "00000000-0000-4000-8000-0000000000b2";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const otherEventId = "00000000-0000-4000-8000-0000000000e2";

function user(id: string, maxUserId: string, firstName: string): UserEntity {
  return { id, maxUserId, firstName, lastName: null, avatarUrl: null, createdAt: now, updatedAt: now } as UserEntity;
}

function eventRow(id: string, title: string, startsAt: string, endsAt: string | null = null): EventEntity {
  return {
    id,
    title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(options: { bookings?: BookingEntity[]; botChat?: { chatId: number; link: string } | null } = {}) {
  const users = [user(hostId, "1", "Демо"), user(dimaId, "2", "Дима"), user(katyaId, "3", "Катя")];
  const events = [eventRow(eventId, "Джаз", "2026-09-20T16:00:00.000Z", "2026-09-20T18:00:00.000Z"), eventRow(otherEventId, "Матч", "2026-09-20T16:30:00.000Z", "2026-09-20T17:30:00.000Z")];
  const gatherings = createStoreRepo<GatheringEntity>();
  const invitees = createStoreRepo<GatheringInviteeEntity>();
  const bookings = createStoreRepo<BookingEntity>(options.bookings ?? []);
  const eventRepo = createStoreRepo<EventEntity>(events);
  const userRepo = createStoreRepo<UserEntity>(users);
  const friendDtos: Friend[] = [
    { id: dimaId, name: "Дима", avatarUrl: null },
    { id: katyaId, name: "Катя", avatarUrl: null },
  ];
  const friends = {
    list: async () => friendDtos,
    friendIds: async () => new Set([dimaId, katyaId]),
  } as unknown as FriendsService;
  const messages: string[] = [];
  const bot = {
    createChat: async () => options.botChat ?? { chatId: 1, link: "https://max.ru/join/g" },
    sendMessage: async (_id: string, text: string) => {
      messages.push(text);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new GatheringsService(gatherings as unknown as Repository<GatheringEntity>, invitees as unknown as Repository<GatheringInviteeEntity>, bookings as unknown as Repository<BookingEntity>, eventRepo as unknown as Repository<EventEntity>, userRepo as unknown as Repository<UserEntity>, friends, bot);
  return { service, invitees, messages };
}

describe("availabilityOf", () => {
  const target = { startsAt: new Date("2026-09-20T16:00:00Z"), endsAt: new Date("2026-09-20T18:00:00Z") };
  it("is busy on overlap, free with no bookings, unknown when a booked event is missing", () => {
    expect(availabilityOf(target, [{ startsAt: new Date("2026-09-20T17:00:00Z"), endsAt: new Date("2026-09-20T19:00:00Z") }])).toBe("busy");
    expect(availabilityOf(target, [])).toBe("free");
    expect(availabilityOf(target, [null])).toBe("unknown");
  });
});

describe("GatheringsService", () => {
  it("marks a friend busy when their booking overlaps the event", async () => {
    const { service } = createService({
      bookings: [{ id: "b1", userId: dimaId, eventId: otherEventId, status: "active" } as BookingEntity],
    });
    const rows = await service.availability(hostId, eventId);
    expect(rows.find((row) => row.friend.id === dimaId)?.availability).toBe("busy");
    expect(rows.find((row) => row.friend.id === katyaId)?.availability).toBe("free");
  });

  it("creates a gathering, invites friends, and records an accepted response", async () => {
    const { service, invitees, messages } = createService();
    const created = await service.create(hostId, {
      eventId,
      friendIds: [dimaId, katyaId],
      proposedMeetingAt: "2026-09-20T15:30:00.000Z",
    });
    expect(created.status).toBe("awaiting_responses");
    expect(created.invitees).toHaveLength(2);
    expect(created.invitees.every((row) => row.response === "considering")).toBe(true);
    expect(messages.some((text) => text.includes("https://max.ru/join/g"))).toBe(true);

    const answered = await service.respond(dimaId, created.id, "accepted");
    expect(answered.invitees.find((row) => row.friend.id === dimaId)?.response).toBe("accepted");
    expect(invitees.store.find((row) => row.userId === dimaId)?.respondedAt).toBeInstanceOf(Date);
    await expect(service.get(katyaId, created.id)).resolves.toMatchObject({ id: created.id });
    await expect(service.get("00000000-0000-4000-8000-0000000000ff", created.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects inviting a non-friend or a missing event", async () => {
    const { service } = createService();
    await expect(service.create(hostId, { eventId, friendIds: [hostId], proposedMeetingAt: "2026-09-20T15:30:00.000Z" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(hostId, {
        eventId: "00000000-0000-4000-8000-0000000000e9",
        friendIds: [dimaId],
        proposedMeetingAt: "2026-09-20T15:30:00.000Z",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reminds unanswered invitees once and skips those who responded", async () => {
    const { service, messages } = createService();
    const created = await service.create(hostId, {
      eventId,
      friendIds: [dimaId, katyaId],
      proposedMeetingAt: "2026-09-20T15:30:00.000Z",
    });
    messages.length = 0;
    await service.respond(dimaId, created.id, "busy");
    const first = await service.remindUnanswered();
    expect(first.sent).toBe(1);
    expect(messages).toHaveLength(1);
    const second = await service.remindUnanswered();
    expect(second.sent).toBe(0);
  });
});
