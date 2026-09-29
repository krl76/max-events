import type { DayRoute } from "@max-events/api-contracts";

const KEY = "max-events.day-routes";
const LIMIT = 12;

export interface SavedDayRoute {
  id: string;
  savedAt: string;
  route: DayRoute;
}

export function dayRouteKey(route: DayRoute): string {
  return `${route.points.map((point) => point.title).join("→")}|${route.totalMinutes}|${route.totalKm}`;
}

function isSaved(value: unknown): value is SavedDayRoute {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<SavedDayRoute>;
  return typeof row.id === "string" && typeof row.savedAt === "string" && typeof row.route === "object" && row.route !== null && Array.isArray(row.route.points);
}

export function readSavedDayRoutes(storage: Pick<Storage, "getItem"> = localStorage): SavedDayRoute[] {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null || raw === "") return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSaved);
  } catch {
    return [];
  }
}

/** Newest first. The same stops and totals replace the previous copy instead of stacking. */
export function rememberDayRoute(route: DayRoute, storage: Pick<Storage, "getItem" | "setItem"> = localStorage, now = new Date()): SavedDayRoute[] {
  const key = dayRouteKey(route);
  const without = readSavedDayRoutes(storage).filter((item) => dayRouteKey(item.route) !== key);
  const next = [{ id: `${now.getTime()}`, savedAt: now.toISOString(), route }, ...without].slice(0, LIMIT);
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}
