import { describe, expect, it } from "vitest";
import { LlmProviderError } from "./llm-provider";
import { XaiLlmProvider } from "./xai-llm.provider";

const key = "replace-with-your-xai-api-key";

describe("XaiLlmProvider", () => {
  it("parses JSON criteria from the model and never puts the key in errors", async () => {
    const provider = new XaiLlmProvider(key, "https://api.x.ai/v1", "grok-4.5", async (url, init) => {
      expect(String(url)).toContain("/chat/completions");
      expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${key}` });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"when":"evening","budgetMaxRub":3000,"company":"partner","genre":"music"}' } }],
        }),
      } as Response;
    });
    await expect(provider.parseQuery("вечером музыка")).resolves.toEqual({
      when: "evening",
      budgetMaxRub: 3000,
      company: "partner",
      genre: "music",
    });
    const failing = new XaiLlmProvider(key, "https://api.x.ai/v1", "grok-4.5", async () => {
      throw new Error(`network ${key}`);
    });
    await expect(failing.parseQuery("x")).rejects.toBeInstanceOf(LlmProviderError);
    try {
      await failing.parseQuery("x");
    } catch (error) {
      expect((error as Error).message).toBe("LLM request failed");
      expect((error as Error).message.includes(key)).toBe(false);
    }
  });
});
