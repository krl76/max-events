// START_MODULE_CONTRACT
// PURPOSE: The conversational MAX bot — route an inbound update (start / text / button press) to the product services that already power the mini-app, and answer in chat.
// SCOPE: handleInbound resolves the MAX user to an app account (upsert, so a first-time bot visitor who never opened the mini-app still gets one), shows the typing indicator, dispatches by kind, and delivers the reply: a button press edits the pressed message in place (POST /answers) with a new-message fallback, start/text send a fresh message. Reuses TodayService, WheretoService, AssistService, CalendarService, PlansService, BookingsService, WaitlistService, EventsService — no product logic duplicated. Never throws to the caller: the webhook must answer 200 so MAX does not retry for hours. Answers dialogs only.
// DEPENDS: @nestjs/common, @nestjs/config, @max-events/api-contracts, ../max-bot/max-bot.client, ../users/users.service, ../today/today.service, ../whereto/whereto.service, ../assist/assist.service, ../calendar/calendar.service, ../plans/plans.service, ../bookings/bookings.service, ../waitlist/waitlist.service, ../events/events.service, ../time/human-when, ./bot-renderer, ./bot-payloads, ./bot.types
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BOT_COMMANDS - the slash-command menu published to MAX above the input
// - BotService - handleInbound + the per-kind handlers, all best-effort and non-throwing
// - isDialog - the bot answers DMs, not group chats or channels
// - isMenuWord - greeting / command / "what can you do" that should not run an NL search
// - commandOf - the leading slash-command word of a text message, null when there is none
// END_MODULE_MAP

import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Event } from "@max-events/api-contracts";
import { AssistService } from "../assist/assist.service";
import { BookingsService } from "../bookings/bookings.service";
import { CalendarService } from "../calendar/calendar.service";
import { EventsService } from "../events/events.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlansService } from "../plans/plans.service";
import { DEFAULT_MAX_APP_URL, DEFAULT_MAX_BOT_USERNAME } from "../time/human-when";
import { TodayService } from "../today/today.service";
import { UsersService } from "../users/users.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { WheretoService } from "../whereto/whereto.service";
import { botPayload, parseBotPayload, type BotPayload } from "./bot-payloads";
import { stackOrigin } from "./bot-stack";
import { alreadyBookedMessage, bookedMessage, bookingsMessage, confirmBookMessage, emptyCatalogMessage, eventNotFoundMessage, failureMessage, helpMessage, menuMessage, noSeatsMessage, nothingFoundMessage, picksMessage, plansMessage, rateLimitMessage, todayMessage, unknownTextMessage, waitlistMessage, welcomeMessage, wheretoQuestion, wheretoResultMessage, type BotMedia } from "./bot-renderer";
import { type BotInbound, type BotMessageBody, parseUpdates } from "./bot.types";

/** The command menu MAX shows above the input. Names are slash-command labels, descriptions ≤128 chars. */
export const BOT_COMMANDS: ReadonlyArray<{ name: string; description: string }> = [
  { name: "start", description: "Открыть афишу в приложении" },
  { name: "today", description: "Что происходит сегодня рядом" },
  { name: "whereto", description: "Подобрать, куда пойти" },
  { name: "plans", description: "Мои планы" },
  { name: "bookings", description: "Мои брони" },
  { name: "help", description: "Что умеет бот" },
  { name: "menu", description: "Главное меню" },
];

/** One-word greetings and menu words. A multi-word message is an NL request, so it never lands here. */
const GREETING_WORDS = new Set(["start", "help", "menu", "меню", "помощь", "привет", "здравствуй", "здравствуйте", "хай", "бот", "начать", "старт"]);
/** First-open words: MAX's «Начать» button and /start should get the welcome card, not a search. */
const START_WORDS = new Set(["start", "начать", "старт"]);
/** Phrases people type to ask what the bot does. Checked against the whole trimmed message, so word order does not matter. */
const MENU_PHRASES = ["что умеешь", "что ты умеешь", "что можешь", "помоги", "как пользоваться"];

/** The bot answers a DM. In a group or channel a reply would address everyone about one person's plans. */
export function isDialog(inbound: BotInbound): boolean {
  return inbound.chatType === null || inbound.chatType === "dialog";
}

/** The leading command word ("/today", "today") when the whole message is that word; null otherwise. */
export function commandOf(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const withoutSlash = trimmed.replace(/^\/+/, "");
  if (withoutSlash === "" || /[\s]/.test(withoutSlash)) return null;
  return withoutSlash;
}

