import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CalendarResponse, SharedCalendar } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { CalendarController } from "./calendar.controller";
import type { CalendarService } from "./calendar.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const peerId = "00000000-0000-4000-8000-00000000000b";
const empty: CalendarResponse = { upcoming: [], past: [] };
const shared: SharedCalendar = { peers: [], entries: [], inviteUrl: null };
const req = { headers: { host: "events.versacegus.cc" } };

describe("CalendarController", () => {
  it("forwards the current user and an optional from/to window", async () => {
    const calls: { userId?: string; range?: { from: Date | null; to: Date | null } } = {};
    const service = {
      list: async (userId: string, _now: Date, range: { from: Date | null; to: Date | null }) => {
        calls.userId = userId;
        calls.range = range;
        return empty;
      },
    } as unknown as CalendarService;
    const controller = new CalendarController(service);
    await expect(controller.list(user, {})).resolves.toEqual(empty);
    expect(calls).toEqual({ userId: user.id, range: { from: null, to: null } });
    await expect(controller.list(user, { from: "2026-09-15T00:00:00Z", to: "2026-09-20T00:00:00Z" })).resolves.toEqual(empty);
    expect(calls.range?.from?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(calls.range?.to?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("rejects a reversed or non-timestamp calendar range", async () => {
    const service = { list: async () => empty } as unknown as CalendarService;
    const controller = new CalendarController(service);
    await expect(controller.list(user, { from: "nope" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.list(user, { from: "2026-09-30T00:00:00Z", to: "2026-09-01T00:00:00Z" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forwards shared-calendar peers, going and invite accept, and rejects a bad body", async () => {
    const calls: { add?: { peerId: string; canEdit: boolean; host: string | null }; going?: string; accept?: string } = {};
    const service = {
      shared: async () => shared,
      addPeer: async (_userId: string, peerId: string, canEdit: boolean, host: string | null) => {
        calls.add = { peerId, canEdit, host };
        return shared;
      },
      going: async (_userId: string, bookingId: string) => {
        calls.going = bookingId;
        return shared;
      },
      acceptInvite: async (_userId: string, token: string) => {
        calls.accept = token;
        return shared;
      },
      revokePeer: async () => shared,
    } as unknown as CalendarService;
    const controller = new CalendarController(service);
    await expect(controller.shared(user, {}, req)).resolves.toEqual(shared);
    await expect(controller.addPeer(user, { userId: peerId }, req)).resolves.toEqual(shared);
    expect(calls.add).toEqual({ peerId, canEdit: true, host: "events.versacegus.cc" });
    await expect(controller.addPeer(user, { userId: peerId, canEdit: false }, req)).resolves.toEqual(shared);
    expect(calls.add?.canEdit).toBe(false);
    await expect(controller.addPeer(user, {}, req)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.going(user, "00000000-0000-4000-8000-0000000000b1", req)).resolves.toEqual(shared);
    expect(calls.going).toBe("00000000-0000-4000-8000-0000000000b1");
    const inviteToken = "00000000-0000-4000-8000-0000000000aa"; // mock- uuid, not a real secret
    await expect(controller.acceptInvite(user, { token: inviteToken }, req)).resolves.toEqual(shared);
    expect(calls.accept).toBe(inviteToken);
    await expect(controller.acceptInvite(user, {}, req)).rejects.toBeInstanceOf(BadRequestException);
  });
});
