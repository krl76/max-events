import { describe, expect, it } from "vitest";
import type { AssistPick, CalendarEntry, Event, PlanCard, TodayResponse } from "@max-events/api-contracts";
import { botPayload } from "./bot-payloads";
import { absoluteCover, alreadyBookedMessage, coverUrls, bookedMessage, bookingsMessage, confirmBookMessage, emptyCatalogMessage, eventCard, eventNotFoundMessage, failureMessage, helpMessage, heroUrl, menuKeyboard, menuMessage, noSeatsMessage, nothingFoundMessage, picksMessage, plansMessage, rateLimitMessage, todayMessage, unknownTextMessage, waitlistMessage, welcomeMessage, wheretoQuestion, wheretoResultMessage, type BotMedia } from "./bot-renderer";
import type { BotButton, BotInlineKeyboardAttachment, BotMessageBody } from "./bot.types";

const eventId = "00000000-0000-4000-8000-0000000000e1";
const planId = "00000000-0000-4000-8000-0000000000p1";
const now = new Date("2026-09-12T10:00:00Z");

const media: BotMedia = { baseUrl: "https://events.versacegus.cc", webApp: "t691_hakaton_max_bot" };
const noBase: BotMedia = { baseUrl: null, webApp: "t691_hakaton_max_bot" };

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: eventId,
    title: "Джаз в Нескучном саду",
    description: "Трио играет у летней площадки",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: "2026-09-12T17:00:00.000Z",
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    chatLink: null,
    promoted: false,
    published: true,
    bookingOpensAt: null,
    weather: null,
    coverUrl: "/covers/jazz.jpg",
    bookedCount: 3,
    ...overrides,
  } as Event;
}

function today(cards: Array<{ event: Event; labels?: unknown[] }>, summary = { nearbyCount: 12, suitableCount: 3, withFriendsCount: 2 }): TodayResponse {
  return {
    summary,
    cards: cards.map((card) => ({ event: card.event, labels: (card.labels ?? []) as TodayResponse["cards"][number]["labels"] })),
    buckets: { nearbyIds: cards.map((card) => card.event.id), suitableIds: [], friendIds: [] },
  } as TodayResponse;
}

function keyboardOf(body: BotMessageBody): BotButton[][] {
  const attachment = body.attachments?.find((row): row is BotInlineKeyboardAttachment => row.type === "inline_keyboard");
  return attachment?.payload.buttons ?? [];
}

function imageOf(body: BotMessageBody): string | null {
  const attachment = body.attachments?.find((row) => row.type === "image");
  return attachment && "payload" in attachment && "url" in attachment.payload ? attachment.payload.url : null;
}

function imagesOf(body: BotMessageBody): string[] {
  return (body.attachments ?? []).flatMap((row) => (row.type === "image" && "url" in row.payload ? [row.payload.url] : []));
}

function callbackPayloads(rows: BotButton[][]): string[] {
  return rows.flat().flatMap((button) => (button.type === "callback" ? [button.payload] : []));
}

function openAppPayloads(rows: BotButton[][]): Array<{ text: string; payload: string; webApp: string }> {
  return rows.flat().flatMap((button) => (button.type === "open_app" ? [{ text: button.text, payload: button.payload ?? "", webApp: button.web_app }] : []));
}

