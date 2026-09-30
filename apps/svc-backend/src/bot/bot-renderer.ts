// START_MODULE_CONTRACT
// PURPOSE: Render every message the bot sends — markdown text and inline keyboard — from product data, in the voice and vocabulary the mini-app already uses.
// SCOPE: Pure functions over DTOs: welcome, menu, today digest, the three «куда пойти» questions and their results, NL picks, booking confirm/done, waitlist, plans, bookings, help, and the honest empty/error states. No HTTP, no database, no state. Messages stay text-only: a photo attachment makes MAX fetch the file before the keyboard answers, so button presses felt slow. Open_app buttons carry the mini-app start_param, callback buttons carry bot-payloads strings. Every card except welcome ends with Назад to the start screen; the whereto wizard steps back one question.
// DEPENDS: @max-events/api-contracts, ../time/human-when, ./bot-payloads, ./bot.types
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BotMedia - public origin + bot name; absoluteCover/heroUrl/bannerUrl/coverUrls turn stored paths into URLs MAX can fetch
// - CATEGORY_LABELS - ru labels per event category, same words the mini-app shows
// - eventCard - one event as a markdown block: title, category, when, price, optional context labels
// - welcomeMessage - first hello: invite into the mini-app, then say both the app and the bot work; no Назад
// - menuMessage - the main keyboard: today, where-to, plans, bookings, help, open app, Назад
// - todayMessage - TodayService digest: summary counters + top cards with their context labels
// - wheretoQuestion - one step of the guided picker with its answer buttons
// - wheretoResultMessage - five picks: numbered cards, book-in-chat callbacks, open-in-app rows
// - picksMessage - NL assist answer: its own summary plus picks with explanations
// - confirmBookMessage - the event being booked and the yes/back pair
// - bookedMessage - booking done, reminder promised, ticket and menu buttons
// - waitlistMessage - no seats left, position in the queue
// - plansMessage - active plans with meeting point and time
// - bookingsMessage - upcoming bookings from the calendar
// - helpMessage - what the bot can do without opening the app
// - emptyCatalogMessage / nothingFoundMessage / unknownTextMessage / failureMessage / rateLimitMessage / noSeatsMessage / alreadyBookedMessage / eventNotFoundMessage - honest dead ends that always leave a way back
// - menuKeyboard - the keyboard the start screen and menu share
// - backButton / withBack - full-width Назад; default payload is start, whereto passes the previous step
// - pickKeyboard - shared builder: book-in-chat callback rows then open_app rows
// - pluralRu - ru plural form for the participant count
// END_MODULE_MAP

import type { AssistPick, CalendarEntry, Event, PlanCard, TodayEventCard, TodayResponse } from "@max-events/api-contracts";
import { humanWhen, miniappLink } from "../time/human-when";
import { botPayload, startAppPayload, type BotPayload, type WheretoBudget, type WheretoCompany, type WheretoMood, type WheretoStep } from "./bot-payloads";
import { botRich, type BotButton, type BotKeyboard, type BotMessageBody } from "./bot.types";

/** What the renderer needs to build absolute media URLs and open_app buttons. */
export type BotMedia = {
  /** Public HTTPS origin serving the mini-app static files, or null when the stack has none. */
  baseUrl: string | null;
  /** The bot's public name for open_app buttons (MAX requires it). */
  webApp: string;
};

export const CATEGORY_LABELS: Record<Event["category"], string> = {
  afisha: "Афиша",
  volunteering: "Волонтёрство",
  tourism: "Туризм",
  sport: "Спорт",
};

/** Button labels, same words the mini-app uses so the two surfaces read as one product. */
const COMPANY_LABELS: Record<WheretoCompany, string> = { alone: "Я один", friends: "С друзьями", partner: "С парой", kids: "С детьми" };
const MOOD_LABELS: Record<WheretoMood, string> = { active: "Событие", calm: "Прогулка", unusual: "Прогулка и событие" };
const BUDGET_LABELS: Record<WheretoBudget, string> = { free: "Бесплатно", under_3000: "До 3000 ₽", any: "Любой" };

