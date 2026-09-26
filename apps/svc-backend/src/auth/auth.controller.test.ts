import { BadRequestException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { OrganizerSessionSchema } from "@max-events/api-contracts";
import { AuthController } from "./auth.controller";
import { createOrganizerAuthService } from "./auth.organizer.testHarness";

function createController(config: Record<string, string>) {
  const { service } = createOrganizerAuthService(config);
  return new AuthController(service);
}

describe("AuthController.browserInitData", () => {
  it("answers 404 when browser auth is disabled", async () => {
    const controller = createController({ MAX_BOT_TOKEN: "token" });
    await expect(controller.browserInitData()).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns signed initData when AUTH_ALLOW_BROWSER is on", async () => {
    const controller = createController({ MAX_BOT_TOKEN: "token", AUTH_ALLOW_BROWSER: "true" });
    const body = await controller.browserInitData();
    expect(body.initData.length).toBeGreaterThan(10);
  });
});

describe("AuthController.organizerLogin", () => {
  it("returns a session matching the OrganizerSession contract", async () => {
    const controller = createController({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    const session = await controller.organizerLogin({ login: "demo", password: "demo" });
    expect(() => OrganizerSessionSchema.parse(session)).not.toThrow();
    expect(session.organization.name).toBe("demo");
    expect(session.organization.contacts).toBeNull();
    expect(session.organization.activities).toEqual([]);
  });

  it("rejects wrong credentials with 401", async () => {
    const controller = createController({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    await expect(controller.organizerLogin({ login: "demo", password: "wrong" })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.organizerLogin({ login: "nobody", password: "demo" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("answers 503 when organizer credentials are not configured (fail-closed)", async () => {
    const controller = createController({});
    await expect(controller.organizerLogin({ login: "demo", password: "demo" })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects a malformed body with 400", async () => {
    const controller = createController({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    await expect(controller.organizerLogin({ login: "", password: "demo" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.organizerLogin({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("answers 429 after 5 failed attempts", async () => {
    const controller = createController({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(controller.organizerLogin({ login: "demo", password: "wrong" })).rejects.toBeInstanceOf(UnauthorizedException);
    }
    for (const body of [
      { login: "demo", password: "wrong" },
      { login: "demo", password: "demo" },
    ]) {
      const error = await controller.organizerLogin(body).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});

describe("AuthController.organizerLogout", () => {
  it("revokes the Bearer session and answers ok", async () => {
    const { service, redis } = createOrganizerAuthService({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    const controller = new AuthController(service);
    const session = await controller.organizerLogin({ login: "demo", password: "demo" });
    expect(redis.store.has(`organizer-session:${session.token}`)).toBe(true);
    await expect(controller.organizerLogout(`Bearer ${session.token}`)).resolves.toEqual({ ok: true });
    expect(redis.store.has(`organizer-session:${session.token}`)).toBe(false);
  });

  it("answers ok without an Authorization header (guard rejects such requests before this handler)", async () => {
    const controller = createController({});
    await expect(controller.organizerLogout(undefined)).resolves.toEqual({ ok: true });
  });
});
