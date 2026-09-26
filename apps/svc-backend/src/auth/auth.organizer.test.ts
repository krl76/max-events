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
    expect([...redis.store.keys()].filter((key) => key.startsWith("organizer-session:"))).toHaveLength(0);
  });

  it("creates the organizer user on first login and stores the session token in Redis", async () => {
    const { service, redis, userRepo } = createOrganizerAuthService(credentials);
    const result = await service.organizerLogin("demo", "s3cret");
    expect(result).not.toBeNull();
    expect(result).not.toBe("disabled");
    if (result === "disabled" || result === "locked" || result === null) throw new Error("unreachable");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user.maxUserId).toBe("organizer:demo");
    expect(result.user.firstName).toBe("demo");
    expect(result.user.lastName).toBeNull();
    expect(redis.store.get(`organizer-session:${result.token}`)).toBe(result.organization.id);
    const sessionCall = redis.setCalls.find((call) => call.key === `organizer-session:${result.token}`);
    expect(sessionCall?.args).toEqual(["EX", 7 * 24 * 60 * 60]);
    expect(userRepo.store).toHaveLength(1);
  });

  it("reuses the same organizer user across logins", async () => {
    const { service, userRepo } = createOrganizerAuthService(credentials);
    const first = await service.organizerLogin("demo", "s3cret");
    const second = await service.organizerLogin("demo", "s3cret");
    if (typeof first !== "object" || first === null || typeof second !== "object" || second === null) throw new Error("unreachable");
    expect(userRepo.store).toHaveLength(1);
    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
  });

  it("keeps sessions of different logins apart", async () => {
    const { service } = createOrganizerAuthService(credentials);
    const first = await service.organizerLogin("demo", "s3cret");
    if (typeof first !== "object" || first === null) throw new Error("unreachable");
    await expect(service.authenticateOrganizerToken(first.token)).resolves.toMatchObject({ maxUserId: "organizer:demo" });
    await expect(service.authenticateOrganizerToken("0".repeat(64))).resolves.toBeNull();
  });
});

describe("AuthService.organizerLogin rate limiting", () => {
  it("locks the login after 5 failed attempts, rejecting even correct credentials", async () => {
    const { service } = createOrganizerAuthService(credentials);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(service.organizerLogin("demo", "wrong")).resolves.toBeNull();
    }
    await expect(service.organizerLogin("demo", "wrong")).resolves.toBe("locked");
    await expect(service.organizerLogin("demo", "s3cret")).resolves.toBe("locked");
  });

  it("keeps the failure counter as the only lock state, created with a 60s TTL", async () => {
    const { service, redis } = createOrganizerAuthService(credentials);
    for (let attempt = 0; attempt < 5; attempt++) {
      await service.organizerLogin("demo", "wrong");
    }
    expect(redis.store.get("organizer-login-fail:demo")).toBe("5");
    expect([...redis.store.keys()].filter((key) => key.includes("lock"))).toHaveLength(0);
    const counterCall = redis.setCalls.find((call) => call.key === "organizer-login-fail:demo");
    expect(counterCall?.args).toEqual(["EX", 60, "NX"]);
  });

  it("sets the counter TTL exactly once, on the first failed attempt", async () => {
    const { service, redis } = createOrganizerAuthService(credentials);
    await service.organizerLogin("demo", "wrong");
    await service.organizerLogin("demo", "wrong");
    const counterCalls = redis.setCalls.filter((call) => call.key === "organizer-login-fail:demo");
    expect(counterCalls).toHaveLength(1);
    expect(counterCalls[0]?.args).toEqual(["EX", 60, "NX"]);
  });

  it("resets the failure counter on a successful login", async () => {
    const { service, redis } = createOrganizerAuthService(credentials);
    for (let attempt = 0; attempt < 4; attempt++) {
      await service.organizerLogin("demo", "wrong");
    }
    const login = await service.organizerLogin("demo", "s3cret");
    if (typeof login !== "object" || login === null) throw new Error("unreachable");
    expect(redis.store.has("organizer-login-fail:demo")).toBe(false);
    for (let attempt = 0; attempt < 4; attempt++) {
      await service.organizerLogin("demo", "wrong");
    }
    await expect(service.organizerLogin("demo", "s3cret")).resolves.not.toBe("locked");
  });

  it("counts failures per login name", async () => {
    const { service } = createOrganizerAuthService(credentials);
    for (let attempt = 0; attempt < 5; attempt++) {
      await service.organizerLogin("other", "wrong");
    }
    const login = await service.organizerLogin("demo", "s3cret");
    if (typeof login !== "object" || login === null) throw new Error("unreachable");
    expect(login.token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("AuthService.organizerLogout", () => {
  it("deletes the session so the Bearer token no longer resolves", async () => {
    const { service } = createOrganizerAuthService(credentials);
    const login = await service.organizerLogin("demo", "s3cret");
    if (typeof login !== "object" || login === null) throw new Error("unreachable");
    await service.organizerLogout(login.token);
    await expect(service.authenticateOrganizerToken(login.token)).resolves.toBeNull();
  });

  it("leaves other sessions untouched", async () => {
    const { service } = createOrganizerAuthService(credentials);
    const first = await service.organizerLogin("demo", "s3cret");
    const second = await service.organizerLogin("demo", "s3cret");
    if (typeof first !== "object" || first === null || typeof second !== "object" || second === null) throw new Error("unreachable");
    await service.organizerLogout(first.token);
    await expect(service.authenticateOrganizerToken(second.token)).resolves.toMatchObject({ maxUserId: "organizer:demo" });
  });
});
