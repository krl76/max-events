import { describe, expect, it } from "vitest";
import type { DataSource, EntityManager, EntityTarget, FindOneOptions, ObjectLiteral, Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { DEFAULT_REMINDER_WINDOW_MS, formatReminderText, isInReminderWindow, RemindersService } from "./reminders.service";

const now = new Date("2026-09-12T16:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const bookingId = "00000000-0000-4000-8000-0000000000b1";

describe("isInReminderWindow", () => {
  it("includes startsAt at now and excludes startsAt at the window edge", () => {
    expect(isInReminderWindow(now, now, DEFAULT_REMINDER_WINDOW_MS)).toBe(true);
    expect(isInReminderWindow(new Date(now.getTime() + DEFAULT_REMINDER_WINDOW_MS - 1), now)).toBe(true);
    expect(isInReminderWindow(new Date(now.getTime() + DEFAULT_REMINDER_WINDOW_MS), now)).toBe(false);
    expect(isInReminderWindow(new Date(now.getTime() - 1), now)).toBe(false);
  });
});

function eventAt(startsAt: Date, title = "Джаз в парке"): EventEntity {
  return {
    id: eventId,
    title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    organizerUserId: null,
    startsAt,
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 1,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  };
}

function booking(overrides: Partial<BookingEntity> = {}): BookingEntity {
  return {
    id: bookingId,
    userId,
    eventId,
    status: "active",
    createdAt: now,
    updatedAt: now,
    reminderSentAt: null,
    ...overrides,
  };
}

function user(): UserEntity {
  return {
    id: userId,
    maxUserId: "67890",
    firstName: "Max",
    lastName: null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createHarness(options: { bookings: BookingEntity[]; events: EventEntity[]; send?: (maxUserId: string, text: string) => Promise<boolean> }) {
  const bookings = options.bookings;
  const events = options.events;
  const users = [user()];
  const sent: Array<{ maxUserId: string; text: string }> = [];
  const bot = {
    sendMessage: async (maxUserId: string, text: string) => {
      const ok = options.send ? await options.send(maxUserId, text) : true;
      if (ok) sent.push({ maxUserId, text });
      return ok;
    },
  } as unknown as MaxBotClient;

  const bookingsRepo = {
    find: async (opts: { where: { status: string } }) => bookings.filter((row) => row.status === opts.where.status),
  };
  const eventsRepo = {
    findOneBy: async (where: { id: string }) => events.find((row) => row.id === where.id) ?? null,
  };
  const usersRepo = {
    findOneBy: async (where: { id: string }) => users.find((row) => row.id === where.id) ?? null,
  };

  const dataSource = {
    transaction: async <T>(run: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const manager = {
        findOne: async <Entity extends ObjectLiteral>(entity: EntityTarget<Entity>, opts: FindOneOptions<Entity>) => {
          const where = (opts.where ?? {}) as Record<string, unknown>;
          if (entity === BookingEntity) return (bookings.find((row) => row.id === where.id) ?? null) as Entity | null;
          if (entity === UserEntity) return (users.find((row) => row.id === where.id) ?? null) as Entity | null;
          return null;
        },
        save: async <Entity>(_entity: EntityTarget<Entity>, record: ObjectLiteral) => {
          const row = record as BookingEntity;
          const index = bookings.findIndex((item) => item.id === row.id);
          if (index >= 0) bookings[index] = row;
          return row as Entity;
        },
      };
      return run(manager as unknown as EntityManager);
    },
  };

  const service = new RemindersService(
    bookingsRepo as unknown as Repository<BookingEntity>,
    eventsRepo as unknown as Repository<EventEntity>,
    usersRepo as unknown as Repository<UserEntity>,
    dataSource as unknown as DataSource,
    bot,
  );
  return { bookings, sent, service };
}

describe("RemindersService.tick", () => {
  it("sends one reminder for an in-window active booking and does not send again", async () => {
    const startsAt = new Date(now.getTime() + 30 * 60 * 1000);
    const { bookings, sent, service } = createHarness({ bookings: [booking()], events: [eventAt(startsAt)] });
    const first = await service.tick(now);
    expect(first).toEqual({ sent: 1, failed: 0 });
    expect(sent).toEqual([{ maxUserId: "67890", text: formatReminderText("Джаз в парке", startsAt) }]);
    expect(bookings[0]?.reminderSentAt).toEqual(now);

    const second = await service.tick(now);
    expect(second).toEqual({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it("skips cancelled, past, already-sent, and too-far bookings", async () => {
    const inWindow = new Date(now.getTime() + 10 * 60 * 1000);
    const tooFar = new Date(now.getTime() + DEFAULT_REMINDER_WINDOW_MS + 60_000);
    const past = new Date(now.getTime() - 60_000);
    const { sent, service } = createHarness({
      bookings: [
        booking({ id: "cancelled", status: "cancelled" }),
        booking({ id: "sent", reminderSentAt: now }),
        booking({ id: "past", eventId: "e-past" }),
        booking({ id: "far", eventId: "e-far" }),
      ],
      events: [eventAt(inWindow), eventAt(past, "Прошлое"), { ...eventAt(tooFar, "Позже"), id: "e-far" }, { ...eventAt(past, "Прошлое"), id: "e-past" }],
    });
    await expect(service.tick(now)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });

  it("does not mark sent when the bot fails and still processes the next booking", async () => {
    const startsAt = new Date(now.getTime() + 15 * 60 * 1000);
    let calls = 0;
    const secondId = "00000000-0000-4000-8000-0000000000b2";
    const { bookings, sent, service } = createHarness({
      bookings: [booking(), booking({ id: secondId })],
      events: [eventAt(startsAt)],
      send: async () => {
        calls += 1;
        return calls !== 1;
      },
    });
    const result = await service.tick(now);
    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(bookings[0]?.reminderSentAt).toBeNull();
    expect(bookings[1]?.reminderSentAt).toEqual(now);
    expect(sent).toHaveLength(1);
  });
});
