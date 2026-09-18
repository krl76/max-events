import { describe, expect, it } from "vitest";
import { PlansScheduler } from "./plans.scheduler";
import { PlansService } from "./plans.service";

describe("PlansScheduler", () => {
  it("declares its PlansService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", PlansScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(PlansService);
  });
});
