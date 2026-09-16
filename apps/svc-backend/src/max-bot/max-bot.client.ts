// START_MODULE_CONTRACT
// PURPOSE: Thin MAX Bot API wrapper — create a group chat and send a direct message.
// SCOPE: POST /chats and POST /messages with Authorization token from env; never throws to callers; token is not logged.
// DEPENDS: none (injectable fetch)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxBotClient - createChat(title), sendMessage(maxUserId, text)
// - MAX_BOT_API_BASE_URL - documented Bot API host
// END_MODULE_MAP

export const MAX_BOT_API_BASE_URL = "https://platform-api2.max.ru";

export type MaxBotChat = {
  chatId: number;
  link: string;
};

export type MaxBotFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
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
        headers: { Authorization: this.token, "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) return null;
      return parseChat(await response.json());
    } catch {
      return null;
    }
  }

  async sendMessage(maxUserId: string, text: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const url = `${this.baseUrl}/messages?user_id=${encodeURIComponent(maxUserId)}`;
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: { Authorization: this.token, "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return response.ok;
    } catch {
      return false;
    }
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
