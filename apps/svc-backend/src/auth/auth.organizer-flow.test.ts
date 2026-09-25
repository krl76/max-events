import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { CreateEventSchema, type Event } from "@max-events/api-contracts";
import type { EventsService } from "../events/events.service";
import type { OrganizationEntity } from "../organizations/organization.entity";
import type { UserEntity } from "../users/user.entity";
import { OrganizerController } from "../organizer/organizer.controller";
import { AuthGuard, OrganizerOnly } from "./auth.guard";
import { createOrganizerAuthService } from "./auth.organizer.testHarness";

const draftPayload = CreateEventSchema.parse({
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
});

function bearerContext(token: string, route: object) {
  const request: { header: (name: string) => string | undefined; currentUser?: UserEntity; currentOrganization?: OrganizationEntity } = {
    header: (name) => ({ authorization: `Bearer ${token}` })[name],
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => {},
    getClass: () => route,
  } as unknown as ExecutionContext;
  return { context, request };
}

function createEventsFake() {
  const store = new Map<string, Event[]>();
  let seq = 0;
  return {
    listMine: async (userId: string) => store.get(userId) ?? [],
    create: async (payload: unknown, userId: string) => {
      const event = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, ...(payload as object), chatLink: null, promoted: false } as Event;
      store.set(userId, [...(store.get(userId) ?? []), event]);
      return event;
    },
  } as unknown as EventsService;
}

describe("organizer Bearer flow", () => {
  it("creates an event via Bearer token and lists it in GET /organizer/events", async () => {
    const { service } = createOrganizerAuthService({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    const login = await service.organizerLogin("demo", "demo");
    if (typeof login !== "object" || login === null) throw new Error("unreachable");

    const guard = new AuthGuard(service, new Reflector());
    class OrganizerRoute {}
    OrganizerOnly()(OrganizerRoute);
    const { context, request } = bearerContext(login.token, OrganizerRoute);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser?.id).toBe(login.user.id);
    expect(request.currentOrganization?.id).toBe(login.organization.id);

    const controller = new OrganizerController(createEventsFake(), {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const created = await controller.createEventDraft(request.currentOrganization!, draftPayload);
    expect(await controller.listEvents(request.currentOrganization!)).toEqual([created]);
  });

  it("rejects a forged Bearer token on organizer routes", async () => {
    const { service } = createOrganizerAuthService({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    const guard = new AuthGuard(service, new Reflector());
    class OrganizerRoute {}
    OrganizerOnly()(OrganizerRoute);
    const { context } = bearerContext("f".repeat(64), OrganizerRoute);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