describe("absoluteCover", () => {
  it("joins a stored site path onto the public origin", () => {
    expect(absoluteCover(media, "/covers/jazz.jpg")).toBe("https://events.versacegus.cc/covers/jazz.jpg");
    expect(absoluteCover(media, "covers/jazz.jpg")).toBe("https://events.versacegus.cc/covers/jazz.jpg");
    expect(absoluteCover({ baseUrl: "https://events.versacegus.cc/", webApp: "bot" }, "/covers/jazz.jpg")).toBe("https://events.versacegus.cc/covers/jazz.jpg");
  });

  it("passes an already absolute URL through and stays null without a base", () => {
    expect(absoluteCover(media, "https://cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg");
    expect(absoluteCover(noBase, "/covers/jazz.jpg")).toBeNull();
    expect(absoluteCover(media, null)).toBeNull();
    expect(absoluteCover(media, "")).toBeNull();
  });

  it("points the hero at /bot/hero.jpg under the same rule", () => {
    expect(heroUrl(media)).toBe("https://events.versacegus.cc/bot/hero.jpg");
    expect(heroUrl(noBase)).toBeNull();
  });
});

describe("cover gallery", () => {
  it("keeps unique absolute covers and drops blanks", () => {
    expect(coverUrls(media, ["/covers/jazz.jpg", "/covers/jazz.jpg", null, "/covers/yoga.jpg"])).toEqual(["https://events.versacegus.cc/covers/jazz.jpg", "https://events.versacegus.cc/covers/yoga.jpg"]);
  });
});

describe("eventCard", () => {
  it("reads title, category, Moscow clock time and price", () => {
    const card = eventCard(event({ startsAt: "2026-09-12T17:00:00.000Z" }), now);
    expect(card).toContain("**Джаз в Нескучном саду**");
    expect(card).toContain("Афиша");
    expect(card).toContain("сегодня в 20:00");
    expect(card).toContain("Вход свободный");
  });

  it("shows the price of a paid event and appends the context line", () => {
    expect(eventCard(event({ isPaid: true, priceRub: 1800, paymentUrl: "https://pay.example" }), now, "Идёт Анна")).toContain("1 800 ₽");
    expect(eventCard(event(), now, "10 мин пешком")).toContain("10 мин пешком");
  });
});

describe("welcomeMessage", () => {
  it("greets by first name and both ways in, without a photo so the keyboard answers at once", () => {
    const body = welcomeMessage(media, "Михаил");
    expect(body.text).toContain("Михаил");
    expect(body.text).toContain("Открой афишу в приложении");
    expect(body.text).toContain("Набери **/**");
    expect(body.format).toBe("markdown");
    expect(imageOf(body)).toBeNull();
    const opens = openAppPayloads(keyboardOf(body));
    // No start_param: the app's own OnboardingGate runs the first-time flow, and an existing user lands on the feed.
    expect(opens[0]).toMatchObject({ payload: "", webApp: "t691_hakaton_max_bot" });
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "today" }));
    expect(callbackPayloads(keyboardOf(body))).not.toContain(botPayload({ id: "start" }));
  });

  it("greets without a name and still shows the keyboard", () => {
    const body = welcomeMessage(noBase, null);
    expect(body.text).toContain("# Привет");
    expect(imageOf(body)).toBeNull();
    expect(openAppPayloads(keyboardOf(body)).length).toBeGreaterThan(0);
  });
});

describe("menuKeyboard", () => {
  it("keeps every button a MAX open_app or callback row can carry", () => {
    const rows = menuKeyboard(media);
    expect(rows.every((row) => row.length > 0 && row.length <= 7)).toBe(true);
    expect(rows.flat().every((button) => button.type === "callback" || button.type === "open_app")).toBe(true);
    expect(callbackPayloads(rows)).toEqual([botPayload({ id: "today" }), botPayload({ id: "whereto", step: "company" }), botPayload({ id: "plans" }), botPayload({ id: "bookings" }), botPayload({ id: "help" })]);
  });
});

describe("todayMessage", () => {
  it("counts the digest and numbers the cards with their labels", () => {
    const body = todayMessage(
      media,
      today([
        { event: event(), labels: [{ kind: "free_entry" }, { kind: "spots_left", count: 12 }] },
        { event: event({ id: "00000000-0000-4000-8000-0000000000e2", title: "Лекция в Третьяковке", isPaid: true, priceRub: 700, paymentUrl: "https://pay.example" }), labels: [{ kind: "friend_attending", friendName: "Анна" }] },
      ]),
      now,
    );
    expect(body.text).toContain("12 рядом");
    expect(body.text).toContain("1. **Джаз в Нескучном саду**");
    expect(body.text).toContain("Вход свободный · осталось 12 мест");
    expect(body.text).toContain("Идёт Анна");
    expect(body.text).toContain("# Что сегодня");
    expect(body.text).toContain("2. **Лекция в Третьяковке**");
    expect(imagesOf(body)).toEqual([]);
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "confirm-book", eventId }));
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "start" }));
    expect(openAppPayloads(keyboardOf(body)).map((row) => row.payload)).toEqual(["event-00000000-0000-4000-8000-0000000000e1", "event-00000000-0000-4000-8000-0000000000e2", ""]);
  });

  it("caps at five cards so a hot day stays readable in a chat bubble", () => {
    const cards = Array.from({ length: 9 }, (_, index) => ({ event: event({ id: `00000000-0000-4000-8000-0000000000e${index}` }) }));
    const body = todayMessage(media, today(cards), now);
    expect(body.text).toContain("5. **");
    expect(body.text).not.toContain("6. **");
    expect(openAppPayloads(keyboardOf(body))).toHaveLength(6); // five picks + «Вся афиша»
    expect(body.text.length).toBeLessThanOrEqual(4000);
  });
});

