import { describe, expect, it } from "vitest";
import { GatheringsScheduler } from "./gatherings.scheduler";
import { GatheringsService } from "./gatherings.service";

describe("GatheringsScheduler", () => {
  it("declares its GatheringsService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", GatheringsScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(GatheringsService);
  });
});
