import { describe, expect, it } from "vitest";
import { ORGANIZER_SESSION_KEY, readStoredSession } from "./OrganizerAuthContext";

const session = {
  token: "mock-organizer-token",
  organization: { id: "e0000000-0000-4000-8000-000000000001", name: "Городские события", contacts: null },
};

function storageWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: () => value };
}

describe("readStoredSession", () => {
  it("returns null when nothing is stored", () => {
    expect(readStoredSession(storageWith(null))).toBeNull();
  });

  it("returns the session for a valid stored value", () => {
    expect(readStoredSession(storageWith(JSON.stringify(session)))).toEqual(session);
  });

  it("returns null for malformed JSON or a schema-invalid value", () => {
    expect(readStoredSession(storageWith("{oops"))).toBeNull();
    expect(readStoredSession(storageWith(JSON.stringify({ token: "" })))).toBeNull();
  });

  it("reads from the organizer session key", () => {
    let queried: string | null = null;
    readStoredSession({ getItem: (key: string) => ((queried = key), null) });
    expect(queried).toBe(ORGANIZER_SESSION_KEY);
  });
});
