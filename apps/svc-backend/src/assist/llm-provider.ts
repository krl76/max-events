// START_MODULE_CONTRACT
// PURPOSE: LLM provider port for NL assist — parse a query into structured criteria. No SDK in domain.
// SCOPE: LlmProvider.parseQuery; LlmProviderError. Keys never appear on the error message.
// DEPENDS: @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LLM_PROVIDER - Nest injection token
// - LlmProvider - parseQuery
// - LlmProviderError - typed provider failure
// END_MODULE_MAP

import type { AssistCriteria } from "@max-events/api-contracts";

export const LLM_PROVIDER = "LLM_PROVIDER";

export interface LlmProvider {
  parseQuery(query: string): Promise<AssistCriteria>;
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
