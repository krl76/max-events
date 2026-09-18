// START_MODULE_CONTRACT
// PURPOSE: NL event assist — parse via LlmProvider, match catalog, explain from history and a friend's lists.
// SCOPE: suggest(userId, query); keys never logged; max 7 picks.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/checkins/lists/friends
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - matchAssistEvents - filter catalog by parsed criteria
// - formatAssistSummary - README-style copy
// - nextSaturdayKey - next Saturday YYYY-MM-DD in Moscow
// - AssistService - suggest, planSaturday
// END_MODULE_MAP

import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { AssistCriteria, AssistDayResponse, AssistPick, AssistResponse, Event, PlanCard } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { PlansService } from "../plans/plans.service";
import { moscowIsoWeekday } from "../plans/recurring";
import { moscowDateKey } from "../time/moscow-date";
import { LLM_PROVIDER, LlmProviderError, type LlmProvider } from "./llm-provider";
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
    let criteria: AssistCriteria;
    try {
      criteria = await this.llm.parseQuery(cleaned);
    } catch (error) {
      if (error instanceof LlmProviderError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
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
    const historyCount = items.filter((row) => historyIds.has(row.event.id) || historyCategories.has(row.event.category)).length;
    const savedCount = items.filter((row) => savedIds.has(row.event.id)).length;
    return { summary: formatAssistSummary(items.length, historyCount, savedCount), criteria, items };
  }

  async planSaturday(userId: string, query: string, save = false, now = new Date()): Promise<AssistDayResponse> {
    this.prepareQuery(userId, query);
    const date = nextSaturdayKey(now);
    const catalog = (await this.events.find())
      .filter((row) => row.published !== false && moscowDateKey(row.startsAt) === date)
      .map((row) => toEventDto(row))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .slice(0, 4);
    if (catalog.length === 0) throw new BadRequestException("No Saturday events found");
    const stops = catalog.map((event) => ({ at: event.startsAt, event, explanation: "Слот субботнего дня" }));
    const first = catalog[0]!;
    const planDraft = {
      eventId: first.id,
      participantIds: [] as string[],
      meetingPoint: first.title,
      meetingAt: first.startsAt,
    };
    let plan: PlanCard | null = null;
    if (save) {
      plan = await this.plans.create(userId, planDraft);
    }
    return {
      summary: `Собрал день на субботу ${date}: ${stops.length} событий`,
      date,
      stops,
      planDraft,
      plan,
    };
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

export function formatAssistSummary(total: number, history: number, saved: number): string {
  if (total === 0) return "Не нашел вариантов по запросу.";
  return `Нашел ${total} вариантов, ${history} по твоей истории, ${saved} уже сохранила твоя девушка`;
}

function explainPick(fromHistory: boolean, fromPartner: boolean): string {
  if (fromHistory && fromPartner) return "По твоей истории, и уже сохранила твоя девушка";
  if (fromHistory) return "По твоей истории";
  if (fromPartner) return "Уже сохранила твоя девушка";
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
  if (genre === "sport") return event.category === "sport";
  return event.category === "tourism" || event.category === "volunteering";
}

function moscowHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}
