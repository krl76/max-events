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

describe("MaxBotClient.listFriends", () => {
  it("returns null without HTTP because MAX has no public friends list method", async () => {
    let called = 0;
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => {
      called += 1;
      return jsonResponse(200, {});
    });
    await expect(client.listFriends("67890")).resolves.toBeNull();
    expect(called).toBe(0);
  });
});

describe("MaxBotClient.sendMessage", () => {
  it("returns false when the bot token is missing and does not call HTTP", async () => {
    let called = 0;
    const client = new MaxBotClient(undefined, MAX_BOT_API_BASE_URL, async () => {
      called += 1;
      return jsonResponse(200, {});
    });
    await expect(client.sendMessage("67890", "hello")).resolves.toBe(false);
    expect(called).toBe(0);
  });

  it("posts text to /messages?user_id= with the Authorization token", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { message: {} });
    });
    await expect(client.sendMessage("67890", "Напоминание: концерт")).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/messages?user_id=67890`);
    expect(calls[0]?.init.headers.Authorization).toBe(token);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ text: "Напоминание: концерт" });
  });

  it("returns false on non-OK HTTP and network errors", async () => {
    const failing = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(401, {}));
    await expect(failing.sendMessage("1", "x")).resolves.toBe(false);
    const network = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(network.sendMessage("1", "x")).resolves.toBe(false);
  });
});

describe("MaxBotClient.sendChatMessage", () => {
  it("posts text to /messages?chat_id= with the Authorization token", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { message: {} });
    });
    await expect(client.sendChatMessage(7, "Куда идем в пятницу?")).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/messages?chat_id=7`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ text: "Куда идем в пятницу?" });
  });
});
