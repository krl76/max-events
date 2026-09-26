import { describe, expect, it, vi } from "vitest";
import { LlmProviderError } from "./llm-provider";
import { ModelApiLlmProvider } from "./model-api-llm.provider";

const key = "replace-with-your-model-api-key";
const evening = { when: "evening", budgetMaxRub: null, company: "friends", genre: "music" };

function jsonResponse(content: string, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content } }] }) } as Response;
}

function modelOf(init: RequestInit | undefined): string {
  return (JSON.parse(String(init?.body)) as { model: string }).model;
}

describe("ModelApiLlmProvider", () => {
  it("uses the first model that returns criteria and never puts the key in errors", async () => {
    const seen: string[] = [];
    const provider = new ModelApiLlmProvider(key, "https://opencode.ai/zen/v1", ["mimo-v2.6-flash-free", "big-pickle"], async (url, init) => {
      expect(String(url)).toBe("https://opencode.ai/zen/v1/chat/completions");
      expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${key}` });
      seen.push(modelOf(init as RequestInit));
      return jsonResponse(JSON.stringify({ ...evening, budgetMaxRub: 3000, company: "partner" }));
    });
    await expect(provider.parseQuery("вечером музыка")).resolves.toEqual({ ...evening, budgetMaxRub: 3000, company: "partner" });
    expect(seen).toEqual(["mimo-v2.6-flash-free"]);

    const failing = new ModelApiLlmProvider(key, "https://opencode.ai/zen/v1", ["mimo-v2.6-flash-free"], async () => {
      throw new Error(`network ${key}`);
    });
    await expect(failing.parseQuery("x")).rejects.toBeInstanceOf(LlmProviderError);
    await expect(failing.parseQuery("x")).rejects.toMatchObject({ code: "llm_network", message: "LLM request failed" });
  });

  it("skips a model that answers with unusable JSON and a model that returns HTTP 500", async () => {
    const seen: string[] = [];
    const provider = new ModelApiLlmProvider(key, "https://opencode.ai/zen/v1/", ["broken", "down", "ok"], async (_url, init) => {
      const model = modelOf(init as RequestInit);
      seen.push(model);
      if (model === "broken") return jsonResponse("not json");
      if (model === "down") return jsonResponse("", 500);
      return jsonResponse(JSON.stringify(evening));
    });
    await expect(provider.parseQuery("вечером")).resolves.toEqual(evening);
    expect(seen).toEqual(["broken", "down", "ok"]);
  });

  it("stops on 401 without calling the next model", async () => {
    const seen: string[] = [];
    const provider = new ModelApiLlmProvider(key, "https://opencode.ai/zen/v1", ["first", "second"], async (_url, init) => {
      seen.push(modelOf(init as RequestInit));
      return jsonResponse("no", 401);
    });
    await expect(provider.parseQuery("x")).rejects.toMatchObject({ code: "llm_auth", message: "LLM request failed" });
    expect(seen).toEqual(["first"]);
  });

  it("aborts a model that never answers and uses the next one", async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    try {
      const provider = new ModelApiLlmProvider(
        key,
        "https://opencode.ai/zen/v1",
        ["slow", "fast"],
        (_url, init) => {
          const model = modelOf(init as RequestInit);
          seen.push(model);
          if (model === "slow") {
            return new Promise<Response>((_resolve, reject) => {
              (init as RequestInit).signal?.addEventListener("abort", () => reject(new Error("aborted")));
            });
          }
          return Promise.resolve(jsonResponse(JSON.stringify(evening)));
        },
        5_000,
      );
      const pending = provider.parseQuery("вечером");
      const assertion = expect(pending).resolves.toEqual(evening);
      await vi.advanceTimersByTimeAsync(5_000);
      await assertion;
      expect(seen).toEqual(["slow", "fast"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("parses a chat draft and skips a model that returns an empty reply", async () => {
    const seen: string[] = [];
    const provider = new ModelApiLlmProvider(key, "https://example.test/v1", ["qwen/qwen3.8-27b:free", "z-ai/glm-5.2:free"], async (_url, init) => {
      const model = modelOf(init as RequestInit);
      seen.push(model);
      if (model.startsWith("qwen")) return jsonResponse("not json");
      return jsonResponse(JSON.stringify({ refuse: false, reply: "Могу подобрать событие.", eventIds: [], openEventId: null, plan: false, criteria: null }));
    });
    await expect(provider.chatTurn("как дела?", [], [])).resolves.toMatchObject({ reply: "Могу подобрать событие.", eventIds: [] });
    expect(seen).toEqual(["qwen/qwen3.8-27b:free", "z-ai/glm-5.2:free"]);
  });
});
