import { describe, expect, it } from "vitest";
import { createOrganizerAuthService } from "./auth.organizer.testHarness";

const credentials = { ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "s3cret" };

describe("AuthService.organizerLogin", () => {
  it("is disabled (fail-closed) when organizer credentials are not configured", async () => {
    const { service } = createOrganizerAuthService({});
    await expect(service.organizerLogin("demo", "s3cret")).resolves.toBe("disabled");
  });

  it("rejects wrong credentials without creating a user or a session", async () => {
    const { service, redis, userRepo } = createOrganizerAuthService(credentials);
    await expect(service.organizerLogin("demo", "wrong")).resolves.toBeNull();
    await expect(service.organizerLogin("nobody", "s3cret")).resolves.toBeNull();
    expect(userRepo.store).toHaveLength(0);
    expect(redis.store.size).toBe(0);
  });

  it("creates the organizer user on first login and stores the session token in Redis", async () => {
    const { service, redis, userRepo } = createOrganizerAuthService(credentials);
    const result = await service.organizerLogin("demo", "s3cret");
    expect(result).not.toBeNull();
    expect(result).not.toBe("disabled");
    if (result === "disabled" || result === null) throw new Error("unreachable");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user.maxUserId).toBe("organizer:demo");
    expect(result.user.firstName).toBe("demo");
    expect(result.user.lastName).toBeNull();
    expect(redis.store.get(`organizer-session:${result.token}`)).toBe(result.user.id);
    expect(redis.setCalls[0]?.args).toEqual(["EX", 7 * 24 * 60 * 60]);
    expect(userRepo.store).toHaveLength(1);
  });

  it("reuses the same organizer user across logins", async () => {
    const { service, userRepo } = createOrganizerAuthService(credentials);
    const first = await service.organizerLogin("demo", "s3cret");
    const second = await service.organizerLogin("demo", "s3cret");
    if (first === "disabled" || first === null || second === "disabled" || second === null) throw new Error("unreachable");
    expect(userRepo.store).toHaveLength(1);
    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
  });

  it("keeps sessions of different logins apart", async () => {
    const { service } = createOrganizerAuthService(credentials);
    const first = await service.organizerLogin("demo", "s3cret");
    if (first === "disabled" || first === null) throw new Error("unreachable");
    await expect(service.authenticateOrganizerToken(first.token)).resolves.toMatchObject({ maxUserId: "organizer:demo" });
    await expect(service.authenticateOrganizerToken("0".repeat(64))).resolves.toBeNull();
  });
});
