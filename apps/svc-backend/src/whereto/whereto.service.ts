// START_MODULE_CONTRACT
// PURPOSE: "Where to go?" suggestions — filter published upcoming events by company, mood and budget, cap at 5.
// SCOPE: selectWheretoItems on Event DTOs; WheretoService.suggest loads catalog via EventsService.list(dateFrom=now).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../events/events.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - selectWheretoItems - mood/budget/company filters, sort by startsAt, slice 5
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

export function selectWheretoItems(events: Event[], query: WheretoQuery, interests: string[] = []): Event[] {
  return events
    .filter((item) => MOOD_CATEGORIES[query.mood].includes(item.category))
    .filter((item) => matchesBudget(item, query.budget))
    .filter((item) => matchesCompany(item, query.company))
    .sort((a, b) => Number(matchesInterest(b, interests)) - Number(matchesInterest(a, interests)) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 5);
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
