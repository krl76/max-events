// START_MODULE_CONTRACT
// PURPOSE: NL event assist — parse via LlmProvider, match catalog, explain from history and a friend's lists.
// SCOPE: suggest(userId, query), planSaturday, and chat; one prepareQuery per call; Saturday assembly does not call the model again; keys and messages never logged; max 7 picks, max 4 day stops, max 4 chat cards.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/checkins/lists/friends
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - matchAssistEvents - filter catalog by parsed criteria
// - formatAssistSummary - README-style copy
// - nextSaturdayKey - next Saturday YYYY-MM-DD in Moscow
// - formatDaySummary - README-style copy for a generated day
// - AssistService - suggest, planSaturday, chat (chat does not call planSaturday; plan-word check stays in this file)
// END_MODULE_MAP

import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AssistGuideIdSchema, type AssistChatResponse, type AssistChatWrite, type AssistCriteria, type AssistDayResponse, type AssistGuideId, type AssistPick, type AssistResponse, type Event, type PlanCard } from "@max-events/api-contracts";
import { moscowIsoWeekday } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { PlansService } from "../plans/plans.service";

import { moscowDateKey } from "../time/moscow-date";
import { isDirectInsult, offeredChoiceIndex } from "./chat-guard";
import { LLM_PROVIDER, type AssistChatDraft, type LlmProvider } from "./llm-provider";
import { applyKeywordGenre, parseAssistQuery } from "./parse-nl";
import { AssistRateLimiter } from "./rate-limit";
import { sanitizeAssistQuery } from "./sanitize";