const COMPANY_ORDER: readonly WheretoCompany[] = ["alone", "friends", "partner", "kids"];
const MOOD_ORDER: readonly WheretoMood[] = ["active", "calm", "unusual"];
const BUDGET_ORDER: readonly WheretoBudget[] = ["free", "under_3000", "any"];

/** Open_app rows hold at most 3 buttons on MAX; callbacks hold 7, but 3 keeps them readable. */
const OPEN_APP_PER_ROW = 3;
const CALLBACK_PER_ROW = 3;

const MAX_CARDS = 5;
const TITLE_MAX = 28;

export function absoluteCover(media: BotMedia, coverUrl: string | null | undefined): string | null {
  const cover = coverUrl?.trim();
  if (!cover) return null;
  if (/^https?:\/\//i.test(cover)) return cover;
  const base = media.baseUrl?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}${cover.startsWith("/") ? "" : "/"}${cover}`;
}

/** Branded chat banners under /bot/*.jpg. Same rule as covers: no public origin, no image. */
export function bannerUrl(media: BotMedia, name: "hero" | "today" | "whereto"): string | null {
  return absoluteCover(media, `/bot/${name}.jpg`);
}

/** The welcome hero. Same file the entry screen's wordmark sits on. */
export function heroUrl(media: BotMedia): string | null {
  return bannerUrl(media, "hero");
}

/** Absolute cover URLs, unique, capped at MAX_CARDS so a chat bubble stays a gallery, not a dump. */
export function coverUrls(media: BotMedia, covers: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const cover of covers) {
    const url = absoluteCover(media, cover);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_CARDS) break;
  }
  return urls;
}

function callback(text: string, payload: string): BotButton {
  return { type: "callback", text, payload };
}

function openApp(media: BotMedia, text: string, prefix: "event" | "plan" | "booking" | "list" | "place" | "onboarding" | "calendar" | null, id?: string): BotButton {
  // prefix null opens the mini-app at home: its OnboardingGate runs the first-time flow itself,
  // so the bot never forces an existing user through the settings' onboarding replay route.
  const payload = prefix === null ? "" : startAppPayload(prefix, id);
  return payload === "" ? { type: "open_app", text, web_app: media.webApp } : { type: "open_app", text, web_app: media.webApp, payload };
}

function linkButton(text: string, url: string | null): BotButton[] {
  return url ? [{ type: "link", text, url }] : [];
}

/** 1 человек / 2 человека / 5 человек — the count is data, so the ending cannot be baked in. */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const rule = new Intl.PluralRules("ru").select(count);
  return rule === "one" ? one : rule === "few" ? few : many;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) out.push(rows.slice(index, index + size));
  return out;
}

/** Truncate for a button: MAX cuts at the edges anyway, so an ellipsis reads better than a clipped word. */
function buttonTitle(title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  return clean.length <= TITLE_MAX ? clean : `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

function formatRub(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(amount).replace(/\u00a0/g, " ")} ₽`;
}

function priceLine(event: Event): string {
  if (!event.isPaid && (event.priceRub === null || event.priceRub === 0)) return "Вход свободный";
  if (event.priceRub === null) return "Цена уточняется";
  return formatRub(event.priceRub);
}

/** Today's context labels are the product's pitch: distance, who else goes, free entry, seats left. */
function labelLine(card: TodayEventCard): string | null {
  const parts: string[] = [];
  for (const label of card.labels) {
    if (label.kind === "distance") parts.push(`${label.minutes} мин пешком`);
    else if (label.kind === "friend_attending") parts.push(`Идёт ${label.friendName}`);
    else if (label.kind === "free_entry") parts.push("Вход свободный");
    else if (label.kind === "spots_left") parts.push(`осталось ${label.count} мест`);
    else if (label.kind === "after_me") parts.push(`после ${label.fromCategory} — твоё`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function eventCard(event: Event, now = new Date(), extra: string | null = null): string {
  const lines = [`**${event.title}**`, `${CATEGORY_LABELS[event.category]} · ${humanWhen(new Date(event.startsAt), now)} · ${priceLine(event)}`];
  if (extra) lines.push(extra);
  return lines.join("\n");
}

function numberedCard(index: number, event: Event, now: Date, extra: string | null): string {
  const lines = eventCard(event, now, extra).split("\n");
  return [`${index}. ${lines[0]}`, ...lines.slice(1)].join("\n");
}

/**
 * The keyboard under a list of picks: one callback row to book in chat (the reason to talk to the bot
 * at all), then open_app rows for browsing. Both carry the same numbering as the text above.
 */
export function pickKeyboard(media: BotMedia, events: readonly Event[], bookable = CALLBACK_PER_ROW): BotKeyboard {
  const picks = events.slice(0, MAX_CARDS);
  const bookRows = chunk(
    picks.slice(0, bookable).map((event, index) => callback(`${index + 1}. Записаться`, botPayload({ id: "confirm-book", eventId: event.id }))),
    CALLBACK_PER_ROW,
  );
  const openRows = chunk(
    picks.map((event, index) => openApp(media, `${index + 1}. ${buttonTitle(event.title)}`, "event", event.id)),
    OPEN_APP_PER_ROW,
  );
  return [...bookRows, ...openRows];
}

/** The way back from every dead end: the menu keyboard plus a button into the app. */
export function menuKeyboard(media: BotMedia): BotKeyboard {
  return [
    [callback("Что сегодня", botPayload({ id: "today" })), callback("Куда пойти", botPayload({ id: "whereto", step: "company" }))],
    [callback("Мои планы", botPayload({ id: "plans" })), callback("Мои брони", botPayload({ id: "bookings" }))],
    [callback("Что умеет бот", botPayload({ id: "help" })), openApp(media, "Открыть приложение", null)],
  ];
}

/** Full-width Назад. Default target is the welcome card; the whereto wizard passes the previous step. */
export function backButton(payload: BotPayload = { id: "start" }): BotButton {
  return callback("Назад", botPayload(payload));
}

export function withBack(keyboard: BotKeyboard, payload: BotPayload = { id: "start" }): BotKeyboard {
  return [...keyboard, [backButton(payload)]];
}

export function welcomeMessage(media: BotMedia, firstName: string | null): BotMessageBody {
  const name = firstName ? `, ${firstName}` : "";
  const text = [`# Привет${name}`, "", "Открой афишу в приложении.", "", "Можно в мини-приложении и прямо здесь, в боте."].join("\n");
  const keyboard: BotKeyboard = [[openApp(media, "Открыть афишу в приложении", null)], ...menuKeyboard(media)];
  return botRich(text, { keyboard, markdown: true });
}

