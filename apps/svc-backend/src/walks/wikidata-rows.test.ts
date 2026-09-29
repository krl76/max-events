import { describe, expect, it } from "vitest";
import { classIdsFor, commonsPhotoUrl, parseWikidataRows } from "./wikidata-rows";

describe("parseWikidataRows", () => {
  it("drops a row without coordinates", () => {
    const rows = parseWikidataRows(
      {
        results: {
          bindings: [{ item: { value: "http://www.wikidata.org/entity/Q1" }, itemLabel: { value: "Кремль" } }],
        },
      },
      "Тула",
    );
    expect(rows).toEqual([]);
  });

  it("reads longitude first from a Point", () => {
    const rows = parseWikidataRows(
      {
        results: {
          bindings: [
            {
              item: { value: "http://www.wikidata.org/entity/Q42" },
              itemLabel: { value: "Кремль" },
              coord: { value: "Point(37.6 54.2)" },
              itemDescription: { value: "Крепость" },
              photo: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/Kremlin.jpg" },
            },
          ],
        },
      },
      "Тула",
    );
    expect(rows[0]).toMatchObject({
      sourceUrl: "https://www.wikidata.org/wiki/Q42",
      latitude: 54.2,
      longitude: 37.6,
      description: "Крепость",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Kremlin.jpg?width=800",
    });
  });

  it("returns an empty list when bindings are missing", () => {
    expect(parseWikidataRows({}, "Тула")).toEqual([]);
  });
});

describe("commonsPhotoUrl", () => {
  it("turns a commons file page into an https image with a width", () => {
    expect(commonsPhotoUrl("http://commons.wikimedia.org/wiki/Special:FilePath/Kremlin.jpg")).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Kremlin.jpg?width=800");
    expect(commonsPhotoUrl("not a url")).toBeNull();
  });
});

describe("classIdsFor", () => {
  it("unions the locked class ids", () => {
    expect(classIdsFor(["cultural", "parks"]).sort()).toEqual(["Q207694", "Q22698", "Q24354", "Q33506"]);
  });
});
