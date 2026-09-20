import { describe, expect, it } from "vitest";
import { EventChatScheduler } from "./event-chat.scheduler";
import { EventsService } from "./events.service";

describe("EventChatScheduler", () => {
  it("declares its EventsService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", EventChatScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(EventsService);
  });
});