export function menuMessage(media: BotMedia): BotMessageBody {
  const text = ["# Чем помочь?", "", "**Что сегодня** — подборка рядом. **Куда пойти** — три вопроса и пять вариантов. Планы и брони — то, что уже стоит в календаре. Записать могу прямо здесь."].join("\n");
  return botRich(text, { keyboard: withBack(menuKeyboard(media)), markdown: true });
}

export function helpMessage(media: BotMedia): BotMessageBody {
  const text = [
    "# Что умеет бот",
    "",
    "• **Приложение** — карта, друзья, онбординг: кнопка «Открыть афишу в приложении».",
    "• **Команды** — набери **/** в поле ввода: /start, /today, /whereto, /plans, /bookings, /help.",
    "• **Что сегодня** — сколько событий рядом, сколько подходит тебе и на сколько идут друзья.",
    "• **Куда пойти** — компания, настроение, бюджет; пять вариантов и запись в один тап.",
    "• **Поиск словами** — напиши «джаз вечером до 3000» или «куда сходить с детьми в субботу».",
    "• **Мои планы** и **Мои брони** — что запланировано и когда встречаемся.",
    "• **Запись и лист ожидания** — без приложения; если мест нет, поставлю в очередь и напишу, когда освободится.",
    "• **Напоминания** — перед стартом пришлю сообщение с временем и местом.",
    "",
    "Карта, афиша целиком, планы с друзьями, голосования и достижения — кнопка «Открыть приложение».",
  ].join("\n");
  return botRich(text, { keyboard: withBack(menuKeyboard(media)), markdown: true });
}

