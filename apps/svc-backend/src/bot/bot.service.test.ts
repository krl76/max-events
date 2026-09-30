import { ConflictException, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { Event } from "@max-events/api-contracts";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { botPayload } from "./bot-payloads";
import { BotService, commandOf, isDialog, isMenuWord, BOT_COMMANDS } from "./bot.service";
import type { BotMessageBody } from "./bot.types";

const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const now = new Date("2026-09-12T10:00:00Z");

function event(overrides: Partial<Event> = {}): Event {
  return { id: eventId, title: "Джаз в Нескучном саду", description: "", category: "afisha", city: "Москва", placeId: null, startsAt: "2026-09-12T17:00:00.000Z", endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: null, chatLink: null, promoted: false, published: true, bookingOpensAt: null, weather: null, coverUrl: null, bookedCount: 0, ...overrides } as Event;
}

/** Records every outbound message and callback answer so a test can assert on the delivery, not the render. */
type Sent = Array<{ to: string; body: BotMessageBody }>;
type Answered = Array<{ callbackId: string; body: BotMessageBody }>;

function createHarness(
  overrides: {
    config?: Record<string, string>;
    assist?: { suggest?: (userId: string, query: string) => Promise<unknown> };
    today?: { digest?: (userId: string) => Promise<unknown> };
    whereto?: { suggest?: (query: unknown, viewerId?: string) => Promise<unknown> };
    plans?: { list?: (userId: string) => Promise<unknown[]> };
    calendar?: { list?: (userId: string) => Promise<unknown> };
    bookings?: { create?: (...args: unknown[]) => Promise<unknown> };
    waitlist?: { join?: (...args: unknown[]) => Promise<unknown> };
    events?: { getPublished?: (id: string) => Promise<Event> };
    answerOk?: boolean;
  } = {},
) {
  const sent: Sent = [];
  const answered: Answered = [];
  const typing: number[] = [];
  const bot = {
    sendTyping: async (chatId: number) => {
      typing.push(chatId);
      return true;
    },
    sendRich: async (to: string, body: BotMessageBody) => {
      sent.push({ to, body });
      return true;
    },
    answerCallback: async (callbackId: string, answer: { message?: BotMessageBody }) => {
      if (overrides.answerOk === false) return false;
      answered.push({ callbackId, body: answer.message! });
      return true;
    },
  } as unknown as MaxBotClient;

  const users = { upsertFromMax: async (payload: { id: number; first_name: string }) => ({ id: userId, maxUserId: String(payload.id), firstName: payload.first_name }) };
  const assist = { suggest: overrides.assist?.suggest ?? (async () => ({ summary: "Нашел 1 вариант", criteria: {}, items: [{ event: event(), explanation: "Подходит" }] })) };
  const today = { digest: overrides.today?.digest ?? (async () => ({ summary: { nearbyCount: 3, suitableCount: 1, withFriendsCount: 0 }, cards: [{ event: event(), labels: [] }], buckets: { nearbyIds: [], suitableIds: [], friendIds: [] } })) };
  const whereto = { suggest: overrides.whereto?.suggest ?? (async () => ({ items: [event()] })) };
  const plans = { list: overrides.plans?.list ?? (async () => []) };
  const calendar = { list: overrides.calendar?.list ?? (async () => ({ upcoming: [], past: [] })) };
  const bookings = { create: overrides.bookings?.create ?? (async () => ({ freeSeats: 5 })) };
  const waitlist = { join: overrides.waitlist?.join ?? (async () => ({ position: 2 })) };
  const events = { getPublished: overrides.events?.getPublished ?? (async () => event()) };
  const config = new ConfigService({ NODE_ENV: "test", BOT_PUBLIC_URL: "https://events.versacegus.cc", MAX_APP_URL: "https://max.ru/t691_hakaton_max_bot", ...overrides.config });

  // BotService's constructor is positional; the harness mirrors that order exactly.
  const service = new BotService(config, bot, users as never, today as never, whereto as never, assist as never, calendar as never, plans as never, bookings as never, waitlist as never, events as never);
  return { service, sent, answered, typing };
}

describe("isDialog", () => {
  it("answers DMs and a missing chat_type, not groups or channels", () => {
    const base = { maxUserId: "1", userName: null, text: "", callbackPayload: "", callbackId: "", startPayload: "", chatId: null };
    expect(isDialog({ ...base, kind: "text", chatType: "dialog" })).toBe(true);
    expect(isDialog({ ...base, kind: "text", chatType: null })).toBe(true);
    expect(isDialog({ ...base, kind: "text", chatType: "chat" })).toBe(false);
    expect(isDialog({ ...base, kind: "text", chatType: "channel" })).toBe(false);
  });
});

describe("isMenuWord / commandOf", () => {
  it("reads a single slash-command word and nothing with a space in it", () => {
    expect(commandOf("/today")).toBe("today");
    expect(commandOf("  Today ")).toBe("today");
    expect(commandOf("куда сходить вечером")).toBeNull();
    expect(isMenuWord("привет")).toBe(true);
    expect(isMenuWord("/help")).toBe(true);
    expect(isMenuWord("что ты умеешь")).toBe(true);
    expect(isMenuWord("найди джаз")).toBe(false);
  });

  it("publishes a command menu within MAX's per-command limits", () => {
    expect(BOT_COMMANDS.every((command) => command.name.length <= 64 && command.description.length <= 128)).toBe(true);
    expect(BOT_COMMANDS.length).toBeLessThanOrEqual(32);
  });
});

describe("BotService.handleInbound", () => {
  const startInbound = { kind: "start", maxUserId: "67890", userName: "Михаил", chatId: 555, chatType: "dialog", text: "", callbackPayload: "", callbackId: "", startPayload: "" } as const;
  const textInbound = (text: string) => ({ kind: "text", maxUserId: "67890", userName: "Михаил", chatId: 555, chatType: "dialog", text, callbackPayload: "", callbackId: "" }) as never;
  const callbackInbound = (payload: string) => ({ kind: "callback", maxUserId: "67890", userName: null, chatId: 555, chatType: "dialog", text: "", callbackPayload: payload, callbackId: "cb-1" }) as never;

  it("welcomes a first-time visitor and shows the typing indicator in the dialog", async () => {
    const { service, sent, typing } = createHarness();
    await service.handleInbound(startInbound);
    expect(typing).toEqual([555]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body.text).toContain("Михаил");
  });

  it("ignores an update from a group chat — a DM reply would address everyone", async () => {
    const { service, sent } = createHarness();
    await service.handleInbound({ ...startInbound, chatType: "chat" });
    expect(sent).toHaveLength(0);
  });

  it("answers a button press by editing the pressed message in place", async () => {
    const { service, sent, answered } = createHarness();
    await service.handleInbound(callbackInbound(botPayload({ id: "today" })));
    expect(answered).toHaveLength(1);
    expect(answered[0]?.callbackId).toBe("cb-1");
    expect(answered[0]?.body.text).toContain("Что сегодня");
    expect(sent).toHaveLength(0);
  });

  it("falls back to a new message when the edit is refused", async () => {
    const { service, sent, answered } = createHarness({ answerOk: false });
    await service.handleInbound(callbackInbound(botPayload({ id: "today" })));
    expect(answered).toHaveLength(0);
    expect(sent).toHaveLength(1);
  });

  it("runs a natural-language message through the assist and renders its picks", async () => {
    const { service, sent } = createHarness();
    await service.handleInbound(textInbound("джаз вечером до 3000"));
    expect(sent[0]?.body.text).toContain("Нашел 1 вариант");
  });

  it("routes /today and /plans commands to their screens instead of an NL search", async () => {
    const plansHarness = createHarness({ plans: { list: async () => [] } });
    await plansHarness.service.handleInbound(textInbound("/plans"));
    expect(plansHarness.sent[0]?.body.text).toContain("Мои планы");

    const todayHarness = createHarness();
    await todayHarness.service.handleInbound(textInbound("/today"));
    expect(todayHarness.sent[0]?.body.text).toContain("Что сегодня");
  });

  it("books an event from a callback and confirms with the reminder promise", async () => {
    const { service, answered } = createHarness({ events: { getPublished: async () => event({ capacity: 10, bookedCount: 1 }) }, bookings: { create: async () => ({ freeSeats: 8 }) } });
    await service.handleInbound(callbackInbound(botPayload({ id: "book", eventId })));
    expect(answered[0]?.body.text).toContain("Готово, ты записан");
    expect(answered[0]?.body.text).toContain("Свободных мест осталось: 8");
  });

  it("tells a person who is already booked instead of failing", async () => {
    const { service, answered } = createHarness({
      bookings: {
        create: async () => {
          throw new ConflictException("Booking already exists");
        },
      },
    });
    await service.handleInbound(callbackInbound(botPayload({ id: "book", eventId })));
    expect(answered[0]?.body.text).toContain("Ты уже записан");
  });

  it("offers the waitlist when the event is full", async () => {
    const { service, answered } = createHarness({
      bookings: {
        create: async () => {
          throw new ConflictException("No seats left");
        },
      },
    });
    await service.handleInbound(callbackInbound(botPayload({ id: "book", eventId })));
    expect(answered[0]?.body.text).toContain("Мест не осталось");
  });

  it("joins the waitlist and reports the position", async () => {
    const { service, answered } = createHarness({ waitlist: { join: async () => ({ position: 3 }) } });
    await service.handleInbound(callbackInbound(botPayload({ id: "waitlist", eventId })));
    expect(answered[0]?.body.text).toContain("Ты 3-й в очереди");
  });

  it("redirects a waitlist press to booking when seats are actually free", async () => {
    const { service, answered } = createHarness({
      waitlist: {
        join: async () => {
          throw new ConflictException("Seats are still available");
        },
      },
    });
    await service.handleInbound(callbackInbound(botPayload({ id: "waitlist", eventId })));
    expect(answered[0]?.body.text).toContain("Записаться?");
  });

  it("says the event is gone when it cannot be loaded", async () => {
    const { service, answered } = createHarness({
      events: {
        getPublished: async () => {
          throw new NotFoundException("Event not found");
        },
      },
    });
    await service.handleInbound(callbackInbound(botPayload({ id: "confirm-book", eventId })));
    expect(answered[0]?.body.text).toContain("Событие недоступно");
  });

  it("answers an unknown callback payload with the menu rather than nothing", async () => {
    const { service, answered } = createHarness();
    await service.handleInbound(callbackInbound("drop-tables"));
    expect(answered[0]?.body.text).toContain("Чем помочь");
  });

  it("turns a 429 from the assist into an honest slow-down card, not a crash", async () => {
    const { service, sent } = createHarness({
      assist: {
        suggest: async () => {
          throw new HttpException("Assist rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
        },
      },
    });
    await service.handleInbound(textInbound("джаз"));
    expect(sent[0]?.body.text).toContain("Слишком часто");
  });

  it("renders the honest failure card when a dependency throws, and never lets the error escape", async () => {
    const { service, answered } = createHarness({
      today: {
        digest: async () => {
          throw new Error("db down");
        },
      },
    });
    await expect(service.handleInbound(callbackInbound(botPayload({ id: "today" })))).resolves.toBeUndefined();
    expect(answered[0]?.body.text).toContain("Что-то пошло не так");
  });

  it("shows the empty-catalog card when the city itself has no events, not a search miss", async () => {
    const { service, answered } = createHarness({ today: { digest: async () => ({ summary: { nearbyCount: 0, suitableCount: 0, withFriendsCount: 0 }, cards: [], buckets: { nearbyIds: [], suitableIds: [], friendIds: [] } }) } });
    await service.handleInbound(callbackInbound(botPayload({ id: "today" })));
    expect(answered[0]?.body.text).toContain("Афиша пуста");
  });
});
