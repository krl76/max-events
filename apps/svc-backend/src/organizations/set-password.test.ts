import { describe, expect, it } from "vitest";
import { createOrganizationRepoFake } from "../auth/auth.organizer.testHarness";
import { ORGANIZER_SESSION_PREFIX } from "../auth/organizer-session-key";
import { OrganizationEntity } from "./organization.entity";
import { OrganizationsService } from "./organizations.service";
import { hashPassword, UNSET_PASSWORD_HASH, verifyPassword } from "./password";
import { formatRotationReport, MIN_PASSWORD_LENGTH, parseNewPassword, revokeOrganizerSessions, setOrganizationPassword, type OrganizerSessionStore } from "./set-password";

const oldPassword = "leakedPassword01";
const newPassword = "freshPassword2026";
const organizerUserId = "00000000-0000-4000-8000-0000000000aa";

async function organization(login = "demo-org"): Promise<OrganizationEntity> {
  return { id: "00000000-0000-4000-8000-000000000001", name: "Демо", contacts: "tg: @demo", login, passwordHash: await hashPassword(oldPassword), organizerUserId, createdAt: new Date(), updatedAt: new Date() } as OrganizationEntity;
}

/** The plain fake returns the row it was given, so it cannot tell a saved rotation from a forgotten one. */
async function recordingRepo(rows: OrganizationEntity[]) {
  const base = createOrganizationRepoFake(rows);
  const saved: OrganizationEntity[] = [];
  const repo = {
    ...base,
    save: async (entity: OrganizationEntity) => {
      saved.push({ ...entity });
      return base.save(entity);
    },
  };
  return { repo: new OrganizationsService(repo as unknown as typeof base), saved, store: base.store };
}