describe("wheretoQuestion", () => {
  it("asks company, then mood with the company remembered, then budget with both", () => {
    const first = wheretoQuestion("company");
    expect(first.text).toContain("шаг 1 из 3");
    expect(callbackPayloads(keyboardOf(first))).toEqual([botPayload({ id: "whereto", step: "mood", company: "alone" }), botPayload({ id: "whereto", step: "mood", company: "friends" }), botPayload({ id: "whereto", step: "mood", company: "partner" }), botPayload({ id: "whereto", step: "mood", company: "kids" }), botPayload({ id: "start" })]);

    const second = wheretoQuestion("mood", { company: "friends" });
    expect(second.text).toContain("С друзьями");
    expect(callbackPayloads(keyboardOf(second))).toContain(botPayload({ id: "whereto", step: "budget", company: "friends", mood: "calm" }));
    expect(callbackPayloads(keyboardOf(second))).toContain(botPayload({ id: "whereto", step: "company" }));

    const third = wheretoQuestion("budget", { company: "friends", mood: "calm" });
    expect(third.text).toContain("шаг 3 из 3");
    expect(callbackPayloads(keyboardOf(third))).toContain(botPayload({ id: "whereto", step: "go", company: "friends", mood: "calm", budget: "free" }));
  });

  it("restarts the chain instead of asking for a lost answer", () => {
    // A payload that names a step without its context cannot be trusted; the button re-asks step 1.
    const second = wheretoQuestion("mood", {});
    expect(callbackPayloads(keyboardOf(second))).toEqual([botPayload({ id: "whereto", step: "company" }), botPayload({ id: "whereto", step: "company" }), botPayload({ id: "whereto", step: "company" }), botPayload({ id: "whereto", step: "company" })]);
  });
});

describe("wheretoResultMessage", () => {
  it("shows the chosen context and offers booking in chat", () => {
    const body = wheretoResultMessage(media, [event()], { company: "friends", mood: "calm", budget: "free" }, now);
    expect(body.text).toContain("С друзьями · Прогулка · Бесплатно");
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "confirm-book", eventId }));
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "whereto", step: "company" }));
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "whereto", step: "budget", company: "friends", mood: "calm" }));
    expect(imageOf(body)).toBeNull();
  });

  it("says honestly when nothing fits instead of inventing picks", () => {
    const body = wheretoResultMessage(media, [], { company: "alone", mood: "active", budget: "any" }, now);
    expect(body.text).toContain("Ничего не нашлось");
  });
});

describe("picksMessage", () => {
  it("leads with the assist summary and explains each pick", () => {
    const items: AssistPick[] = [{ event: event(), explanation: "По твоей истории" }];
    const body = picksMessage(media, "Нашел 1 вариант", items, now);
    expect(body.text).toContain("# Нашел 1 вариант");
    expect(body.text).toContain("По твоей истории");
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "confirm-book", eventId }));
  });

  it("falls back to the honest empty card", () => {
    expect(picksMessage(media, "Нашел 0", [], now).text).toContain("Ничего не нашлось");
  });
});

describe("booking cards", () => {
  it("asks before booking and explains where payment happens", () => {
    const free = confirmBookMessage(media, event(), now);
    expect(free.text).toContain("# Записаться?");
    expect(free.text).toContain("Запись бесплатная");
    expect(callbackPayloads(keyboardOf(free))).toEqual([botPayload({ id: "book", eventId }), botPayload({ id: "waitlist", eventId }), botPayload({ id: "start" })]);

    const paid = confirmBookMessage(media, event({ isPaid: true, priceRub: 1800, paymentUrl: "https://pay.example" }), now);
    expect(paid.text).toContain("Оплата — на странице организатора");
  });

  it("confirms the booking with the reminder promise and the organizer payment link", () => {
    const body = bookedMessage(media, event(), 9, "https://pay.example", now);
    expect(body.text).toContain("# Готово, ты записан");
    expect(body.text).toContain("Свободных мест осталось: 9");
    expect(body.text).toContain("Напомню перед началом");
    const links = keyboardOf(body)
      .flat()
      .filter((button): button is { type: "link"; text: string; url: string } => button.type === "link");
    expect(links[0]?.url).toBe("https://pay.example");
    expect(openAppPayloads(keyboardOf(body)).map((row) => row.payload)).toEqual([`event-${eventId}`]);
  });

  it("omits the payment link for a free event", () => {
    const body = bookedMessage(media, event(), null, null, now);
    expect(
      keyboardOf(body)
        .flat()
        .some((button) => button.type === "link"),
    ).toBe(false);
  });

  it("tells a person with no seats they can queue, and keeps their place honest", () => {
    const queue = noSeatsMessage(media, event(), now);
    expect(queue.text).toContain("# Мест не осталось");
    expect(callbackPayloads(keyboardOf(queue))).toContain(botPayload({ id: "waitlist", eventId }));

    expect(waitlistMessage(media, event(), 3).text).toContain("Ты 3-й в очереди");
    expect(waitlistMessage(media, event(), null).text).toContain("Ты в очереди");

    const again = alreadyBookedMessage(media, event(), now);
    expect(again.text).toContain("# Ты уже записан");
    expect(callbackPayloads(keyboardOf(again))).toContain(botPayload({ id: "bookings" }));
  });
});

