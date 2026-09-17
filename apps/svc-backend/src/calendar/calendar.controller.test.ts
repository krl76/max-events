import { describe, expect, it } from "vitest";
import type { CalendarResponse } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { CalendarController } from "./calendar.controller";
import type { CalendarService } from "./calendar.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const empty: CalendarResponse = { upcoming: [], past: [] };

describe("CalendarController", () => {
  it("lists the current user's calendar", async () => {
    let listedFor: string | undefined;
    const service = {
      list: async (userId: string) => {
        listedFor = userId;
        return empty;
      },
    } as unknown as CalendarService;
    const controller = new CalendarController(service);
    await expect(controller.list(user)).resolves.toEqual(empty);
    expect(listedFor).toBe(user.id);
  });
});
