import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UserEntity } from "../users/user.entity";
import { AssistController } from "./assist.controller";
import type { AssistService } from "./assist.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;

describe("AssistController", () => {
  it("forwards a valid NL query", async () => {
    let seen = "";
    const assist = {
      suggest: async (_userId: string, query: string) => {
        seen = query;
        return { summary: "Нашел 0 вариантов по запросу.", criteria: { when: "any", budgetMaxRub: null, company: "alone", genre: "any" }, items: [] };
      },
    } as unknown as AssistService;
    const controller = new AssistController(assist);
    await expect(controller.suggest(user, { query: "Хочу вечером куда-нибудь" })).resolves.toMatchObject({ items: [] });
    expect(seen).toContain("вечером");
    await expect(controller.suggest(user, { query: "" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forwards Saturday day with save", async () => {
    let seenSave: boolean | undefined;
    const assist = {
      suggest: async () => ({ summary: "x", criteria: { when: "any", budgetMaxRub: null, company: "alone", genre: "any" }, items: [] }),
      planSaturday: async (_userId: string, _query: string, save: boolean) => {
        seenSave = save;
        return { summary: "Собрал день", date: "2026-09-12", stops: [{ at: "2026-09-12T12:00:00+03:00", event: { id: "00000000-0000-4000-8000-0000000000e1" }, explanation: "slot" }], planDraft: { eventId: "00000000-0000-4000-8000-0000000000e1", participantIds: [], meetingPoint: "x", meetingAt: "2026-09-12T12:00:00+03:00" }, plan: { id: "plan-1" } };
      },
    } as unknown as AssistService;
    const controller = new AssistController(assist);
    await expect(controller.planDay(user, { query: "Сделай нам план на субботу", save: true })).resolves.toMatchObject({ date: "2026-09-12", plan: { id: "plan-1" } });
    expect(seenSave).toBe(true);
  });
});
