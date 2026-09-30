import { describe, expect, it } from "vitest";
import { eventAcceptsPushkinCard } from "./benefits";

describe("eventAcceptsPushkinCard", () => {
  it("honours an explicit flag and otherwise treats paid afisha as eligible", () => {
    expect(eventAcceptsPushkinCard({ category: "afisha", isPaid: true })).toBe(true);
    expect(eventAcceptsPushkinCard({ category: "afisha", isPaid: false })).toBe(false);
    expect(eventAcceptsPushkinCard({ category: "sport", isPaid: true })).toBe(false);
    expect(eventAcceptsPushkinCard({ category: "afisha", isPaid: false, pushkinCard: true })).toBe(true);
    expect(eventAcceptsPushkinCard({ category: "afisha", isPaid: true, pushkinCard: false })).toBe(false);
  });
});
