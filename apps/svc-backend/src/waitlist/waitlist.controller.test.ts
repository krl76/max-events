import "reflect-metadata";
import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import type { WaitlistEntry } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { WaitlistController } from "./waitlist.controller";
import type { WaitlistService } from "./waitlist.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: user.id,
  eventId,
  position: 1,
  status: "waiting",
  offeredUntil: null,
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
} as WaitlistEntry;

describe("WaitlistController.getMe", () => {
  it("forwards the authenticated user id and the query eventId", async () => {
    const calls: Array<{ userId: string; eventId: string }> = [];
    const service = {
      getMe: async (userId: string, requestedEventId: string) => {
        calls.push({ userId, eventId: requestedEventId });
        return entry;
      },
    } as unknown as WaitlistService;
    const controller = new WaitlistController(service);
    await expect(controller.getMe(user, eventId)).resolves.toEqual(entry);
    expect(calls).toEqual([{ userId: user.id, eventId }]);
  });

  it("rejects a missing or malformed eventId with BadRequestException via the wired pipe", async () => {
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, WaitlistController, "getMe") as Record<string, { data?: string; pipes?: Array<new () => ParseUUIDPipe> }>;
    const param = Object.values(metadata).find((arg) => arg.data === "eventId");
    expect(param?.pipes).toContain(ParseUUIDPipe);
    const pipe = new ParseUUIDPipe();
    await expect(pipe.transform(undefined as never, { type: "query", data: "eventId" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform("not-a-uuid", { type: "query", data: "eventId" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("WaitlistController.decline", () => {
  it("forwards the authenticated user id and the entry id to the service", async () => {
    const calls: Array<{ userId: string; id: string }> = [];
    const service = {
      decline: async (userId: string, id: string) => {
        calls.push({ userId, id });
        return { ...entry, status: "cancelled" };
      },
    } as unknown as WaitlistService;
    const controller = new WaitlistController(service);
    await expect(controller.decline(user, entry.id)).resolves.toMatchObject({ id: entry.id, status: "cancelled" });
    expect(calls).toEqual([{ userId: user.id, id: entry.id }]);
  });

  it("wires ParseUUIDPipe on the id param", async () => {
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, WaitlistController, "decline") as Record<string, { pipes?: Array<new () => ParseUUIDPipe> }>;
    const param = Object.values(metadata).find((arg) => arg.pipes?.includes(ParseUUIDPipe));
    expect(param).toBeDefined();
    await expect(new ParseUUIDPipe().transform("not-a-uuid", { type: "param", data: "id" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
