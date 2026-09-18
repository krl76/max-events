// START_MODULE_CONTRACT
// PURPOSE: xAI chat-completions LLM adapter. Keys stay in env; never logged.
// SCOPE: POST /chat/completions; JSON criteria; fallback to parseAssistQuery on bad output.
// DEPENDS: ./llm-provider, ./parse-nl, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - XaiLlmProvider - live LlmProvider via fetch
// END_MODULE_MAP

import { AssistCriteriaSchema, type AssistCriteria } from "@max-events/api-contracts";
import { LlmProviderError, type LlmProvider } from "./llm-provider";
import { parseAssistQuery } from "./parse-nl";

const SYSTEM = "Reply with JSON only: {\"when\":\"morning|afternoon|evening|any\",\"budgetMaxRub\":number|null,\"company\":\"alone|friends|partner|kids\",\"genre\":\"music|sport|outdoors|any\"}";

export class XaiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async parseQuery(query: string): Promise<AssistCriteria> {
    let content: string;
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: query },
          ],
        }),
      });
      if (!response.ok) throw new LlmProviderError("llm_http", "LLM request failed");
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      content = payload.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError("llm_network", "LLM request failed");
    }
    const parsed = AssistCriteriaSchema.safeParse(extractJson(content));
    if (parsed.success) return parsed.data;
    return parseAssistQuery(query);
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
