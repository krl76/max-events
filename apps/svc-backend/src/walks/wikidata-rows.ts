export type CityWalkCandidate = {
  readonly sourceUrl: string;
  readonly title: string;
  readonly description: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly classIds: readonly string[];
};

const CLASS_IDS = {
  cultural: ["Q33506", "Q24354", "Q207694"],
  iconic: ["Q570116"],
  parks: ["Q22698"],
  history: ["Q4989906"],
  architecture: ["Q16970"],
  unusual: ["Q570116"],
} as const;

type Interest = keyof typeof CLASS_IDS;

export function classIdsFor(interests: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const interest of interests) {
    if (!isInterest(interest)) continue;
    for (const id of CLASS_IDS[interest]) ids.add(id);
  }
  return [...ids];
}

function isInterest(value: string): value is Interest {
  return value in CLASS_IDS;
}

export function parseWikidataRows(payload: unknown, city: string): CityWalkCandidate[] {
  const bindings = readBindings(payload);
  const rows: CityWalkCandidate[] = [];
  for (const binding of bindings) {
    const row = readCandidate(binding, city);
    if (row !== null) rows.push(row);
  }
  return rows;
}

function readBindings(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.bindings)) return [];
  return results.bindings;
}

function readCandidate(binding: unknown, city: string): CityWalkCandidate | null {
  if (!isRecord(binding)) return null;
  const point = readValue(binding.coord);
  const item = readValue(binding.item);
  const title = readValue(binding.itemLabel);
  if (point === null || item === null || title === null) return null;
  const coord = readPoint(point);
  const qid = readQid(item);
  if (coord === null || qid === null) return null;
  const described = readValue(binding.itemDescription);
  return {
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    title,
    description: described ?? `Место в городе ${city}.`,
    latitude: coord.latitude,
    longitude: coord.longitude,
    classIds: readClassIds(binding.classes),
  };
}

function readPoint(value: string): { readonly latitude: number; readonly longitude: number } | null {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(value);
  if (match === null) return null;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

function readQid(item: string): string | null {
  const match = /\/(Q\d+)$/.exec(item);
  return match === null ? null : match[1] ?? null;
}

function readClassIds(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const raw = value.value;
  if (typeof raw !== "string") return [];
  return raw.split(",").filter((id) => id.startsWith("Q"));
}

function readValue(node: unknown): string | null {
  if (!isRecord(node)) return null;
  return typeof node.value === "string" && node.value !== "" ? node.value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
