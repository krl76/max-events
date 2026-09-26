// START_MODULE_CONTRACT
// PURPOSE: OpenAI-compatible chat-completions adapter. Keys stay in env; never logged.
// SCOPE: Tries MODEL_API_MODELS in order. Timeout, HTTP failure, and unusable JSON move to the next model. 401/403 stops the chain.
// DEPENDS: ./llm-provider, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MODEL_API_REQUEST_TIMEOUT_MS - abort window for a single chat-completions call
// - ModelApiLlmProvider - live LlmProvider that fails over across models
// END_MODULE_MAP

import { AssistCriteriaSchema, type AssistCriteria } from "@max-events/api-contracts";
import { LlmProviderError, type LlmProvider } from "./llm-provider";

const SYSTEM = 'Reply with JSON only: {"when":"morning|afternoon|evening|any","budgetMaxRub":number|null,"company":"alone|friends|partner|kids","genre":"music|sport|outdoors|any"}';

/** A hung model must not hold the assist request forever; the next id still gets its own window. */
export const MODEL_API_REQUEST_TIMEOUT_MS = 10_000;

export class ModelApiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly models: readonly string[],
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = MODEL_API_REQUEST_TIMEOUT_MS,
  ) {}

  async parseQuery(query: string): Promise<AssistCriteria> {
    if (this.models.length === 0) throw new LlmProviderError("llm_disabled", "LLM request failed");
    let lastError = new LlmProviderError("llm_http", "LLM request failed");
    for (const model of this.models) {
      try {
        const content = await this.complete(model, query);
        const parsed = AssistCriteriaSchema.safeParse(extractJson(content));
        if (parsed.success) return parsed.data;
        lastError = new LlmProviderError("llm_parse", "LLM request failed");
      } catch (error) {
        if (error instanceof LlmProviderError && error.code === "llm_auth") throw error;
        lastError = error instanceof LlmProviderError ? error : new LlmProviderError("llm_network", "LLM request failed");
      }
    }
    throw lastError;
  }

  private async complete(model: string, query: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: query },
          ],
        }),
      });
      if (response.status === 401 || response.status === 403) throw new LlmProviderError("llm_auth", "LLM request failed");
      if (!response.ok) throw new LlmProviderError("llm_http", "LLM request failed");
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      return payload.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError(controller.signal.aborted ? "llm_timeout" : "llm_network", "LLM request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}

function extractJson(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}
