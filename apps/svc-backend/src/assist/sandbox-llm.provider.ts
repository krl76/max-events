// START_MODULE_CONTRACT
// PURPOSE: In-process sandbox LLM — deterministic parseAssistQuery, no network, no keys.
// SCOPE: parseQuery delegates to parseAssistQuery. chatTurn throws llm_disabled.
// DEPENDS: ./parse-nl, ./llm-provider
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SandboxLlmProvider - heuristic LlmProvider
// END_MODULE_MAP

import type { AssistCriteria } from "@max-events/api-contracts";
import { LlmProviderError, type LlmProvider } from "./llm-provider";
import { parseAssistQuery } from "./parse-nl";

export class SandboxLlmProvider implements LlmProvider {
  async parseQuery(query: string): Promise<AssistCriteria> {
    return parseAssistQuery(query);
  }

  async chatTurn(): Promise<never> {
    throw new LlmProviderError("llm_disabled", "LLM request failed");
  }

  async rankCandidateIds(candidates: readonly { id: string; title: string }[]): Promise<string[]> {
    return candidates.map((item) => item.id);
  }
}
