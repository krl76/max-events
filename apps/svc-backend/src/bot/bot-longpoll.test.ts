import { describe, expect, it } from "vitest";
import { LONGPOLL_BACKOFF_MS, pollPage } from "./bot-longpoll";

const inboundRow = { update_type: "message_created", message: { sender: { user_id: 1, first_name: "A", is_bot: false }, recipient: { chat_id: 2, chat_type: "dialog" }, body: { text: "привет" } } };

function createService(handled: unknown[] = []) {
  return {
    handled,
    parse: (rows: unknown[]) => rows.map((row) => ({ kind: "text" as const, maxUserId: "1", userName: null, chatId: 2, chatType: "dialog", text: "привет", callbackPayload: "", callbackId: "", startPayload: "", row })),
    handleInbound: async (inbound: unknown) => {
      handled.push(inbound);
    },
  };
}

describe("pollPage", () => {
  it("processes every parsed update and advances the marker", async () => {
    const service = createService();
    const fetcher = { getUpdates: async () => ({ updates: [inboundRow], marker: 42 }) };
    const page = await pollPage(fetcher, service, 7);
    expect(page).toEqual({ marker: 42, ran: true });
    expect(service.handled).toHaveLength(1);
  });

  it("reports an idle page without processing and keeps the marker MAX returned", async () => {
    const service = createService();
    const page = await pollPage({ getUpdates: async () => ({ updates: [], marker: 9 }) }, service, 7);
    expect(page).toEqual({ marker: 9, ran: false });
    expect(service.handled).toEqual([]);
  });

  it("keeps the old marker when MAX returns none, so the page is retried instead of lost", async () => {
    const page = await pollPage({ getUpdates: async () => ({ updates: [], marker: null }) }, createService(), 5);
    expect(page.marker).toBe(5);
  });

  it("lets a fetch failure propagate so the loop backs off from the same marker", async () => {
    const fetcher = {
      getUpdates: async () => {
        throw new Error("network down");
      },
    };
    await expect(pollPage(fetcher, createService(), 5)).rejects.toThrow("network down");
  });

  it("backs off at least long enough for MAX not to rate-limit an idle stack", () => {
    expect(LONGPOLL_BACKOFF_MS).toBeGreaterThanOrEqual(1000);
  });
});
