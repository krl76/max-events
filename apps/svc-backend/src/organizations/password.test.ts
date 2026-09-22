import { describe, expect, it } from "vitest";
import { hashPassword, MAX_SCRYPT_N, SCRYPT_PARAMS, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("accepts the password it hashed and rejects any other", async () => {
    const stored = await hashPassword("s3cret");
    await expect(verifyPassword("s3cret", stored)).resolves.toBe(true);
    await expect(verifyPassword("s3cre", stored)).resolves.toBe(false);
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("salts every hash, so the same password never stores the same string", async () => {
    const first = await hashPassword("s3cret");
    const second = await hashPassword("s3cret");
    expect(first).not.toBe(second);
    await expect(verifyPassword("s3cret", second)).resolves.toBe(true);
  });

  it("stamps its own cost parameters into the stored value", async () => {
    const stored = await hashPassword("s3cret");
    expect(stored.startsWith(`scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$`)).toBe(true);
    // Verification derives with the stamped cost, so a tampered cost cannot reproduce the key.
    const tampered = stored.replace(`scrypt$${SCRYPT_PARAMS.N}$`, "scrypt$16384$");
    await expect(verifyPassword("s3cret", tampered)).resolves.toBe(false);
  });

  it("never keeps the password in the stored value", async () => {
    const stored = await hashPassword("s3cret");
    expect(stored).not.toContain("s3cret");
  });
});

describe("verifyPassword", () => {
  it("rejects a malformed or foreign hash instead of throwing", async () => {
    await expect(verifyPassword("s3cret", "")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "plaintext")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "$2b$10$abcdefghijklmnopqrstuv")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "scrypt$0$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "scrypt$32768$8$1$$")).resolves.toBe(false);
  });

  it("rejects costs scrypt itself refuses, so a corrupt row is a failed login and not a 500", async () => {
    // scrypt throws unless N is a power of two: the guard has to catch that before the call.
    await expect(verifyPassword("s3cret", "scrypt$3$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "scrypt$32769$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "scrypt$1.5$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
  });

  it("refuses a cost above the ceiling instead of allocating a gigabyte per attempt", async () => {
    await expect(verifyPassword("s3cret", `scrypt$${MAX_SCRYPT_N * 2}$8$1$c2FsdA==$aGFzaA==`)).resolves.toBe(false);
    await expect(verifyPassword("s3cret", "scrypt$32768$64$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
  });
});
