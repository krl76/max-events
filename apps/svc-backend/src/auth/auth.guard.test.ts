import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { UserEntity } from "../users/user.entity";
import type { AuthService } from "./auth.service";
import { AuthGuard, MAX_INIT_DATA_HEADER, Public } from "./auth.guard";

const fakeUser = { id: "uuid-1", maxUserId: "67890", firstName: "Max" } as UserEntity;

function createGuard(authenticate: (initData: string) => Promise<UserEntity | null>) {
  return new AuthGuard({ authenticate } as unknown as AuthService, new Reflector());
}

function createContext(headers: Record<string, string> = {}, handler: object = () => {}) {
  const request: { header: (name: string) => string | undefined; currentUser?: UserEntity } = {
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
});