@Injectable()
export class AssistService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(FriendshipEntity) private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(ListEntity) private readonly lists: Repository<ListEntity>,
    @InjectRepository(ListItemEntity) private readonly listItems: Repository<ListItemEntity>,
    @Inject(PlansService) private readonly plans: PlansService,
    @Inject(AssistRateLimiter) private readonly limiter: AssistRateLimiter,
  ) {}

  async suggest(userId: string, query: string, now = new Date()): Promise<AssistResponse> {
    const cleaned = this.prepareQuery(userId, query);
    const criteria = await this.parseCriteria(cleaned);
    const catalog = (await this.events.find()).filter((row) => row.published !== false && row.startsAt.getTime() >= now.getTime()).map((row) => toEventDto(row));
    const matched = matchAssistEvents(catalog, criteria);
    const historyIds = await this.historyEventIds(userId);
    const savedIds = await this.partnerSavedEventIds(userId);
    const historyCategories = await this.historyCategories(historyIds);
    const items: AssistPick[] = matched.map((event) => {
      const fromHistory = historyIds.has(event.id) || historyCategories.has(event.category);
      const fromPartner = savedIds.has(event.id);
      return { event, explanation: explainPick(fromHistory, fromPartner) };
    });
    if (items.length === 0 && catalog.length > 0) {
      const bill = [...catalog].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)).slice(0, 4);
      return { summary: "Точного совпадения нет. Вот что есть в афише.", criteria, items: bill.map((event) => ({ event, explanation: "Из афиши" })) };
    }
    const historyCount = items.filter((row) => historyIds.has(row.event.id) || historyCategories.has(row.event.category)).length;
    const savedCount = items.filter((row) => savedIds.has(row.event.id)).length;
    return { summary: formatAssistSummary(items.length, historyCount, savedCount), criteria, items };
  }

  /**
   * «Сделай нам план на субботу»: the query goes through the same LLM parse as suggest, and the
   * criteria choose what the day is made of. When nothing matches, the day falls back to the plain
   * Saturday bill and the summary says so rather than pretending the request was honoured.
   */
  async planSaturday(userId: string, query: string, save = false, now = new Date()): Promise<AssistDayResponse> {
    const cleaned = this.prepareQuery(userId, query);
    const criteria = await this.parseCriteria(cleaned);
    return this.assembleSaturday(userId, criteria, save, now);
  }

  async chat(userId: string, input: AssistChatWrite, now = new Date()): Promise<AssistChatResponse> {
    const cleaned = this.prepareQuery(userId, input.message);
    if (isDirectInsult(cleaned)) return { silence: true, fallback: false };

    const future = await this.futureEvents(now);
    const byId = new Map(future.map((event) => [event.id, event]));
    // Index the cards the screen offered. A missing id is not renumbered; it simply does not open.
    const choiceIndex = offeredChoiceIndex(cleaned, input.offeredEventIds.length);
    const chosen = choiceIndex === null ? undefined : byId.get(input.offeredEventIds[choiceIndex] ?? "");
    if (chosen) {
      return { silence: false, fallback: false, reply: clampAssistReply(`Открываю «${chosen.title}».`), items: [{ event: chosen, explanation: "Подходит по запросу" }], openEventId: chosen.id };
    }

    const cards = future.slice(0, 12).map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, priceRub: event.priceRub, category: event.category }));
    let draft: AssistChatDraft;
    try {
      draft = await this.llm.chatTurn(cleaned, input.transcript, cards);
    } catch {
      return this.chatFallback(userId, cleaned, input.save === true, now, future);
    }
    if (draft.refuse) return { silence: true, fallback: false };
    const guides = keepGuides(draft.guides);
    if (draft.plan) {
      const day = await this.assembleSaturday(userId, draft.criteria ?? parseAssistQuery(cleaned), input.save === true, now);
      return { silence: false, fallback: false, reply: clampAssistReply(draft.reply), day, ...(guides.length > 0 ? { guides } : {}) };
    }

    const allowed = new Set<string>([...cards.map((card) => card.id), ...input.offeredEventIds.filter((id) => byId.has(id))]);
    const ids: string[] = [];
    for (const id of draft.eventIds) {
      if (!allowed.has(id) || ids.includes(id)) continue;
      ids.push(id);
    }
    const openId = draft.openEventId && allowed.has(draft.openEventId) ? draft.openEventId : null;
    if (openId && !ids.includes(openId)) ids.push(openId);
    let limited = ids.slice(0, 4);
    // openEventId has to be one of items, and items stay at most 4.
    if (openId && !limited.includes(openId)) limited = [...limited.slice(0, 3), openId];
    const drafted: AssistPick[] = limited.flatMap((id) => {
      const event = byId.get(id);
      return event ? [{ event, explanation: "Подходит по запросу" }] : [];
    });
    const hinted = parseAssistQuery(cleaned);
    const fromCatalog = hinted.genre === "any" ? [] : matchAssistEvents(future, hinted);
    const items: AssistPick[] = [];
    const seen = new Set<string>();
    for (const event of fromCatalog) {
      if (seen.has(event.id) || items.length >= 4) continue;
      seen.add(event.id);
      items.push({ event, explanation: "Подходит по запросу" });
    }
    for (const pick of drafted) {
      if (seen.has(pick.event.id) || items.length >= 4) continue;
      seen.add(pick.event.id);
      items.push(pick);
    }
    const openEventId = openId && items.some((pick) => pick.event.id === openId) ? openId : undefined;
    const offered = items.length > 0 || guides.length > 0 ? items : future.slice(0, 4).map((event) => ({ event, explanation: "Из афиши" }));
    return { silence: false, fallback: false, reply: clampAssistReply(draft.reply), ...(offered.length > 0 ? { items: offered } : {}), ...(openEventId ? { openEventId } : {}), ...(guides.length > 0 ? { guides } : {}) };
  }

  private async assembleSaturday(userId: string, criteria: AssistCriteria, save: boolean, now: Date): Promise<AssistDayResponse> {
    const date = nextSaturdayKey(now);
    const saturday = (await this.events.find())
      .filter((row) => row.published !== false && moscowDateKey(row.startsAt) === date && row.startsAt.getTime() >= now.getTime())
      .map((row) => toEventDto(row))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
    if (saturday.length === 0) throw new BadRequestException("No Saturday events found");
    const wanted = matchAssistEvents(saturday, criteria);
    const matchedIds = new Set(wanted.map((event) => event.id));
    const chosen = (wanted.length > 0 ? wanted : saturday).slice(0, 4);
    const stops = chosen.map((event) => ({ at: event.startsAt, event, explanation: matchedIds.has(event.id) ? "Подходит по запросу" : "Из субботней афиши" }));
    const first = chosen[0]!;
    const planDraft = {
      eventId: first.id,
      participantIds: [] as string[],
      meetingPoint: first.title,
      meetingAt: first.startsAt,
    };
    let plan: PlanCard | null = null;
    if (save) {
      plan = (await this.plans.findExisting(userId, planDraft.eventId, new Date(planDraft.meetingAt))) ?? (await this.plans.create(userId, planDraft));
    }
    return {
      summary: formatDaySummary(date, stops.length, matchedIds.size > 0),
      date,
      stops,
      planDraft,
      plan,
    };
  }

  private async futureEvents(now: Date): Promise<Event[]> {
    return (await this.events.find())
      .filter((row) => row.published !== false && row.startsAt.getTime() >= now.getTime())
      .map((row) => toEventDto(row))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  }

  private async chatFallback(userId: string, cleaned: string, save: boolean, now: Date, future: Event[]): Promise<AssistChatResponse> {
    const criteria = parseAssistQuery(cleaned);
    const recognized = criteriaRecognized(criteria);
    if (isAppGuideRequest(cleaned) && !isPlanRequest(cleaned)) {
      return {
        silence: false,
        fallback: true,
        reply: clampAssistReply("Можно смотреть афишу и карту, собирать планы и звать друзей. Нажми, куда зайти."),
        guides: ["search", "map", "plans", "friends"],
      };
    }
    if (!recognized && !isPlanRequest(cleaned)) {
      return {
        silence: false,
        fallback: true,
        reply: clampAssistReply("На связи. Могу подобрать, куда сходить, или подсказать, что есть в приложении."),
        guides: ["search", "plans"],
      };
    }
    const matched = recognized ? matchAssistEvents(future, criteria) : [];
    const fromBill = recognized && matched.length === 0 && !isPlanRequest(cleaned);
    const reply = clampAssistReply(fromBill ? "Точного совпадения нет. Вот что есть в афише." : recognized ? "Не получилось сформировать ответ. Подобрал по словам запроса." : "Не получилось сформировать ответ. Вот что есть в афише.");
    if (isPlanRequest(cleaned)) {
      const day = await this.assembleSaturday(userId, criteria, save, now);
      return { silence: false, fallback: true, reply, day };
    }
    const picked = (matched.length > 0 ? matched : future).slice(0, 4);
    const items = picked.map((event) => ({ event, explanation: matched.length > 0 ? "Подходит по запросу" : "Из афиши" }));
    return { silence: false, fallback: true, reply, ...(items.length > 0 ? { items } : {}) };
  }

  private async parseCriteria(cleaned: string): Promise<AssistCriteria> {
    try {
      return applyKeywordGenre(cleaned, await this.llm.parseQuery(cleaned));
    } catch {
      return parseAssistQuery(cleaned);
    }
  }

  private async historyEventIds(userId: string): Promise<Set<string>> {
    const rows = await this.checkIns.find({ where: { userId } });
    return new Set(rows.map((row) => row.eventId).filter((id): id is string => Boolean(id)));
  }

  private async historyCategories(eventIds: Set<string>): Promise<Set<Event["category"]>> {
    if (eventIds.size === 0) return new Set();
    const rows = await this.events.find({ where: { id: In([...eventIds]) } });
    return new Set(rows.map((row) => row.category));
  }

  private async partnerSavedEventIds(userId: string): Promise<Set<string>> {
    const friends = await this.friendships.find({ where: { userId } });
    const partnerId = friends.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0]?.friendUserId;
    if (!partnerId) return new Set();
    const lists = await this.lists.find({ where: { userId: partnerId } });
    const listIds = new Set(lists.map((row) => row.id));
    const items = await this.listItems.find();
    return new Set(items.filter((row) => listIds.has(row.listId) && row.eventId).map((row) => row.eventId as string));
  }

  private prepareQuery(userId: string, query: string): string {
    if (!this.limiter.hit(userId)) throw new HttpException("Assist rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    const cleaned = sanitizeAssistQuery(query);
    if (!cleaned) throw new BadRequestException("Invalid assist payload");
    return cleaned;
  }
}

