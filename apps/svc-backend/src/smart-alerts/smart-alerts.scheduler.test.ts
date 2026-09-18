import { describe, expect, it } from "vitest";
import { ListDigestService } from "./list-digest.service";
import { SmartAlertsScheduler } from "./smart-alerts.scheduler";
import { SmartAlertsService } from "./smart-alerts.service";

describe("SmartAlertsScheduler", () => {
  it("declares both service dependencies via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", SmartAlertsScheduler) as Array<{
      index: number;
      param: unknown;
    }>;
    expect(params.find((p) => p.index === 0)?.param).toBe(SmartAlertsService);
    expect(params.find((p) => p.index === 1)?.param).toBe(ListDigestService);
  });
});