export function isMenuWord(text: string): boolean {
  const command = commandOf(text);
  if (command !== null && GREETING_WORDS.has(command)) return true;
  const phrase = text.trim().toLowerCase();
  return MENU_PHRASES.some((candidate) => phrase === candidate || phrase === `/${candidate}`);
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(TodayService) private readonly today: TodayService,
    @Inject(WheretoService) private readonly whereto: WheretoService,
    @Inject(AssistService) private readonly assist: AssistService,
    @Inject(CalendarService) private readonly calendar: CalendarService,
    @Inject(PlansService) private readonly plans: PlansService,
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}

  /** Validate a webhook body into inbound rows. Exposed so the controller stays a thin adapter. */
  parse(body: unknown): BotInbound[] {
    return parseUpdates(body);
  }

  /**
   * Process one inbound update. Best-effort and non-throwing: a failure renders an honest card rather
   * than bubbling up, because the webhook answers 200 regardless and MAX retries a non-200 for hours.
   */
  async handleInbound(inbound: BotInbound): Promise<void> {
    if (!isDialog(inbound)) return;
    if (inbound.chatId !== null) void this.bot.sendTyping(inbound.chatId);
    try {
      const user = await this.users.upsertFromMax({ id: Number(inbound.maxUserId), first_name: inbound.userName ?? "Гость" });
      const body = await this.route(user.id, inbound);
      await this.deliver(inbound, body);
    } catch (error: unknown) {
      this.logger.warn(`Bot update failed: ${describe(error)}`);
      await this.deliver(inbound, failureMessage(this.media()));
    }
  }

  private async route(userId: string, inbound: BotInbound): Promise<BotMessageBody> {
    const media = this.media();
    if (inbound.kind === "start") return welcomeMessage(media, inbound.userName);
    if (inbound.kind === "callback") return this.routeCallback(userId, inbound.callbackPayload, inbound.userName);
    return this.routeText(userId, inbound.text, inbound.userName);
  }

  private async routeText(userId: string, raw: string, userName: string | null): Promise<BotMessageBody> {
    const media = this.media();
    const text = raw.trim();
    const command = commandOf(text);
    if (command !== null && START_WORDS.has(command)) return welcomeMessage(media, userName);
    if (command === "today") return this.todayCard(userId);
    if (command === "plans") return this.plansCard(userId);
    if (command === "bookings") return this.bookingsCard(userId);
    if (command === "whereto") return wheretoQuestion("company", {}, media);
    if (command === "help") return helpMessage(media);
    if (command === "menu") return menuMessage(media);
    if (text === "" || isMenuWord(text)) return menuMessage(media);

    // Everything else is a natural-language request: the same parser and matcher the in-app assist uses.
    try {
      const result = await this.assist.suggest(userId, text);
      if (result.items.length === 0) return nothingFoundMessage(media);
      return picksMessage(media, result.summary, result.items);
    } catch (error: unknown) {
      if (error instanceof HttpException && error.getStatus() === 429) return rateLimitMessage(media);
      if (error instanceof HttpException && error.getStatus() === 400) return unknownTextMessage(media);
      this.logger.warn(`Assist search failed: ${describe(error)}`);
      return failureMessage(media);
    }
  }

  private async routeCallback(userId: string, raw: string, userName: string | null): Promise<BotMessageBody> {
    const media = this.media();
    const payload = parseBotPayload(raw);
    if (payload === null) return menuMessage(media);
    switch (payload.id) {
      case "start":
        return welcomeMessage(media, userName);
      case "menu":
        return menuMessage(media);
      case "help":
        return helpMessage(media);
      case "today":
        return this.todayCard(userId);
      case "plans":
        return this.plansCard(userId);
      case "bookings":
        return this.bookingsCard(userId);
      case "whereto":
        return this.wheretoFlow(userId, payload);
      case "confirm-book":
        return this.confirmBook(payload.eventId);
      case "book":
        return this.book(userId, payload.eventId);
      case "waitlist":
        return this.joinWaitlist(userId, payload.eventId);
    }
  }

  private async wheretoFlow(userId: string, payload: Extract<BotPayload, { id: "whereto" }>): Promise<BotMessageBody> {
    const media = this.media();
    if (payload.step === "company") return wheretoQuestion("company", {}, media);
    if (payload.step === "mood") return wheretoQuestion("mood", { company: payload.company }, media);
    if (payload.step === "budget") return wheretoQuestion("budget", { company: payload.company, mood: payload.mood }, media);
    const query = { company: payload.company, mood: payload.mood, budget: payload.budget };
    const result = await this.whereto.suggest(query, userId);
    if (result.items.length === 0) return nothingFoundMessage(media);
    return wheretoResultMessage(media, result.items, query);
  }

  private async todayCard(userId: string): Promise<BotMessageBody> {
    const media = this.media();
    const digest = await this.today.digest(userId);
    // nearbyCount 0 means the city catalog itself is empty — a data state, not a search miss.
    if (digest.cards.length === 0) return digest.summary.nearbyCount === 0 ? emptyCatalogMessage(media) : nothingFoundMessage(media);
    return todayMessage(media, digest);
  }

  private async plansCard(userId: string): Promise<BotMessageBody> {
    const cards = await this.plans.list(userId);
    return plansMessage(this.media(), cards);
  }

  private async bookingsCard(userId: string): Promise<BotMessageBody> {
    const calendar = await this.calendar.list(userId);
    return bookingsMessage(this.media(), calendar.upcoming);
  }

  private async confirmBook(eventId: string): Promise<BotMessageBody> {
    const media = this.media();
    try {
      return confirmBookMessage(media, await this.events.getPublished(eventId));
    } catch {
      return eventNotFoundMessage(media);
    }
  }

  private async book(userId: string, eventId: string): Promise<BotMessageBody> {
    const media = this.media();
    let event: Event;
    try {
      event = await this.events.getPublished(eventId);
    } catch {
      return eventNotFoundMessage(media);
    }
    try {
      const booking = await this.bookings.create(userId, eventId, null, new Date(), null, "chats");
      return bookedMessage(media, event, booking.freeSeats, event.paymentUrl);
    } catch (error: unknown) {
      return this.bookingConflict(media, event, error);
    }
  }

  private async joinWaitlist(userId: string, eventId: string): Promise<BotMessageBody> {
    const media = this.media();
    let event: Event;
    try {
      event = await this.events.getPublished(eventId);
    } catch {
      return eventNotFoundMessage(media);
    }
    try {
      const entry = await this.waitlist.join(userId, eventId);
      return waitlistMessage(media, event, entry.position);
    } catch (error: unknown) {
      // "Seats are still available" means the queue is the wrong tool — offer to book instead.
      if (isConflict(error, "Seats are still available")) return confirmBookMessage(media, event);
      if (isConflict(error, "Already on the waitlist")) return waitlistMessage(media, event, null);
      if (isConflict(error, "Already booked")) return alreadyBookedMessage(media, event);
      this.logger.warn(`Waitlist join failed: ${describe(error)}`);
      return failureMessage(media);
    }
  }

  /** A booking conflict is a normal outcome, not an error: tell the person exactly where they stand. */
  private bookingConflict(media: BotMedia, event: Event, error: unknown): BotMessageBody {
    if (isConflict(error, "Booking already exists")) return alreadyBookedMessage(media, event);
    if (isConflict(error, "No seats left")) return noSeatsMessage(media, event);
    this.logger.warn(`Booking failed: ${describe(error)}`);
    return failureMessage(media);
  }

  private async deliver(inbound: BotInbound, body: BotMessageBody): Promise<void> {
    // A button press edits the message that carried the keyboard, so the chat reads as one evolving
    // card. If the edit fails (message deleted, or the client refused), fall back to a new message.
    if (inbound.kind === "callback" && inbound.callbackId !== "") {
      const edited = await this.bot.answerCallback(inbound.callbackId, { message: body });
      if (edited) return;
    }
    await this.bot.sendRich(inbound.maxUserId, body);
  }

  /** Where covers and the hero image live, and the bot's public name for open_app buttons. */
  private media(): BotMedia {
    return {
      baseUrl: stackOrigin({
        BOT_PUBLIC_URL: this.config.get<string>("BOT_PUBLIC_URL"),
        PUBLIC_APP_URL: this.config.get<string>("PUBLIC_APP_URL"),
        AUTH_ALLOW_BROWSER: this.config.get("AUTH_ALLOW_BROWSER"),
      }),
      webApp: this.webAppName(),
    };
  }

  private webAppName(): string {
    const base = this.config.get<string>("MAX_APP_URL") ?? DEFAULT_MAX_APP_URL;
    try {
      const segment = new URL(base).pathname.replace(/^\/+|\/+$/g, "");
      return segment !== "" ? segment : DEFAULT_MAX_BOT_USERNAME;
    } catch {
      return DEFAULT_MAX_BOT_USERNAME;
    }
  }
}

function isConflict(error: unknown, message: string): boolean {
  return error instanceof HttpException && error.getStatus() === 409 && String(error.message).includes(message);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
