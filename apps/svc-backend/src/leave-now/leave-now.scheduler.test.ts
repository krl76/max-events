import { describe, expect, it } from "vitest";
import { LeaveNowScheduler } from "./leave-now.scheduler";
import { LeaveNowService } from "./leave-now.service";

describe("LeaveNowScheduler", () => {
  it("declares its LeaveNowService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", LeaveNowScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(LeaveNowService);
  });
});