export function nextSaturdayKey(now: Date): string {
  const weekday = moscowIsoWeekday(now);
  const addDays = (6 - weekday + 7) % 7;
  return moscowDateKey(new Date(now.getTime() + addDays * 86_400_000));
}

export function matchAssistEvents(events: Event[], criteria: AssistCriteria): Event[] {
  return events
    .filter((event) => matchesWhen(event, criteria.when))
    .filter((event) => matchesBudget(event, criteria.budgetMaxRub))
    .filter((event) => matchesCompany(event, criteria.company))
    .filter((event) => matchesGenre(event, criteria.genre))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 7);
}

export function formatDaySummary(date: string, stops: number, matched: boolean): string {
  if (!matched) return `Ничего точно по запросу на субботу ${date} — собрал день из афиши: ${stops} событий`;
  return `Собрал день на субботу ${date}: ${stops} событий по запросу`;
}

export function formatAssistSummary(total: number, history: number, saved: number): string {
  if (total === 0) return "Не нашел вариантов по запросу.";
  return `Нашел ${total} вариантов, ${history} по твоей истории, ${saved} уже есть в сохранённом у друзей`;
}

function explainPick(fromHistory: boolean, fromPartner: boolean): string {
  if (fromHistory && fromPartner) return "По твоей истории, и уже есть в сохранённом у друзей";
  if (fromHistory) return "По твоей истории";
  if (fromPartner) return "Уже есть в сохранённом у друзей";
  return "Подходит по запросу";
}

