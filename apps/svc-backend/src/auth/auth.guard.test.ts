import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { OrganizationEntity } from "../organizations/organization.entity";
import { UserEntity } from "../users/user.entity";
import type { AuthService } from "./auth.service";
import { AuthGuard, MAX_INIT_DATA_HEADER, OrganizerOnly, Public } from "./auth.guard";

const fakeUser = { id: "uuid-1", maxUserId: "67890", firstName: "Max" } as UserEntity;
const organizerUser = { id: "uuid-org", maxUserId: "organizer:demo", firstName: "demo" } as UserEntity;
const organization = { id: "uuid-org-row", name: "Парк Горького", organizerUserId: organizerUser.id } as OrganizationEntity;

function createGuard(
  authenticate: (initData: string) => Promise<UserEntity | null>,
  authenticateOrganizerToken: (token: string) => Promise<UserEntity | null> = async () => null,
  authenticateOrganizerSession: (token: string) => Promise<{ user: UserEntity; organization: OrganizationEntity } | null> = async () => null,
) {
  return new AuthGuard({ authenticate, authenticateOrganizerToken, authenticateOrganizerSession } as unknown as AuthService, new Reflector());
}

function createContext(headers: Record<string, string> = {}, handler: object = () => {}) {
  const request: { header: (name: string) => string | undefined; currentUser?: UserEntity; currentOrganization?: OrganizationEntity } = {
    header: (name) => headers[name],
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("AuthGuard", () => {
  it("rejects requests without the initData header", async () => {
    const guard = createGuard(async () => fakeUser);
    const { context } = createContext();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects requests with invalid initData", async () => {
    const guard = createGuard(async () => null);
    const { context } = createContext({ [MAX_INIT_DATA_HEADER]: "forged" });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("passes valid initData and attaches the current user to the request", async () => {
    const guard = createGuard(async () => fakeUser);
    const { context, request } = createContext({ [MAX_INIT_DATA_HEADER]: "valid-init-data" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser).toBe(fakeUser);
  });

  it("lets @Public routes through without any initData", async () => {
    const guard = createGuard(async () => null);
    class PublicRoute {}
    Public()(PublicRoute);
    const { context } = createContext({}, PublicRoute);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("authenticates a valid organizer Bearer token and attaches the organizer user", async () => {
    const guard = createGuard(
      async () => null,
      async (token) => (token === "good-token" ? organizerUser : null),
    );
    const { context, request } = createContext({ authorization: "Bearer good-token" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser).toBe(organizerUser);
  });

  it("falls back to the initData path when the Bearer token is unknown", async () => {
    const guard = createGuard(async () => fakeUser);
    const { context, request } = createContext({ authorization: "Bearer stale-token", [MAX_INIT_DATA_HEADER]: "valid-init-data" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser).toBe(fakeUser);
  });

  it("rejects an unknown Bearer token when no initData is present", async () => {
    const guard = createGuard(async () => fakeUser);
    const { context } = createContext({ authorization: "Bearer stale-token" });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects @OrganizerOnly routes without a Bearer token, even with valid initData", async () => {
    const guard = createGuard(async () => fakeUser);
    class OrganizerRoute {}
    OrganizerOnly()(OrganizerRoute);
    const { context } = createContext({ [MAX_INIT_DATA_HEADER]: "valid-init-data" }, OrganizerRoute);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("authenticates @OrganizerOnly with a valid session and attaches the organization", async () => {
    const guard = createGuard(
      async () => fakeUser,
      async () => null,
      async (token) => (token === "good-token" ? { user: organizerUser, organization } : null),
    );
    class OrganizerRoute {}
    OrganizerOnly()(OrganizerRoute);
    const { context, request } = createContext({ authorization: "Bearer good-token" }, OrganizerRoute);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser).toBe(organizerUser);
    expect(request.currentOrganization).toBe(organization);
  });

  it("does not fall back to initData on @OrganizerOnly when the Bearer token is unknown", async () => {
    const guard = createGuard(async () => fakeUser);
    class OrganizerRoute {}
    OrganizerOnly()(OrganizerRoute);
    const { context } = createContext({ authorization: "Bearer stale-token", [MAX_INIT_DATA_HEADER]: "valid-init-data" }, OrganizerRoute);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
