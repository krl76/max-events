// START_MODULE_CONTRACT
// PURPOSE: Disabled LLM provider — fail-closed when MODEL_API_KEY is unset.
// SCOPE: parseQuery and chatTurn throw LlmProviderError llm_disabled.
// DEPENDS: ./llm-provider
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NoneLlmProvider - rejecting LlmProvider
// END_MODULE_MAP

import type { LlmProvider } from "./llm-provider";
import { LlmProviderError } from "./llm-provider";

export class NoneLlmProvider implements LlmProvider {
  async parseQuery(_query: string): Promise<never> {
    throw new LlmProviderError("llm_disabled", "LLM assist is disabled");
  }

  async chatTurn(): Promise<never> {
    throw new LlmProviderError("llm_disabled", "LLM request failed");
  }
}
