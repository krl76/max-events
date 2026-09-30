import { describe, expect, it } from "vitest";
import { botRich, botText, parseUpdates, type BotInbound } from "./bot.types";

const started = {
  update_type: "bot_started",
  timestamp: 1_700_000_000_000,
  chat_id: 555,
  user: { user_id: 67_890, first_name: "Михаил", is_bot: false },
  payload: "event-abc",
};

const created = {
  update_type: "message_created",
  timestamp: 1_700_000_001_000,
  message: {
    sender: { user_id: 67_890, first_name: "Михаил", is_bot: false },
    recipient: { chat_id: 555, chat_type: "dialog" },
    body: { text: "куда сходить вечером" },
  },
};

const pressed = {
  update_type: "message_callback",
  timestamp: 1_700_000_002_000,
  callback: { callback_id: "cb-1", payload: "today", user: { user_id: 67_890, first_name: "Михаил", is_bot: false } },
  message: { recipient: { chat_id: 555, chat_type: "dialog" }, body: { mid: "mid-pressed", text: "старое меню" } },
};

describe("parseUpdates", () => {
  it("normalizes the three updates the bot acts on", () => {
    const inbound = parseUpdates({ updates: [started, created, pressed] });
    expect(inbound).toHaveLength(3);
    expect(inbound[0]).toMatchObject({ kind: "start", maxUserId: "67890", userName: "Михаил", chatId: 555, startPayload: "event-abc" });
    expect(inbound[1]).toMatchObject({ kind: "text", text: "куда сходить вечером", chatType: "dialog" });
    expect(inbound[2]).toMatchObject({ kind: "callback", callbackPayload: "today", callbackId: "cb-1", chatId: 555, messageId: "mid-pressed" });
  });

  it("accepts a bare array as well as the { updates } envelope", () => {
    expect(parseUpdates([started])).toHaveLength(1);
  });

  it("accepts a single Update — that is what MAX POSTs to the webhook", () => {
    const inbound = parseUpdates(started);
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ kind: "start", maxUserId: "67890", userName: "Михаил", chatId: 555, startPayload: "event-abc" });
  });

  it("drops updates it does not act on instead of failing the page", () => {
    const inbound = parseUpdates({ updates: [{ update_type: "message_edited", message: created.message }, started] });
    expect(inbound).toHaveLength(1);
    expect(inbound[0]?.kind).toBe("start");
  });

  it("drops a malformed envelope rather than throwing at the webhook", () => {
    expect(parseUpdates(null)).toEqual([]);
    expect(parseUpdates("updates")).toEqual([]);
    expect(parseUpdates({ updates: "nope" })).toEqual([]);
    expect(parseUpdates({ updates: [{}] })).toEqual([]);
  });

  it("drops a message without a sender id — there is nobody to answer", () => {
    const headless = { update_type: "message_created", message: { recipient: { chat_id: 1 }, body: { text: "привет" } } };
    expect(parseUpdates({ updates: [headless] })).toEqual([]);
  });

  it("keeps a text message whose body is missing as an empty string", () => {
    const bodyless = { update_type: "message_created", message: { sender: { user_id: 1, first_name: "A", is_bot: false }, recipient: { chat_id: 2, chat_type: "dialog" } } };
    const inbound: BotInbound[] = parseUpdates({ updates: [bodyless] });
    expect(inbound[0]).toMatchObject({ kind: "text", text: "" });
  });
});

describe("botRich", () => {
  it("sends plain text without an attachments key", () => {
    expect(botText("привет")).toEqual({ text: "привет" });
    expect(botRich("привет")).toEqual({ text: "привет" });
  });

  it("adds the image and the keyboard MAX renders, and the markdown flag", () => {
    const body = botRich("**Меню**", { image: "https://cdn.example/hero.jpg", keyboard: [[{ type: "callback", text: "Сегодня", payload: "today" }]], markdown: true });
    expect(body).toEqual({
      text: "**Меню**",
      format: "markdown",
      attachments: [
        { type: "image", payload: { url: "https://cdn.example/hero.jpg" } },
        { type: "inline_keyboard", payload: { buttons: [[{ type: "callback", text: "Сегодня", payload: "today" }]] } },
      ],
    });
  });

  it("sends a gallery of unique images before the keyboard", () => {
    const body = botRich("карточки", { images: ["https://cdn.example/a.jpg", "https://cdn.example/a.jpg", "https://cdn.example/b.jpg"], image: "https://cdn.example/c.jpg" });
    expect(body.attachments).toEqual([
      { type: "image", payload: { url: "https://cdn.example/a.jpg" } },
      { type: "image", payload: { url: "https://cdn.example/b.jpg" } },
      { type: "image", payload: { url: "https://cdn.example/c.jpg" } },
    ]);
  });

  it("drops an empty keyboard and a blank image so MAX never gets an attachment it rejects", () => {
    const body = botRich("текст", { image: "   ", keyboard: [[]] });
    expect(body).toEqual({ text: "текст" });
  });
});
