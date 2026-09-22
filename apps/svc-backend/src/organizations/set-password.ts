// START_MODULE_CONTRACT
// PURPOSE: Rotate the password of an existing organization and lock out the sessions the old one opened.
// SCOPE: parseNewPassword validates the replacement; setOrganizationPassword rewrites passwordHash through the shared scrypt helper and refuses a no-op rotation; revokeOrganizerSessions drops that organization's Redis sessions, without which a leaked password keeps its Bearer token alive for the full 7-day TTL; formatRotationReport builds the operator line. Nothing here returns, throws or logs the plaintext; no self-service registration, no password reads.
// DEPENDS: typeorm, ../auth/organizer-session-key, ./organization.entity, ./password
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MIN_PASSWORD_LENGTH - shortest replacement the rotation accepts
// - OrganizerSessionStore - the three Redis commands the revocation needs
// - parseNewPassword - validate a replacement password, naming the source in the error
// - setOrganizationPassword - rehash and store the password of the organization with this login
// - revokeOrganizerSessions - drop every live organizer session of one organization
// - formatRotationReport - operator-facing line: login, id, revoked sessions, never the password
// END_MODULE_MAP

import { Repository } from "typeorm";
import { ORGANIZER_SESSION_PREFIX } from "../auth/organizer-session-key";
import { OrganizationEntity } from "./organization.entity";
import { hashPassword, verifyPassword } from "./password";

export const MIN_PASSWORD_LENGTH = 12;

/** Keys per DEL, so revoking a busy organization does not build one enormous command. */
const DELETE_BATCH = 500;

/**
 * `source` names the env var in the message, so an operator sees what to fix. The value never
 * appears in the error: a rotation that fails must not leave the rejected password in a log.
 */
export function parseNewPassword(raw: string | undefined, source: string): string {
  if (raw === undefined || raw === "") throw new Error(`${source} is required: pass the new password in that environment variable`);
  if (raw.length < MIN_PASSWORD_LENGTH) throw new Error(`${source} is too short: at least ${MIN_PASSWORD_LENGTH} characters`);
  if (raw.trim() !== raw) throw new Error(`${source} starts or ends with whitespace, which a login form will not reproduce`);
  return raw;
}

export async function setOrganizationPassword(organizations: Repository<OrganizationEntity>, login: string, password: string): Promise<OrganizationEntity> {
  const organization = await organizations.findOneBy({ login });
  if (!organization) throw new Error(`No organization with login "${login}"`);
  // Re-hashing the leaked password would change the stored hash and report success while the leaked
  // password still works. A rotation that locks nobody out is worse than a refusal.
  if (await verifyPassword(password, organization.passwordHash)) throw new Error("The new password is the current one: rotating to it would lock nobody out");
  organization.passwordHash = await hashPassword(password);
  return organizations.save(organization);
}

/** The subset of ioredis the revocation uses, so the logic can be exercised without a server. */
export type OrganizerSessionStore = {
  scan(cursor: string, matchToken: "MATCH", pattern: string, countToken: "COUNT", count: number): Promise<[string, string[]]>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
};

/**
 * Sessions are opaque tokens keyed by the organizer user id, with a 7-day TTL and no link back to the
 * password. Changing the hash therefore does not end a session the leaked password opened — this does.
 */
export async function revokeOrganizerSessions(sessions: OrganizerSessionStore, organizerUserId: string | null): Promise<number> {
  if (!organizerUserId) return 0;
  const mine: string[] = [];
  let cursor = "0";
  // Collect first, delete after: deleting mid-scan moves the cursor's ground under it, and one pass
  // that skips a single session leaves the leaked password a way in.
  do {
    const [next, keys] = await sessions.scan(cursor, "MATCH", `${ORGANIZER_SESSION_PREFIX}*`, "COUNT", 200);
    cursor = next;
    for (const key of keys) {
      if ((await sessions.get(key)) === organizerUserId) mine.push(key);
    }
  } while (cursor !== "0");
  let revoked = 0;
  for (let from = 0; from < mine.length; from += DELETE_BATCH) revoked += await sessions.del(...mine.slice(from, from + DELETE_BATCH));
  return revoked;
}

/** Takes no password, so no change to the call site can make the report leak one. */
export function formatRotationReport(organization: OrganizationEntity, revokedSessions: number): string {
  return `organization password updated: login=${organization.login} id=${organization.id}; organizer sessions revoked: ${revokedSessions}`;
}
