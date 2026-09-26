import { describe, expect, it } from "vitest";
import { splitStoryText } from "./story-text";

describe("splitStoryText", () => {
  it("underlines a stored handle and leaves the rest of the caption as text", () => {
    const parts = splitStoryText("идём с @anna вечером", [{ id: "00000000-0000-4000-8000-0000000000aa", handle: "anna" }]);
    expect(parts).toEqual([
      { type: "text", value: "идём с " },
      { type: "mention", value: "@anna", id: "00000000-0000-4000-8000-0000000000aa" },
      { type: "text", value: " вечером" },
    ]);
  });

  it("does not treat a longer name as the shorter handle", () => {
    const parts = splitStoryText("@anna @annabelle", [
      { id: "a", handle: "anna" },
      { id: "b", handle: "annabelle" },
    ]);
    expect(parts.map((part) => part.value)).toEqual(["@anna", " ", "@annabelle"]);
  });
});
