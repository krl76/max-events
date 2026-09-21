import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Story } from "@max-events/api-contracts";
import { flattenStoryGroups, nextPosition, prevPosition, StoryViewer, type StoryGroup } from "./StoryViewer";

const story = (id: string): Story => ({ id, userId: "a0000000-0000-4000-8000-0000000000b1", imageUrl: "data:image/svg+xml;utf8,x", createdAt: "2026-09-16T10:00:00+03:00" });

const GROUPS: StoryGroup[] = [
  { authorName: "Анна", stories: [story("e1000000-0000-4000-8000-000000000001"), story("e1000000-0000-4000-8000-000000000002")] },
  { authorName: "Дима", stories: [story("e1000000-0000-4000-8000-000000000003")] },
];

describe("flattenStoryGroups", () => {
  it("flattens groups in viewing order with group metadata", () => {
    const positions = flattenStoryGroups(GROUPS);
    expect(positions.map((position) => [position.authorName, position.index, position.groupSize])).toEqual([
      ["Анна", 0, 2],
      ["Анна", 1, 2],
      ["Дима", 0, 1],
    ]);
  });
});

describe("viewer navigation", () => {
  it("advances across authors and reports the end past the very last story", () => {
    const positions = flattenStoryGroups(GROUPS);
    expect(nextPosition(positions, 0)).toBe(1);
    expect(nextPosition(positions, 1)).toBe(2);
    expect(nextPosition(positions, 2)).toBeNull();
  });

  it("steps back across authors but not before the first story", () => {
    expect(prevPosition(2)).toBe(1);
    expect(prevPosition(0)).toBeNull();
  });
});

describe("StoryViewer", () => {
  it("renders the starting author's segments, name and image", () => {
    const html = renderToStaticMarkup(createElement(StoryViewer, { groups: GROUPS, startGroup: 0, onClose: () => {} }));

    expect(html.match(/app-story-segment[" ]/g)?.length).toBe(2);
    expect(html).toContain("Анна");
    expect(html).toContain(GROUPS[0].stories[0].imageUrl);
    expect(html).toContain("Закрыть");
  });

  it("starts at another author's group when startGroup says so", () => {
    const html = renderToStaticMarkup(createElement(StoryViewer, { groups: GROUPS, startGroup: 1, onClose: () => {} }));

    expect(html).toContain("Дима");
    expect(html.match(/app-story-segment[" ]/g)?.length).toBe(1);
  });
});
