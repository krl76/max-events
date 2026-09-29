import { classIdsFor, parseWikidataRows, type CityWalkCandidate } from "./wikidata-rows";

export const WIKIDATA_TIMEOUT_MS = 8_000;
export const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

export async function fetchWikidataCandidates(city: string, interests: readonly string[], fetchImpl: typeof fetch = fetch, now: () => number = Date.now, timeoutMs = WIKIDATA_TIMEOUT_MS): Promise<CityWalkCandidate[]> {
  const classIds = classIdsFor(interests);
  if (classIds.length === 0) return [];
  const startedAt = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, timeoutMs - (now() - startedAt)));
  try {
    const response = await fetchImpl(WIKIDATA_SPARQL, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/sparql-query",
        "User-Agent": "max-events/city-walk",
      },
      body: sparqlFor(city, classIds),
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return parseWikidataRows(await response.json(), city);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function sparqlFor(city: string, classIds: readonly string[]): string {
  const values = classIds.map((id) => `wd:${id}`).join(" ");
  return `SELECT ?item ?itemLabel ?itemDescription ?coord (GROUP_CONCAT(DISTINCT ?classId; SEPARATOR=",") AS ?classes) (SAMPLE(?image) AS ?photo) WHERE {
  VALUES ?class { ${values} }
  ?item wdt:P31 ?class .
  ?item wdt:P131* ?place .
  ?place rdfs:label ?placeLabel .
  FILTER(LANG(?placeLabel) = "ru")
  FILTER(CONTAINS(LCASE(?placeLabel), LCASE("${sparqlString(city)}")))
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?image }
  BIND(STRAFTER(STR(?class), "http://www.wikidata.org/entity/") AS ?classId)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
} GROUP BY ?item ?itemLabel ?itemDescription ?coord LIMIT 40`;
}

function sparqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