export function todayMessage(media: BotMedia, digest: TodayResponse, now = new Date()): BotMessageBody {
  const { nearbyCount, suitableCount, withFriendsCount } = digest.summary;
  const counters = `${nearbyCount} рядом · ${suitableCount} подходят тебе · ${withFriendsCount} с друзьями`;
  const cards = digest.cards.slice(0, MAX_CARDS);
  const events = cards.map((card) => card.event);
  const lines = ["# Что сегодня", "", counters, ""];
  cards.forEach((card, index) => {
    lines.push(numberedCard(index + 1, card.event, now, labelLine(card)), "");
  });
  const keyboard: BotKeyboard = [...pickKeyboard(media, events), [openApp(media, "Вся афиша на сегодня", null)]];
  return botRich(lines.join("\n").trimEnd(), { keyboard: withBack(keyboard), markdown: true });
}

export function wheretoQuestion(step: WheretoStep, answers: { company?: WheretoCompany | null; mood?: WheretoMood | null } = {}, _media?: BotMedia): BotMessageBody {
  if (step === "company") {
    return botRich("# Куда пойти · шаг 1 из 3\n\nС кем идёшь?", {
      keyboard: withBack([COMPANY_ORDER.map((value) => callback(COMPANY_LABELS[value], botPayload({ id: "whereto", step: "mood", company: value })))]),
      markdown: true,
    });
  }
  if (step === "mood") {
    const company = answers.company;
    return botRich(`# Куда пойти · шаг 2 из 3\n\n${company ? `${COMPANY_LABELS[company]}. ` : ""}Что по настроению?`, {
      keyboard: withBack(
        [MOOD_ORDER.map((value) => callback(MOOD_LABELS[value], company ? botPayload({ id: "whereto", step: "budget", company, mood: value }) : botPayload({ id: "whereto", step: "company" })))],
        { id: "whereto", step: "company" },
      ),
      markdown: true,
    });
  }
  const company = answers.company;
  const mood = answers.mood;
  const ready = company !== null && company !== undefined && mood !== null && mood !== undefined;
  return botRich(`# Куда пойти · шаг 3 из 3\n\n${ready ? `${COMPANY_LABELS[company]}, ${MOOD_LABELS[mood]}. ` : ""}Бюджет?`, {
    keyboard: withBack(
      [BUDGET_ORDER.map((value) => callback(BUDGET_LABELS[value], ready ? botPayload({ id: "whereto", step: "go", company, mood, budget: value }) : botPayload({ id: "whereto", step: "company" })))],
      company ? { id: "whereto", step: "mood", company } : { id: "start" },
    ),
    markdown: true,
  });
}

export function wheretoResultMessage(media: BotMedia, events: readonly Event[], answers: { company: WheretoCompany; mood: WheretoMood; budget: WheretoBudget }, now = new Date()): BotMessageBody {
  if (events.length === 0) return nothingFoundMessage(media);
  const context = `${COMPANY_LABELS[answers.company]} · ${MOOD_LABELS[answers.mood]} · ${BUDGET_LABELS[answers.budget]}`;
  const shown = events.slice(0, MAX_CARDS);
  const lines = ["# Куда пойти", "", context, ""];
  shown.forEach((event, index) => {
    lines.push(numberedCard(index + 1, event, now, null), "");
  });
  lines.push("Записаться можно прямо здесь — или открыть карточку в приложении.");
  const keyboard: BotKeyboard = [...pickKeyboard(media, events), [callback("Другие варианты", botPayload({ id: "whereto", step: "company" })), openApp(media, "Афиша целиком", null)]];
  return botRich(lines.join("\n"), { keyboard: withBack(keyboard, { id: "whereto", step: "budget", company: answers.company, mood: answers.mood }), markdown: true });
}

export function picksMessage(media: BotMedia, summary: string, items: readonly AssistPick[], now = new Date()): BotMessageBody {
  if (items.length === 0) return nothingFoundMessage(media);
  const shown = items.slice(0, MAX_CARDS);
  const events = shown.map((item) => item.event);
  const lines = [`# ${summary}`, ""];
  shown.forEach((item, index) => {
    lines.push(numberedCard(index + 1, item.event, now, item.explanation), "");
  });
  lines.push("Нажми «Записаться», чтобы оформить без приложения.");
  const keyboard: BotKeyboard = [...pickKeyboard(media, events), [openApp(media, "Открыть афишу", null)]];
  return botRich(lines.join("\n"), { keyboard: withBack(keyboard), markdown: true });
}

