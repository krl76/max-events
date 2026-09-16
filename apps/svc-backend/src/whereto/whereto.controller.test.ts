import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { WheretoQuery, WheretoResponse } from "@max-events/api-contracts";
import { WheretoController } from "./whereto.controller";
import type { WheretoService } from "./whereto.service";

const response: WheretoResponse = { items: [] };

function createController() {
  const calls: WheretoQuery[] = [];
  const service = {
    suggest: async (query: WheretoQuery) => {
      calls.push(query);
      return response;
    },
  } as unknown as WheretoService;
  return { calls, controller: new WheretoController(service) };
}

describe("WheretoController", () => {
  it("rejects an invalid query", async () => {
    const { controller } = createController();
    await expect(controller.suggest({ company: "coworkers", mood: "calm", budget: "free" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.suggest({ company: "alone", mood: "active" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forwards a valid query to the service", async () => {
    const { calls, controller } = createController();
    await expect(controller.suggest({ company: "alone", mood: "active", budget: "any" })).resolves.toEqual(response);
    expect(calls).toEqual([{ company: "alone", mood: "active", budget: "any" }]);
  });
});
