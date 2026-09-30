// START_MODULE_CONTRACT
// PURPOSE: Льготные признаки события в одной афише: Пушкинская карта и свободный вход. Не отдельный агрегатор, а фильтр поверх уже собранного каталога.
// SCOPE: Pure helpers over Event fields. The stored flag wins; otherwise paid afisha is treated as Pushkin-eligible.
// DEPENDS: @max-events/api-contracts (EventCategory)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - eventAcceptsPushkinCard - whether the event can be paid with a Pushkin Card
// END_MODULE_MAP

import type { EventCategory } from "@max-events/api-contracts";

export function eventAcceptsPushkinCard(event: { category: EventCategory; isPaid: boolean; pushkinCard?: boolean }): boolean {
  if (event.pushkinCard === true) return true;
  if (event.pushkinCard === false) return false;
  return event.category === "afisha" && event.isPaid;
}