export function confirmBookMessage(media: BotMedia, event: Event, now = new Date()): BotMessageBody {
  // bookedCount is optional on the contract: a catalog card carries it, a bare event may not.
  const seats = event.remainingSeats ?? (event.capacity !== null && event.bookedCount !== undefined ? Math.max(0, event.capacity - event.bookedCount) : null);
  const extra = seats !== null ? `Свободных мест: ${seats}` : null;
  const text = ["# Записаться?", "", eventCard(event, now, extra), "", event.isPaid ? "Оплата — на странице организатора: после записи пришлю ссылку." : "Запись бесплатная."].join("\n");
  const keyboard: BotKeyboard = [[callback("Да, записать", botPayload({ id: "book", eventId: event.id }))], [callback("В лист ожидания", botPayload({ id: "waitlist", eventId: event.id }))]];
  return botRich(text, { keyboard: withBack(keyboard), markdown: true });
}

export function bookedMessage(media: BotMedia, event: Event, freeSeats: number | null, paymentUrl: string | null, now = new Date()): BotMessageBody {
  const lines = ["# Готово, ты записан", "", eventCard(event, now, freeSeats !== null ? `Свободных мест осталось: ${freeSeats}` : null), "", "Напомню перед началом — сообщением здесь, в боте."];
  const keyboard: BotKeyboard = [[...linkButton("Оплатить на сайте организатора", paymentUrl), openApp(media, "Карточка события", "event", event.id)], [callback("Мои брони", botPayload({ id: "bookings" }))]];
  return botRich(lines.join("\n"), { keyboard: withBack(keyboard), markdown: true });
}

export function waitlistMessage(media: BotMedia, event: Event, position: number | null): BotMessageBody {
  const where = position !== null ? `Ты ${position}-й в очереди.` : "Ты в очереди.";
  const text = ["# Мест нет — ты в листе ожидания", "", eventCard(event), "", where, "Как только место освободится, напишу сюда и дам время на подтверждение."].join("\n");
  return botRich(text, { keyboard: withBack([[callback("Мои брони", botPayload({ id: "bookings" }))]]), markdown: true });
}

export function plansMessage(media: BotMedia, cards: readonly PlanCard[], now = new Date()): BotMessageBody {
  if (cards.length === 0) {
    return botRich("# Мои планы\n\nПланов пока нет. Собери первый: найди событие и нажми «Записаться», а план создам сам — со временем встречи и напоминанием.", { keyboard: withBack([[callback("Что сегодня", botPayload({ id: "today" }))]]), markdown: true });
  }
  const lines = ["# Мои планы", ""];
  const shown = cards.slice(0, MAX_CARDS);
  shown.forEach((card, index) => {
    const plan = card.plan;
    // The host is not among participants — they are the invited friends, so the party is one bigger.
    const company = plan.participants.length;
    lines.push(`${index + 1}. **${card.event.title}**`, `   Сбор: ${humanWhen(new Date(plan.meetingAt), now)}, ${plan.meetingPoint}`, `   ${company === 0 ? "Ты один" : `Ты и ещё ${company} ${pluralRu(company, "человек", "человека", "человек")}`}`, "");
  });
  const keyboard: BotKeyboard = [
    ...chunk(
      shown.map((card, index) => openApp(media, `${index + 1}. ${buttonTitle(card.event.title)}`, "plan", card.plan.id)),
      OPEN_APP_PER_ROW,
    ),
    [openApp(media, "Календарь", "calendar")],
  ];
  return botRich(lines.join("\n").trimEnd(), { keyboard: withBack(keyboard), markdown: true });
}

