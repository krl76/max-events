// START_MODULE_CONTRACT
// PURPOSE: Disabled LLM provider — fail-closed when LLM_PROVIDER=none.
// SCOPE: parseQuery throws LlmProviderError llm_disabled.
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
}
