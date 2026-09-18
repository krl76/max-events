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
});