export function bookingsMessage(media: BotMedia, entries: readonly CalendarEntry[], now = new Date()): BotMessageBody {
  if (entries.length === 0) {
    return botRich("# Мои брони\n\nПока ни на что не записан. Покажу, что сегодня рядом?", { keyboard: withBack([[callback("Что сегодня", botPayload({ id: "today" })), callback("Куда пойти", botPayload({ id: "whereto", step: "company" }))]]), markdown: true });
  }
  const lines = ["# Мои брони", ""];
  const shown = entries.slice(0, MAX_CARDS);
  shown.forEach((entry, index) => {
    const place = entry.place?.title;
    lines.push(numberedCard(index + 1, entry.event, now, place ? place : null), "");
  });
  const keyboard: BotKeyboard = [
    ...chunk(
      shown.map((entry, index) => openApp(media, `${index + 1}. ${buttonTitle(entry.event.title)}`, "event", entry.event.id)),
      OPEN_APP_PER_ROW,
    ),
    [openApp(media, "Календарь", "calendar")],
  ];
  return botRich(lines.join("\n").trimEnd(), { keyboard: withBack(keyboard), markdown: true });
}

export function emptyCatalogMessage(media: BotMedia): BotMessageBody {
  const text = "# Афиша пуста\n\nСобытий в каталоге пока нет — нечего предложить. Это честно: как только организаторы добавят события, подборка заработает.";
  return botRich(text, { keyboard: withBack([[openApp(media, "Открыть приложение", null)]]), markdown: true });
}

export function nothingFoundMessage(media: BotMedia): BotMessageBody {
  const text = "# Ничего не нашлось\n\nПод эти условия в ближайшей афише ничего не подходит. Попробуй другой бюджет или настроение — или посмотри, что есть сегодня.";
  return botRich(text, { keyboard: withBack([[callback("Куда пойти", botPayload({ id: "whereto", step: "company" })), callback("Что сегодня", botPayload({ id: "today" }))]]), markdown: true });
}

export function unknownTextMessage(media: BotMedia): BotMessageBody {
  const text = "# Не разобрал\n\nМогу подобрать событие по словам («джаз вечером до 3000»), показать, что сегодня рядом, или записать на событие. Выбери кнопку ниже или напиши своими словами.";
  return botRich(text, { keyboard: withBack(menuKeyboard(media)), markdown: true });
}

export function failureMessage(media: BotMedia): BotMessageBody {
  const text = "# Что-то пошло не так\n\nНе получилось выполнить это действие. Данные целы — попробуй ещё раз или начни с меню.";
  return botRich(text, { keyboard: withBack(menuKeyboard(media)), markdown: true });
}

export function noSeatsMessage(media: BotMedia, event: Event, now = new Date()): BotMessageBody {
  const text = ["# Мест не осталось", "", eventCard(event, now), "", "Могу поставить тебя в лист ожидания — напишу сюда, как только место освободится, и дам время на подтверждение."].join("\n");
  return botRich(text, {
    keyboard: withBack([[callback("В лист ожидания", botPayload({ id: "waitlist", eventId: event.id }))], [callback("Что сегодня", botPayload({ id: "today" }))]]),
    markdown: true,
  });
}

export function rateLimitMessage(media: BotMedia): BotMessageBody {
  const text = "# Слишком часто\n\nЗапросов было много — дай мне минуту. Потом спроси ещё раз или выбери кнопку.";
  return botRich(text, { keyboard: withBack([[callback("Что сегодня", botPayload({ id: "today" }))]]), markdown: true });
}

export function alreadyBookedMessage(media: BotMedia, event: Event, now = new Date()): BotMessageBody {
  const text = ["# Ты уже записан", "", eventCard(event, now, null), "", "Повторная запись не нужна — напомню перед началом."].join("\n");
  return botRich(text, { keyboard: withBack([[callback("Мои брони", botPayload({ id: "bookings" })), openApp(media, "Карточка события", "event", event.id)]]), markdown: true });
}

export function eventNotFoundMessage(media: BotMedia): BotMessageBody {
  const text = "# Событие недоступно\n\nКарточка удалена или снята с публикации. Покажу, что есть сейчас.";
  return botRich(text, { keyboard: withBack([[callback("Что сегодня", botPayload({ id: "today" }))]]), markdown: true });
}

/** The mini-app link as plain text, for the rare client that renders no buttons. */
export function appLinkText(payload: string): string | null {
  return miniappLink(payload);
}
