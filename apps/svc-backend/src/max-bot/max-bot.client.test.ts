import { describe, expect, it } from "vitest";
import { MaxBotClient, MAX_BOT_API_BASE_URL, type MaxBotFetch } from "./max-bot.client";

const token = "test-bot-token";

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<MaxBotFetch>> {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe("MaxBotClient.createChat", () => {
  it("returns null when the bot token is missing and does not call HTTP", async () => {
    let called = 0;
    const fetchImpl: MaxBotFetch = async () => {
      called += 1;
      return jsonResponse(200, {});
    };
    const client = new MaxBotClient(undefined, MAX_BOT_API_BASE_URL, fetchImpl);
    await expect(client.createChat("Джаз в парке")).resolves.toBeNull();
    expect(called).toBe(0);
  });

  it("posts the title to /chats with the Authorization token and parses chat_id + link", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const fetchImpl: MaxBotFetch = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { chat_id: 42, link: "https://max.ru/join/abc" });
    };
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, fetchImpl);
    await expect(client.createChat("Джаз в парке")).resolves.toEqual({ chatId: 42, link: "https://max.ru/join/abc" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/chats`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers.Authorization).toBe(token);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ title: "Джаз в парке" });
  });

  it("returns null on non-OK HTTP, malformed body, and network errors", async () => {
    const failing = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(503, { message: "down" }));
    await expect(failing.createChat("x")).resolves.toBeNull();

    const malformed = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, { chat_id: 1 }));
    await expect(malformed.createChat("x")).resolves.toBeNull();

    const network = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(network.createChat("x")).resolves.toBeNull();
  });
});
