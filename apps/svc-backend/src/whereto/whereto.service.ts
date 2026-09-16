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

const MOOD_CATEGORIES: Record<WheretoMood, EventCategory[]> = {
  active: ["sport", "tourism"],
  calm: ["afisha"],
  unusual: ["volunteering", "tourism"],
};

@Injectable()
export class WheretoService {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  async suggest(query: WheretoQuery, now = new Date()): Promise<WheretoResponse> {
    const catalog = await this.events.list({ dateFrom: now });
    return { items: selectWheretoItems(catalog, query) };
  }
}

export function selectWheretoItems(events: Event[], query: WheretoQuery): Event[] {
  return events
    .filter((item) => MOOD_CATEGORIES[query.mood].includes(item.category))
    .filter((item) => matchesBudget(item, query.budget))
    .filter((item) => matchesCompany(item, query.company))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 5);
}

function matchesBudget(event: Event, budget: WheretoQuery["budget"]): boolean {
  if (budget === "any") return true;
  if (budget === "free") return !event.isPaid;
  return !event.isPaid || (event.priceRub !== null && event.priceRub <= 3000);
}

function matchesCompany(event: Event, company: WheretoQuery["company"]): boolean {
  if (company === "partner") return event.category !== "volunteering";
  if (company === "kids") return (event.priceRub ?? 0) <= 3000;
  return true;
}
