// START_MODULE_CONTRACT
// PURPOSE: Thin MAX Bot API wrapper — send (plain and rich), answer a button callback, receive updates (webhook is inbound at the controller; this covers long polling), manage the webhook subscription, typing indicator, and bot commands.
// SCOPE: POST /chats and POST /messages (text or NewMessageBody with attachments), POST /answers?callback_id=, GET /updates long poll, POST/DELETE /subscriptions, POST /chats/{id}/actions typing, PATCH /me/commands, GET /me bot name. Authorization token from env; listFriends is a documented no-op (no public MAX friends method); every call is best-effort and never throws to callers; the token is never logged.
// DEPENDS: none (injectable fetch)
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxBotChat - chat id + invite link
// - MaxBotFetch - injectable fetch for tests
// - MaxBotUpdate - one raw update row as MAX delivers it (parsed into BotInbound by bot.types)
// - MaxBotClient - createChat, sendMessage, sendRich, sendChatMessage, answerCallback, getUpdates, subscribe, unsubscribe, sendTyping, setCommands, botName, listFriends
// - MAX_BOT_API_BASE_URL - documented Bot API host
// - MAX_WEBHOOK_SECRET_HEADER - header MAX sets on every webhook delivery when a subscription secret is configured
// - MAX_LONGPOLL_TIMEOUT_SECONDS - long-poll hold time (dev contour)
// END_MODULE_MAP

import type { BotMessageBody } from "../bot/bot.types";

export const MAX_BOT_API_BASE_URL = "https://platform-api2.max.ru";

/** MAX echoes the subscription secret here on every webhook POST; the controller compares it. */
export const MAX_WEBHOOK_SECRET_HEADER = "x-max-bot-api-secret";

/** GET /updates holds the connection this long server-side; 25s keeps it under the 30s nginx proxy timeout. */
export const MAX_LONGPOLL_TIMEOUT_SECONDS = 25;

export type MaxBotChat = {
  chatId: number;
  link: string;
};

/** A raw update row. bot.types.parseUpdates validates and normalizes these into BotInbound. */
export type MaxBotUpdate = Record<string, unknown>;

export type MaxBotUpdatesResult = {
  updates: MaxBotUpdate[];
  marker: number | null;
};