describe("plansMessage", () => {
  function card(overrides: Partial<PlanCard> = {}): PlanCard {
    return {
      plan: { id: planId, hostUserId: "u", eventId, participants: [], meetingPoint: "у метро Смоленская", meetingAt: "2026-09-12T16:20:00.000Z", chatLink: null, recurringRule: null, seriesId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      event: event(),
      distanceMeters: 850,
      ...overrides,
    } as PlanCard;
  }

  it("lists the meeting point and time of each plan", () => {
    const body = plansMessage(media, [card()], now);
    expect(body.text).toContain("**Джаз в Нескучном саду**");
    expect(body.text).toContain("у метро Смоленская");
    expect(body.text).toContain("Ты один");
    expect(openAppPayloads(keyboardOf(body)).map((row) => row.payload)).toEqual([`plan-${planId}`, "calendar"]);
  });

  it("counts the invited company and offers the first plan when there are none", () => {
    const many = card({
      plan: {
        ...card().plan,
        participants: [
          { friend: {}, status: "going" },
          { friend: {}, status: "going" },
        ] as never,
      },
    });
    expect(plansMessage(media, [many], now).text).toContain("Ты и ещё 2 человека");
    const empty = plansMessage(media, [], now);
    expect(empty.text).toContain("Планов пока нет");
    expect(callbackPayloads(keyboardOf(empty))).toContain(botPayload({ id: "today" }));
  });
});

describe("bookingsMessage", () => {
  function entry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
    return {
      booking: { id: "b1", userId: "u", eventId, status: "active", createdAt: now.toISOString(), updatedAt: now.toISOString() },
      event: event(),
      place: { id: "pl1", title: "Нескучный сад" } as CalendarEntry["place"],
      ...overrides,
    } as CalendarEntry;
  }

  it("shows the upcoming bookings with their places and the calendar button", () => {
    const body = bookingsMessage(media, [entry()], now);
    expect(body.text).toContain("# Мои брони");
    expect(body.text).toContain("Нескучный сад");
    expect(openAppPayloads(keyboardOf(body)).map((row) => row.payload)).toEqual([`event-${eventId}`, "calendar"]);
  });

  it("offers today's picks to a person with nothing booked", () => {
    const body = bookingsMessage(media, [], now);
    expect(body.text).toContain("Пока ни на что не записан");
    expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "today" }));
  });
});

describe("dead ends", () => {
  it("every honest failure leaves a way back", () => {
    const bodies = [emptyCatalogMessage(media), nothingFoundMessage(media), unknownTextMessage(media), failureMessage(media), eventNotFoundMessage(media), rateLimitMessage(media), menuMessage(media), helpMessage(media)];
    for (const body of bodies) {
      expect(body.text.length).toBeGreaterThan(0);
      expect(body.text.length).toBeLessThanOrEqual(4000);
      expect(keyboardOf(body).flat().length).toBeGreaterThan(0);
      expect(callbackPayloads(keyboardOf(body))).toContain(botPayload({ id: "start" }));
      expect(imagesOf(body)).toEqual([]);
    }
  });

  it("explains an empty catalog as a data state, not a miss", () => {
    expect(emptyCatalogMessage(media).text).toContain("Афиша пуста");
    expect(nothingFoundMessage(media).text).toContain("Ничего не нашлось");
  });
});

describe("Назад and photos", () => {
  it("puts Назад on every screen after the start card, and never sends a photo", () => {
    const digest = today([{ event: event() }]);
    const bodies = [
      menuMessage(media),
      helpMessage(media),
      todayMessage(media, digest, now),
      wheretoQuestion("company"),
      wheretoQuestion("mood", { company: "friends" }),
      wheretoQuestion("budget", { company: "friends", mood: "calm" }),
      wheretoResultMessage(media, [event()], { company: "friends", mood: "calm", budget: "free" }, now),
      picksMessage(media, "Нашел 1 вариант", [{ event: event(), explanation: "По твоей истории" }], now),
      confirmBookMessage(media, event(), now),
      bookedMessage(media, event(), 9, null, now),
      waitlistMessage(media, event(), 1),
      plansMessage(media, [], now),
      bookingsMessage(media, [], now),
    ];
    for (const body of bodies) {
      const last = keyboardOf(body).at(-1)?.at(-1);
      expect(last).toMatchObject({ type: "callback", text: "Назад" });
      expect(imagesOf(body)).toEqual([]);
    }
    const welcome = welcomeMessage(media, "Михаил");
    expect(callbackPayloads(keyboardOf(welcome))).not.toContain(botPayload({ id: "start" }));
    expect(imagesOf(welcome)).toEqual([]);
  });
});
