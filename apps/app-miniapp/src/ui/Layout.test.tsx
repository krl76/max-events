import { describe, expect, it } from "vitest";
import { TABS } from "./Layout";

describe("Layout tabbar active predicates", () => {
  it("highlights only the Plans tab on the day-route screen", () => {
    const active = TABS.filter((tab) => tab.active("day-route"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("plans");
  });

  it("highlights the Plans tab on the plans and plan screens", () => {
    expect(TABS.find((tab) => tab.route === "plans")?.active("plans")).toBe(true);
    expect(TABS.find((tab) => tab.route === "plans")?.active("plan")).toBe(true);
  });

  it("keeps other screens off the Plans tab", () => {
    expect(TABS.find((tab) => tab.route === "plans")?.active("home")).toBe(false);
    expect(TABS.find((tab) => tab.route === "plans")?.active("friends")).toBe(false);
  });
});