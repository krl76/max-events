// START_MODULE_CONTRACT
// PURPOSE: Password hashing for organization accounts — scrypt from node:crypto, no native build in the image.
// SCOPE: hashPassword / verifyPassword over the self-describing "scrypt$N$r$p$salt$hash" format; comparison is constant-time.
// DEPENDS: node:crypto
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SCRYPT_PARAMS - cost parameters stamped into every new hash
// - hashPassword - password to a storable "scrypt$..." string
// - verifyPassword - constant-time check of a password against a stored hash
// END_MODULE_MAP

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** OWASP-recommended baseline for scrypt (N=2^15). Stamped per hash so cost can be raised later without breaking old rows. */
export const SCRYPT_PARAMS = { N: 32_768, r: 8, p: 1, keyLength: 32, saltLength: 16 } as const;

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number; keyLength: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must cover 128*N*r; the default 32 MiB is below what N=32768 needs.
    scrypt(password, salt, params.keyLength, { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_PARAMS.saltLength);
  const key = await derive(password, salt, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N <= 1 || r <= 0 || p <= 0) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await derive(password, salt, { N, r, p, keyLength: expected.length });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