export type MaxBotFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class MaxBotClient {
  constructor(
    private readonly token: string | undefined,
    private readonly baseUrl: string = MAX_BOT_API_BASE_URL,
    private readonly fetchImpl: MaxBotFetch = fetch as MaxBotFetch,
  ) {}

  async createChat(title: string): Promise<MaxBotChat | null> {
    if (!this.token) return null;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chats`, {
        method: "POST",
        headers: this.jsonHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!response.ok) return null;
      return parseChat(await response.json());
    } catch {
      return null;
    }
  }

  async listFriends(_maxUserId: string): Promise<string[] | null> {
    return null;
  }

  async sendMessage(maxUserId: string, text: string): Promise<boolean> {
    return this.postToUser(maxUserId, { text });
  }

  /**
   * Send a NewMessageBody (text plus image / inline-keyboard attachments) into a dialog. This is the
   * rich path the conversational bot uses; sendMessage stays the plain-text path existing callers use.
   */
  async sendRich(maxUserId: string, body: BotMessageBody): Promise<boolean> {
    return this.postToUser(maxUserId, body);
  }

  async sendChatMessage(chatId: number, text: string): Promise<boolean> {
    if (!this.token) return false;
    return this.post(`${this.baseUrl}/messages?chat_id=${encodeURIComponent(String(chatId))}`, { text });
  }

  /**
   * Answer a button press. `message` edits the message that carried the keyboard; `notification`
   * raises a one-time toast. callbackId comes from the message_callback update.
   */
  async answerCallback(callbackId: string, answer: { message?: BotMessageBody | null; notification?: string | null }): Promise<boolean> {
    if (!this.token || callbackId.trim() === "") return false;
    const body: Record<string, unknown> = {};
    if (answer.message) body.message = answer.message;
    if (answer.notification) body.notification = answer.notification;
    return this.post(`${this.baseUrl}/answers?callback_id=${encodeURIComponent(callbackId)}`, body);
  }

  /** Long-poll the next page of updates. Dev/local contour only — production uses the webhook. */
  async getUpdates(marker: number | null, timeout = MAX_LONGPOLL_TIMEOUT_SECONDS): Promise<MaxBotUpdatesResult> {
    if (!this.token) return { updates: [], marker };
    const query = new URLSearchParams({ limit: "100", timeout: String(timeout) });
    if (marker !== null) query.set("marker", String(marker));
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/updates?${query.toString()}`, { method: "GET", headers: this.authHeaders() });
      if (!response.ok) return { updates: [], marker };
      const body = (await response.json()) as { updates?: unknown; marker?: unknown };
      const updates = Array.isArray(body.updates) ? (body.updates as MaxBotUpdate[]) : [];
      const next = typeof body.marker === "number" ? body.marker : marker;
      return { updates, marker: next };
    } catch {
      return { updates: [], marker };
    }
  }

  /** Point MAX at our HTTPS webhook. Returns true when the platform accepted the subscription. */
  async subscribe(url: string, updateTypes: readonly string[], secret?: string | undefined): Promise<boolean> {
    if (!this.token) return false;
    const body: Record<string, unknown> = { url, update_types: [...updateTypes] };
    if (secret && secret.trim() !== "") body.secret = secret;
    return this.post(`${this.baseUrl}/subscriptions`, body);
  }

  /** Drop the webhook so long polling becomes available again. */
  async unsubscribe(url: string): Promise<boolean> {
    if (!this.token) return false;
    return this.post(`${this.baseUrl}/subscriptions?url=${encodeURIComponent(url)}`, undefined, "DELETE");
  }

  /** Show the «печатает…» indicator while the bot composes a reply. Best-effort, fire-and-forget. */
  async sendTyping(chatId: number): Promise<boolean> {
    if (!this.token) return false;
    return this.post(`${this.baseUrl}/chats/${encodeURIComponent(String(chatId))}/actions`, { action: "typing_on" });
  }

  /** Publish the slash-command menu the MAX client shows above the input. */
  async setCommands(commands: ReadonlyArray<{ name: string; description: string }>): Promise<boolean> {
    if (!this.token) return false;
    return this.post(`${this.baseUrl}/me/commands`, { commands: commands.map((command) => ({ name: command.name, description: command.description })) }, "PATCH");
  }

  /** The bot's own public name (web_app for open_app buttons), or null when it cannot be read. */
  async botName(): Promise<string | null> {
    if (!this.token) return null;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/me`, { method: "GET", headers: this.authHeaders() });
      if (!response.ok) return null;
      const body = (await response.json()) as { username?: unknown };
      return typeof body.username === "string" && body.username !== "" ? body.username : null;
    } catch {
      return null;
    }
  }

  private async postToUser(maxUserId: string, body: BotMessageBody | { text: string }): Promise<boolean> {
    if (!this.token) return false;
    return this.post(`${this.baseUrl}/messages?user_id=${encodeURIComponent(maxUserId)}`, body);
  }

  private async post(url: string, body: unknown, method = "POST"): Promise<boolean> {
    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: this.jsonHeaders(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: this.token ?? "" };
  }

  private jsonHeaders(): Record<string, string> {
    return { Authorization: this.token ?? "", "content-type": "application/json" };
  }
}

function parseChat(body: unknown): MaxBotChat | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;
  const chatId = raw.chat_id ?? raw.chatId;
  const link = raw.link ?? raw.url;
  if (typeof chatId !== "number" || !Number.isFinite(chatId) || typeof link !== "string" || link.length === 0) return null;
  return { chatId, link };
}