function matchesWhen(event: Event, when: AssistCriteria["when"]): boolean {
  if (when === "any") return true;
  const hour = moscowHour(new Date(event.startsAt));
  if (when === "morning") return hour < 12;
  if (when === "afternoon") return hour >= 12 && hour < 17;
  return hour >= 17;
}

function matchesBudget(event: Event, budgetMaxRub: number | null): boolean {
  if (budgetMaxRub == null) return true;
  if (!event.isPaid) return true;
  return event.priceRub !== null && event.priceRub <= budgetMaxRub;
}

function matchesCompany(event: Event, company: AssistCriteria["company"]): boolean {
  if (company === "partner") return event.category !== "volunteering";
  return true;
}

function matchesGenre(event: Event, genre: AssistCriteria["genre"]): boolean {
  if (genre === "any") return true;
  const blob = `${event.title} ${event.description}`.toLowerCase();
  if (genre === "music") return event.category === "afisha" || /музык|джаз|концерт|симфон|рахманин/.test(blob);
  if (genre === "sport") return event.category === "sport" || /спорт|футбол|йог|пробеж|воркаут|трениров|теннис|стритбол|кроссфит|плаван|офп/.test(blob);
  if (genre === "volunteering") return event.category === "volunteering" || /волонт|волонтер|субботник/.test(blob);
  return event.category === "tourism" || event.category === "volunteering";
}

function moscowHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}

function criteriaRecognized(criteria: AssistCriteria): boolean {
  return criteria.when !== "any" || criteria.budgetMaxRub !== null || criteria.company !== "alone" || criteria.genre !== "any";
}

const ASSIST_REPLY_MAX = 400;

/** AssistChatResponseSchema rejects a reply longer than 400, including the open-card sentence. */
function clampAssistReply(reply: string): string {
  return reply.slice(0, ASSIST_REPLY_MAX);
}

function keepGuides(raw: readonly string[] | undefined): AssistGuideId[] {
  const guides: AssistGuideId[] = [];
  for (const id of raw ?? []) {
    const parsed = AssistGuideIdSchema.safeParse(id);
    if (!parsed.success || guides.includes(parsed.data)) continue;
    guides.push(parsed.data);
    if (guides.length === 4) break;
  }
  return guides;
}

function isAppGuideRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("пользоват") || lower.includes("функционал") || lower.includes("что тут") || lower.includes("как тут") || lower.includes("что можно") || lower.includes("возможност") || lower.includes("раздел") || lower.includes("приложен");
}

function isPlanRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("план") && (lower.includes("вечер") || lower.includes("суббот") || lower.includes("шашлык") || lower.includes("мангал") || lower.includes("собер"));
}
