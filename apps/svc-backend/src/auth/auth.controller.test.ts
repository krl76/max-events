import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { OrganizerSessionSchema } from "@max-events/api-contracts";
import { AuthController } from "./auth.controller";
import { createOrganizerAuthService } from "./auth.organizer.testHarness";

function createController(config: Record<string, string>) {
  const { service } = createOrganizerAuthService(config);
  return new AuthController(service);
}

describe("AuthController.organizerLogin", () => {
  it("returns a session matching the OrganizerSession contract", async () => {
    const controller = createController({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    const session = await controller.organizerLogin({ login: "demo", password: "demo" });
    expect(() => OrganizerSessionSchema.parse(session)).not.toThrow();
    expect(session.organization.name).toBe("demo");
    expect(session.organization.contacts).toBeNull();
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
});
