import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CREATE_ENTRIES, CreateView } from "./CreatePage";
import { ROUTE_TITLES } from "../ui/Layout";
import type { Route } from "../routing/router";

describe("CREATE_ENTRIES", () => {
  it("offers the publication entries of the design in order", () => {
    expect(CREATE_ENTRIES.map((entry) => entry.label)).toEqual(["История", "Пост", "План", "Микро-событие"]);
  });

  it("points every entry at a known route", () => {
    for (const entry of CREATE_ENTRIES) {
      expect(ROUTE_TITLES[entry.route.name as Route["name"]]).toBeDefined();
    }
  });

  it("describes every entry, so no row is a bare label", () => {
    for (const entry of CREATE_ENTRIES) {
      expect(entry.description.trim()).not.toBe("");
    }
  });
});

describe("CreateView", () => {
  it("renders a row per entry with its label and description", () => {
    const html = renderToStaticMarkup(createElement(CreateView, { onPick: () => {} }));

    expect(html.match(/<button/g)).toHaveLength(CREATE_ENTRIES.length);
    for (const entry of CREATE_ENTRIES) {
      expect(html).toContain(entry.label);
      expect(html).toContain(entry.description);
    }
  });
});