describe("setOrganizationPassword", () => {
  it("writes the new password so the leaked one stops working", async () => {
    const { repo, saved } = await recordingRepo([await organization()]);

    const updated = await setOrganizationPassword(repo, "demo-org", newPassword);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.passwordHash).toBe(updated.passwordHash);
    await expect(verifyPassword(newPassword, updated.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(oldPassword, updated.passwordHash)).resolves.toBe(false);
  });

  it("stores a scrypt hash and never the plaintext", async () => {
    const { repo } = await recordingRepo([await organization()]);

    const updated = await setOrganizationPassword(repo, "demo-org", newPassword);

    expect(updated.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(updated.passwordHash).not.toContain(newPassword);
  });

  it("leaves the rest of the account alone", async () => {
    const { repo, store } = await recordingRepo([await organization()]);

    await setOrganizationPassword(repo, "demo-org", newPassword);

    expect(store[0]).toMatchObject({ name: "Демо", contacts: "tg: @demo", login: "demo-org", organizerUserId });
  });

  it("refuses to rotate a password to itself", async () => {
    // Re-hashing the leaked password changes the stored hash, so a silent success would report
    // remediation while the leaked password still opens the panel.
    const { repo, saved } = await recordingRepo([await organization()]);

    await expect(setOrganizationPassword(repo, "demo-org", oldPassword)).rejects.toThrow(/lock nobody out/);
    expect(saved).toHaveLength(0);
  });

  it("gives a password to a seeded account that never had one", async () => {
    const seeded = await organization();
    seeded.passwordHash = UNSET_PASSWORD_HASH;
    const { repo } = await recordingRepo([seeded]);

    const updated = await setOrganizationPassword(repo, "demo-org", newPassword);

    await expect(verifyPassword(newPassword, updated.passwordHash)).resolves.toBe(true);
  });

  it("refuses an unknown login instead of creating an account", async () => {
    // Self-registration is a NonGoal: a typo must not silently provision a second organization.
    const { repo, store } = await recordingRepo([await organization()]);

    await expect(setOrganizationPassword(repo, "typo-org", newPassword)).rejects.toThrow(/typo-org/);
    expect(store).toHaveLength(1);
  });
});

function createSessionStoreFake(entries: Record<string, string>, pageSize = 2): OrganizerSessionStore & { store: Map<string, string> } {
  const store = new Map(Object.entries(entries));
  return {
    store,
    // Paged like the real SCAN, so a revocation that only reads the first page fails here.
    scan: async (cursor: string) => {
      const keys = [...store.keys()];
      const from = Number(cursor);
      const page = keys.slice(from, from + pageSize);
      const next = from + pageSize >= keys.length ? "0" : String(from + pageSize);
      return [next, page] as [string, string[]];
    },
    get: async (key: string) => store.get(key) ?? null,
    del: async (...keys: string[]) => keys.filter((key) => store.delete(key)).length,
  };
}

describe("revokeOrganizerSessions", () => {
  it("drops every live session of this organization across scan pages", async () => {
    const sessions = createSessionStoreFake({
      [`${ORGANIZER_SESSION_PREFIX}a`]: organizerUserId,
      [`${ORGANIZER_SESSION_PREFIX}b`]: organizerUserId,
      [`${ORGANIZER_SESSION_PREFIX}c`]: organizerUserId,
      [`${ORGANIZER_SESSION_PREFIX}d`]: organizerUserId,
      [`${ORGANIZER_SESSION_PREFIX}e`]: organizerUserId,
    });

    await expect(revokeOrganizerSessions(sessions, organizerUserId)).resolves.toBe(5);
    expect(sessions.store.size).toBe(0);
  });

  it("leaves another organization's sessions alone", async () => {
    const other = "00000000-0000-4000-8000-0000000000bb";
    const sessions = createSessionStoreFake({
      [`${ORGANIZER_SESSION_PREFIX}mine`]: organizerUserId,
      [`${ORGANIZER_SESSION_PREFIX}theirs`]: other,
    });

    await expect(revokeOrganizerSessions(sessions, organizerUserId)).resolves.toBe(1);
    expect([...sessions.store.values()]).toEqual([other]);
  });

  it("has nothing to revoke for an organization that never logged in", async () => {
    const sessions = createSessionStoreFake({ [`${ORGANIZER_SESSION_PREFIX}theirs`]: organizerUserId });

    await expect(revokeOrganizerSessions(sessions, null)).resolves.toBe(0);
    expect(sessions.store.size).toBe(1);
  });
});

describe("formatRotationReport", () => {
  it("reports the account and the revoked sessions, and takes no password to leak", async () => {
    const line = formatRotationReport(await organization(), 3);

    expect(line).toContain("login=demo-org");
    expect(line).toContain("revoked: 3");
    expect(line).not.toContain(oldPassword);
    expect(line).not.toContain("scrypt$");
  });
});

describe("parseNewPassword", () => {
  it("returns the password unchanged when it is long enough", () => {
    expect(parseNewPassword(newPassword, "ORGANIZER_ROTATE_PASSWORD")).toBe(newPassword);
    expect(newPassword.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
  });

  it("names the source but never echoes the rejected value", () => {
    for (const [raw, pattern] of [
      [undefined, /required/],
      ["", /required/],
      ["shortOne", /too short/],
      [` ${newPassword} `, /whitespace/],
    ] as const) {
      const error = (() => {
        try {
          parseNewPassword(raw, "ORGANIZER_ROTATE_PASSWORD");
          return null;
        } catch (thrown) {
          return thrown as Error;
        }
      })();
      expect(error?.message).toMatch(pattern);
      expect(error?.message).toContain("ORGANIZER_ROTATE_PASSWORD");
      if (raw) expect(error?.message).not.toContain(raw.trim());
    }
  });

  it("rejects a password that a login form would not reproduce", () => {
    // A copy-paste with a trailing newline hashes fine here and then never matches at login.
    expect(() => parseNewPassword(`${newPassword}\n`, "ORGANIZER_ROTATE_PASSWORD")).toThrow(/whitespace/);
  });
});
