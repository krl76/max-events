import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_AUTH_DATE_AGE_SECONDS, validateInitData } from "./max-init-data";

const BOT_TOKEN = "test-bot-token";
const NOW = 1_800_000_000;

const USER_JSON = JSON.stringify({
  id: 67890,
  first_name: "Max",
  last_name: "User",
  username: null,
  language_code: "ru",
  photo_url: null,
});

function sign(entries: Record<string, string>, token: string = BOT_TOKEN): string {
  const dataCheckString = Object.entries(entries)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function buildInitData(entries: Record<string, string>, token?: string): string {
  return Object.entries({ ...entries, hash: sign(entries, token) })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

function validInitData(authDate: number = NOW): string {
  return buildInitData({ auth_date: String(authDate), query_id: "4c0ab423-342b-4e45-aea4-2747dbc500cd", user: USER_JSON });
}

describe("validateInitData", () => {
  it("accepts a correctly signed initData and returns the user", () => {
    const result = validateInitData(validInitData(), BOT_TOKEN, NOW);
    expect(result?.user.id).toBe(67890);
    expect(result?.user.first_name).toBe("Max");
    expect(result?.authDate).toBe(NOW);
    expect(result?.params.query_id).toBe("4c0ab423-342b-4e45-aea4-2747dbc500cd");
  });

  it("rejects a tampered hash (signed with a different token)", () => {
    const initData = validInitData().replace(/hash=[0-9a-f]{64}/, `hash=${sign({ x: "1" })}`);
    expect(validateInitData(initData, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects when a value is tampered after signing", () => {
    const tampered = validInitData().replace("Max", "Mallory");
    expect(validateInitData(tampered, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects initData signed for a different bot token", () => {
    expect(validateInitData(validInitData(), "another-token", NOW)).toBeNull();
  });

  it("rejects an expired auth_date", () => {
    const stale = NOW - MAX_AUTH_DATE_AGE_SECONDS - 1;
    expect(validateInitData(validInitData(stale), BOT_TOKEN, NOW)).toBeNull();
  });

  it("accepts auth_date at the freshness boundary", () => {
    expect(validateInitData(validInitData(NOW - MAX_AUTH_DATE_AGE_SECONDS), BOT_TOKEN, NOW)).not.toBeNull();
  });

  it("rejects an auth_date from the future beyond clock skew", () => {
    expect(validateInitData(validInitData(NOW + 3600), BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects a replayed initData once it has aged out of the freshness window", () => {
    const initData = validInitData();
    expect(validateInitData(initData, BOT_TOKEN, NOW)).not.toBeNull();
    expect(validateInitData(initData, BOT_TOKEN, NOW + MAX_AUTH_DATE_AGE_SECONDS + 1)).toBeNull();
  });

  it("rejects initData without a hash", () => {
    const noHash = `auth_date=${NOW}&user=${encodeURIComponent(USER_JSON)}`;
    expect(validateInitData(noHash, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects initData with a duplicated hash parameter", () => {
    const initData = validInitData();
    const hash = initData.match(/hash=[0-9a-f]{64}/)?.[0];
    expect(validateInitData(`${initData}&${hash}`, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects initData without a user payload", () => {
    const initData = buildInitData({ auth_date: String(NOW), query_id: "q-1" });
    expect(validateInitData(initData, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects a user payload that is not valid JSON or misses required fields", () => {
    expect(validateInitData(buildInitData({ auth_date: String(NOW), user: "not-json" }), BOT_TOKEN, NOW)).toBeNull();
    expect(validateInitData(buildInitData({ auth_date: String(NOW), user: JSON.stringify({ id: 1 }) }), BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects malformed pairs and invalid percent-encoding", () => {
    expect(validateInitData("no-equals-sign", BOT_TOKEN, NOW)).toBeNull();
    expect(validateInitData(buildInitData({ auth_date: String(NOW), user: USER_JSON }).replace("%7B", "%zz"), BOT_TOKEN, NOW)).toBeNull();
  });
});
