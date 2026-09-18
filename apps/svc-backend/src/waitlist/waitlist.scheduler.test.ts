import { describe, expect, it } from "vitest";
import { WaitlistScheduler } from "./waitlist.scheduler";
import { WaitlistService } from "./waitlist.service";

describe("WaitlistScheduler", () => {
  it("declares its WaitlistService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", WaitlistScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(WaitlistService);
  });
});
