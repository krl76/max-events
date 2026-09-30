import { describe, expect, it } from "vitest";
import { MaxBotClient, MAX_BOT_API_BASE_URL, type MaxBotFetch } from "./max-bot.client";

const token = "test-bot-token";

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<MaxBotFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
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
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
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
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
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

describe("MaxBotClient.sendRich", () => {
  it("posts a NewMessageBody to /messages?user_id= and returns false without a token", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { message: { body: { mid: "mid-1" } } });
    });
    const body = { text: "меню", format: "markdown" as const, attachments: [{ type: "image" as const, payload: { url: "https://cdn.example/hero.jpg" } }] };
    await expect(client.sendRich("67890", body)).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/messages?user_id=67890`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual(body);

    const bare = new MaxBotClient(undefined, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, {}));
    await expect(bare.sendRich("1", { text: "x" })).resolves.toBe(false);
  });

  it("returns the MAX mid so a working card can be edited into the reply", async () => {
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, { message: { body: { mid: "mid-1" } } }));
    await expect(client.sendRichId("67890", { text: "Подбираю варианты…" })).resolves.toBe("mid-1");
  });
});

describe("MaxBotClient.editMessage", () => {
  it("puts the new body on /messages?message_id=", async () => {
    const calls: Array<{ url: string; init: { method: string; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {});
    });
    await expect(client.editMessage("mid-1", { text: "готово" })).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/messages?message_id=mid-1`);
    expect(calls[0]?.init.method).toBe("PUT");
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ text: "готово" });
  });
});

describe("MaxBotClient.answerCallback", () => {
  it("posts the edited message to /answers?callback_id=", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {});
    });
    await expect(client.answerCallback("cb-1", { message: { text: "ok" }, notification: "Записан" })).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/answers?callback_id=cb-1`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ message: { text: "ok" }, notification: "Записан" });
  });
});

describe("MaxBotClient.getUpdates", () => {
  it("long-polls /updates with marker and timeout", async () => {
    const calls: Array<{ url: string; init: { method: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { updates: [{ update_type: "bot_started" }], marker: 9 });
    });
    await expect(client.getUpdates(3, 25)).resolves.toEqual({ updates: [{ update_type: "bot_started" }], marker: 9 });
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/updates?limit=100&timeout=25&marker=3`);
    expect(calls[0]?.init.method).toBe("GET");
  });
});

describe("MaxBotClient.subscribe", () => {
  it("posts the webhook URL and secret, and unsubscribes with DELETE", async () => {
    const calls: Array<{ url: string; init: { method: string; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {});
    });
    await expect(client.subscribe("https://events.versacegus.cc/api/bot/webhook", ["bot_started"], "secret-1")).resolves.toBe(true);
    await expect(client.unsubscribe("https://events.versacegus.cc/api/bot/webhook")).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/subscriptions`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({
      url: "https://events.versacegus.cc/api/bot/webhook",
      update_types: ["bot_started"],
      secret: "secret-1",
    });
    expect(calls[1]?.init.method).toBe("DELETE");
  });

  it("treats a 200 with success:false as a failed subscribe", async () => {
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, { success: false, message: "url already used" }));
    await expect(client.subscribe("https://events.versacegus.cc/api/bot/webhook", ["bot_started"], "secret-1")).resolves.toBe(false);
  });
});

describe("MaxBotClient.sendTyping", () => {
  it("posts typing_on to the chat actions endpoint", async () => {
    const calls: Array<{ url: string; init: { body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {});
    });
    await expect(client.sendTyping(555)).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/chats/555/actions`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ action: "typing_on" });
  });
});

describe("MaxBotClient.setCommands", () => {
  it("patches /me/commands with the published menu", async () => {
    const calls: Array<{ url: string; init: { method: string; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {});
    });
    await expect(client.setCommands([{ name: "today", description: "Сегодня" }])).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/me/commands`);
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ commands: [{ name: "today", description: "Сегодня" }] });
  });
});

describe("MaxBotClient.botName", () => {
  it("reads username from GET /me and returns null without a token", async () => {
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, { username: "t691_hakaton_max_bot" }));
    await expect(client.botName()).resolves.toBe("t691_hakaton_max_bot");
    const bare = new MaxBotClient(undefined, MAX_BOT_API_BASE_URL, async () => jsonResponse(200, {}));
    await expect(bare.botName()).resolves.toBeNull();
  });
});

describe("MaxBotClient.sendChatMessage", () => {
  it("posts text to /messages?chat_id= with the Authorization token", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
    const client = new MaxBotClient(token, MAX_BOT_API_BASE_URL, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { message: {} });
    });
    await expect(client.sendChatMessage(7, "Куда идем в пятницу?")).resolves.toBe(true);
    expect(calls[0]?.url).toBe(`${MAX_BOT_API_BASE_URL}/messages?chat_id=7`);
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ text: "Куда идем в пятницу?" });
  });
});
