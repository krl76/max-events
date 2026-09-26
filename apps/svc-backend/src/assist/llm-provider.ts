// START_MODULE_CONTRACT
// PURPOSE: LLM provider port for NL assist — parse a query or draft one chat turn. No SDK in domain.
// SCOPE: LlmProvider.parseQuery and chatTurn; AssistChatDraft; AssistCatalogCard; LlmProviderError. Keys never appear on the error message.
// DEPENDS: @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LLM_PROVIDER - Nest injection token
// - AssistChatDraft - refuse, reply, event ids, opened id, plan, criteria
// - AssistCatalogCard - catalog row the model may cite
// - LlmProvider - parseQuery and chatTurn
// - LlmProviderError - typed provider failure
// END_MODULE_MAP

import type { AssistCriteria } from "@max-events/api-contracts";

export const LLM_PROVIDER = "LLM_PROVIDER";

export interface AssistChatDraft {
  refuse: boolean;
  reply: string;
  eventIds: string[];
  openEventId: string | null;
  plan: boolean;
  criteria: AssistCriteria | null;
  /** Screen ids the model suggested. Unknown ids are already dropped. Absent means none. */
  guides?: string[];
}

export interface AssistCatalogCard {
  id: string;
  title: string;
  startsAt: string;
  priceRub: number | null;
  category: string;
}

export interface LlmProvider {
  parseQuery(query: string): Promise<AssistCriteria>;
  chatTurn(message: string, transcript: { role: "user" | "assistant"; text: string }[], cards: AssistCatalogCard[]): Promise<AssistChatDraft>;
}

export class LlmProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}
