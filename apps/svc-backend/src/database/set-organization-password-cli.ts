// START_MODULE_CONTRACT
// PURPOSE: CLI entry for rotating an organization password against the configured Postgres and Redis.
// SCOPE: read the login from ORGANIZER_ROTATE_LOGIN and the password from stdin (ORGANIZER_ROTATE_PASSWORD is the fallback), rehash through setOrganizationPassword, revoke that organization's live sessions, print the login and the revoked count, destroy; runs on a production host on purpose, unlike the demo seed.
// DEPENDS: ./data-source, ../config/env, ../redis/redis.module, ../organizations/organization.entity, ../organizations/set-password
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - readNewPassword - password from stdin, or from the fallback env var
// - runSetOrganizationPasswordCli - read input, rotate, revoke sessions, report
// END_MODULE_MAP

import "reflect-metadata";
// data-source import loads .env via src/config/env before the env vars below are read
import { AppDataSource } from "./data-source";
import { validateEnv } from "../config/env";
import { OrganizationEntity } from "../organizations/organization.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { formatRotationReport, parseNewPassword, revokeOrganizerSessions, setOrganizationPassword, type OrganizerSessionStore } from "../organizations/set-password";
import { createRedisClient } from "../redis/redis.module";

const LOGIN_VAR = "ORGANIZER_ROTATE_LOGIN";
const PASSWORD_VAR = "ORGANIZER_ROTATE_PASSWORD";

/**
 * stdin first: a password passed as `-e VAR=…` is visible in `ps` and lands in the shell history,
 * while a piped one belongs to no command line at all. The env var stays as the scripted fallback.
 */
export async function readNewPassword(): Promise<string> {
  const fromEnv = process.env[PASSWORD_VAR];
  if (fromEnv !== undefined) return parseNewPassword(fromEnv, PASSWORD_VAR);
  if (process.stdin.isTTY) throw new Error(`No password on stdin: pipe it in (read -rs PASS; printf '%s' "$PASS" | …) or set ${PASSWORD_VAR}`);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  // A pipe almost always carries the trailing newline of whatever produced it; the password does not.
  return parseNewPassword(
    chunks.length === 0
      ? ""
      : Buffer.concat(chunks)
          .toString("utf8")
          .replace(/\r?\n$/, ""),
    "the password on stdin",
  );
}

export async function runSetOrganizationPasswordCli() {
  const login = process.env[LOGIN_VAR];
  if (!login) throw new Error(`${LOGIN_VAR} is required: the login of the organization to rotate`);
  const password = await readNewPassword();
  const redisUrl = validateEnv().REDIS_URL;
  await AppDataSource.initialize();
  try {
    const organization = await setOrganizationPassword(new OrganizationsService(AppDataSource.getRepository(OrganizationEntity)), login, password);
    const sessions = createRedisClient(redisUrl);
    let revoked = 0;
    try {
      revoked = await revokeOrganizerSessions(sessions as unknown as OrganizerSessionStore, organization.organizerUserId);
    } catch (error: unknown) {
      // The password is already changed, so the operator has to hear that the second half failed.
      throw new Error(`Password updated, but the live organizer sessions were NOT revoked: ${error instanceof Error ? error.message : "redis error"}`);
    } finally {
      await sessions.quit().catch(() => {});
    }
    // The login identifies the account; the password and its hash stay out of the output.
    process.stdout.write(`${formatRotationReport(organization, revoked)}\n`);
  } finally {
    // Swallowed on purpose: a failure to close must not replace the error that brought us here.
    await AppDataSource.destroy().catch(() => {});
  }
}

void runSetOrganizationPasswordCli().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "organization password update failed"}\n`);
  process.exit(1);
});
