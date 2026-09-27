// START_MODULE_CONTRACT
// PURPOSE: OpenAI-compatible chat-completions adapter. Keys stay in env; never logged.
// SCOPE: Tries MODEL_API_MODELS in order for parseQuery and chatTurn. Timeout, HTTP failure, unusable JSON, and a non-refuse draft with a missing or empty reply move to the next model. 401/403 stops the chain. Chat ids outside the given cards are dropped.
// DEPENDS: ./llm-provider, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MODEL_API_REQUEST_TIMEOUT_MS - abort window for a single chat-completions call
// - ModelApiLlmProvider - live LlmProvider that fails over across models for criteria and chat drafts
// END_MODULE_MAP

import { AssistCriteriaSchema, AssistGuideIdSchema, type AssistCriteria } from "@max-events/api-contracts";
import { LlmProviderError, type AssistCatalogCard, type AssistChatDraft, type LlmProvider } from "./llm-provider";

const SYSTEM = 'Read the user words literally. A number is a budget in rubles. прогулка, парк, набережная, достопримечательность mean genre outdoors. Do not drop words from the query. Reply with JSON only: {"when":"morning|afternoon|evening|any","budgetMaxRub":number|null,"company":"alone|friends|partner|kids","genre":"music|sport|outdoors|volunteering|any"}';

const CHAT_SYSTEM = `You are MAX, a short leisure assistant for a real event catalog and for the app itself. Reply in Russian, one or two sentences. Follow the user's exact words: a sum is a budget, and a walk, park, embankment or landmark is an outdoors stop, not a random event.
Return JSON only: {"refuse":false,"reply":"...","eventIds":[],"openEventId":null,"plan":false,"criteria":null,"guides":[]}
refuse is true only for a direct insult. eventIds and openEventId must be copied from the catalog ids you were given. Use plan true only when the user asks to assemble a day. criteria is {"when":"morning|afternoon|evening|any","budgetMaxRub":number|null,"company":"alone|friends|partner|kids","genre":"music|sport|outdoors|volunteering|any"} or null.
guides is up to 4 ids from this list only: search, map, swipe, plans, calendar, friends, lists, story, post, nearby, day-route, profile, companies, micro.
search is the poster, map is the map, swipe is liking events, plans is a meetup, calendar is the schedule, friends is people, lists is saved events, story is a short video, post is the feed, nearby is free time nearby, day-route is a day of stops, profile is the user, companies is a group vote, micro is a short nearby meetup.
When the user asks what the app can do, reply and put 2-4 guides in guides. Leave eventIds empty.
When the user asks for events, you may add one relevant guide beside the cards.
For small talk, reply, invite them to pick an event, and you may add one guide.`;

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
        const content = await this.complete(model, SYSTEM, query);
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

  async chatTurn(message: string, transcript: { role: "user" | "assistant"; text: string }[], cards: AssistCatalogCard[]): Promise<AssistChatDraft> {
    if (this.models.length === 0) throw new LlmProviderError("llm_disabled", "LLM request failed");
    let lastError = new LlmProviderError("llm_http", "LLM request failed");
    const user = JSON.stringify({ message, transcript, catalog: cards });
    for (const model of this.models) {
      try {
        const content = await this.complete(model, CHAT_SYSTEM, user);
        const draft = parseChatDraft(extractJson(content), cards);
        if (draft) return draft;
        lastError = new LlmProviderError("llm_parse", "LLM request failed");
      } catch (error) {
        if (error instanceof LlmProviderError && error.code === "llm_auth") throw error;
        lastError = error instanceof LlmProviderError ? error : new LlmProviderError("llm_network", "LLM request failed");
      }
    }
    throw lastError;
  }

  private async complete(model: string, system: string, user: string): Promise<string> {
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
            { role: "system", content: system },
            { role: "user", content: user },
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

function parseChatDraft(raw: unknown, cards: readonly AssistCatalogCard[]): AssistChatDraft | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const refuse = value.refuse === true;
  const reply = typeof value.reply === "string" ? value.reply : "";
  if (!refuse && reply.trim() === "") return null;
  const allowed = new Set(cards.map((card) => card.id));
  const eventIds = Array.isArray(value.eventIds) ? value.eventIds.filter((id): id is string => typeof id === "string" && allowed.has(id)) : [];
  const criteria = AssistCriteriaSchema.safeParse(value.criteria);
  return {
    refuse,
    reply,
    eventIds,
    openEventId: typeof value.openEventId === "string" && eventIds.includes(value.openEventId) ? value.openEventId : null,
    plan: value.plan === true,
    criteria: criteria.success ? criteria.data : null,
    guides: keepGuideIds(value.guides),
  };
}

function keepGuideIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const guides: string[] = [];
  for (const id of raw) {
    const parsed = AssistGuideIdSchema.safeParse(id);
    if (!parsed.success || guides.includes(parsed.data)) continue;
    guides.push(parsed.data);
    if (guides.length === 4) break;
  }
  return guides;
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
