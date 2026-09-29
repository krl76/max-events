// START_MODULE_CONTRACT
// PURPOSE: "Where to go?" suggestions — one mood match first, then other upcoming events that still fit company and budget, five in total.
// SCOPE: selectWheretoItems on Event DTOs; WheretoService.suggest loads catalog via EventsService.list(dateFrom=now).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../events/events.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - selectWheretoItems - mood matches first, then budget/company fillers, cap 5
// - WheretoService - suggest(query, now) around EventsService.list
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import type { Event, EventCategory, WheretoMood, WheretoQuery, WheretoResponse } from "@max-events/api-contracts";
import { EventsService } from "../events/events.service";
import { ProfilesService } from "../users/profiles.service";

const MOOD_CATEGORIES: Record<WheretoMood, EventCategory[]> = {
  active: ["sport", "tourism"],
  calm: ["afisha"],
  unusual: ["volunteering", "tourism"],
};

@Injectable()
export class WheretoService {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
  ) {}

  async suggest(query: WheretoQuery, viewerId?: string, now = new Date()): Promise<WheretoResponse> {
    const catalog = await this.events.list({ dateFrom: now, viewerId });
    const interests = viewerId ? (await this.profiles.getOrCreate(viewerId)).interests : [];
    return { items: selectWheretoItems(catalog, query, interests) };
  }
}

const WHERETO_PICKS = 5;

function byInterestThenStart(interests: string[]): (left: Event, right: Event) => number {
  return (left, right) => Number(matchesInterest(right, interests)) - Number(matchesInterest(left, interests)) || left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id);
}

/** The mood match stays first. The other seats are filled from later events that still fit the budget and the company, so a quiet evening is not a single card. */
export function selectWheretoItems(events: Event[], query: WheretoQuery, interests: string[] = []): Event[] {
  const fits = events.filter((item) => matchesBudget(item, query.budget) && matchesCompany(item, query.company));
  const order = byInterestThenStart(interests);
  const strict = fits.filter((item) => MOOD_CATEGORIES[query.mood].includes(item.category)).sort(order);
  if (strict.length >= WHERETO_PICKS) return strict.slice(0, WHERETO_PICKS);
  const chosen = new Set(strict.map((item) => item.id));
  const extra = fits.filter((item) => !chosen.has(item.id)).sort(order);
  return [...strict, ...extra].slice(0, WHERETO_PICKS);
}

function matchesInterest(event: Event, interests: string[]): boolean {
  if (interests.length === 0) return false;
  const haystack = `${event.category} ${event.title} ${event.description}`.toLowerCase();
  return interests.some((interest) => haystack.includes(interest.toLowerCase()));
}

function matchesBudget(event: Event, budget: WheretoQuery["budget"]): boolean {
  const charged = event.isPaid || (event.priceRub !== null && event.priceRub > 0);
  if (budget === "any") return true;
  if (budget === "free") return !charged;
  return !charged || (event.priceRub !== null && event.priceRub <= 3000);
}

function matchesCompany(event: Event, company: WheretoQuery["company"]): boolean {
  if (company === "partner") return event.category !== "volunteering";
  if (company === "kids") return (event.priceRub ?? 0) <= 3000;
  return true;
}
