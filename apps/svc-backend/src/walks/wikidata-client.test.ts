import { describe, expect, it } from "vitest";
import { fetchWikidataCandidates, WIKIDATA_SPARQL } from "./wikidata-client";

const pointBody = {
  results: {
    bindings: [
      {
        item: { value: "http://www.wikidata.org/entity/Q42" },
        itemLabel: { value: "Кремль" },
        coord: { value: "Point(37.6 54.2)" },
        itemDescription: { value: "Крепость" },
      },
    ],
  },
};

describe("fetchWikidataCandidates", () => {
  it("returns one candidate from a 200 body", async () => {
    const seen: { url?: string; userAgent?: string; accept?: string; body?: string } = {};
    const fetchImpl: typeof fetch = async (url, init) => {
      seen.url = String(url);
      const headers = new Headers(init?.headers);
      seen.userAgent = headers.get("User-Agent") ?? "";
      seen.accept = headers.get("Accept") ?? "";
      seen.body = typeof init?.body === "string" ? init.body : "";
      return new Response(JSON.stringify(pointBody), { status: 200 });
    };
    const rows = await fetchWikidataCandidates("Тула", ["cultural"], fetchImpl);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceUrl).toBe("https://www.wikidata.org/wiki/Q42");
    expect(seen.url).toBe(WIKIDATA_SPARQL);
    expect(seen.userAgent).toBe("max-events/city-walk");
    expect(seen.accept).toBe("application/sparql-results+json");
    expect(seen.body).toContain("wd:Q33506");
    expect(seen.body).toContain("Тула");
  });

  it("returns an empty list when the fetch hangs until abort", async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const rows = await fetchWikidataCandidates("Тула", ["parks"], fetchImpl, Date.now, 20);
    expect(rows).toEqual([]);
  });

  it("returns an empty list when the body is not JSON", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 200 });
    expect(await fetchWikidataCandidates("Тула", ["parks"], fetchImpl)).toEqual([]);
  });
});
