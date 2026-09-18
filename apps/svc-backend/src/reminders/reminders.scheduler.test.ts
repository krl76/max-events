import { describe, expect, it } from "vitest";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

describe("RemindersScheduler", () => {
  it("declares its RemindersService dependency via @Inject for Nest DI", () => {
    const params = Reflect.getMetadata("self:paramtypes", RemindersScheduler) as Array<{ index: number; param: unknown }>;
    const injected = params.find((p) => p.index === 0);
    expect(injected?.param).toBe(RemindersService);
  });
});
