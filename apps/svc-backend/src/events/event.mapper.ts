// START_MODULE_CONTRACT
// PURPOSE: Map EventEntity to the api-contracts Event DTO without depending on EventsService.
// SCOPE: toEventDto; optional promoted flag (strict boolean, not Array#map index).
// DEPENDS: @max-events/api-contracts, ./event.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - toEventDto - EventEntity to Event
// END_MODULE_MAP

import type { Event } from "@max-events/api-contracts";
import type { EventEntity } from "./event.entity";

export function toEventDto(event: EventEntity, options?: { promoted?: boolean }): Event {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    city: event.city,
    placeId: event.placeId,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    isPaid: event.isPaid,
    priceRub: event.priceRub,
    paymentUrl: event.paymentUrl,
    capacity: event.capacity,
    chatLink: event.chatLink,
    promoted: options?.promoted === true,
  };
}
