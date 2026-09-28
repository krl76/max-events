import type { RouteMode } from "@max-events/api-contracts";
import { haversineMeters } from "../geo/haversine";
import { transferFor, travelMinutes } from "../routes/routes.service";

const DWELL_MINUTES = 20;
const FOOD_METERS = 800;

export type FitKind = "sight" | "food";

export type FitStop = {
  readonly id: string;
  readonly title: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly kind: FitKind;
};

export type FitLeg = {
  readonly fromTitle: string;
  readonly toTitle: string;
  readonly travelMinutes: number;
  readonly distanceKm: number;
  readonly mode: RouteMode;
  readonly transfers: number;
  readonly priceRub: number | null;
};

export type FitInput = {
  readonly stops: readonly FitStop[];
  readonly durationMinutes: number;
  readonly budgetMode: "free" | "any" | "custom";
  readonly budgetRub: number | null;
};

export type FitResult = {
  readonly stops: readonly FitStop[];
  readonly legs: readonly FitLeg[];
  readonly fitted: boolean;
};

export function fitWalk(input: FitInput): FitResult {
  const sights = input.stops.filter((stop) => stop.kind === "sight");
  const foods = input.stops.filter((stop) => stop.kind === "food");
  const ordered = shrink(orderFromCentroid(sights), input);
  const withFood = appendFood(ordered, foods, input);
  return { ...withFood, fitted: fits(withFood.stops, withFood.legs, input) };
}

function shrink(stops: readonly FitStop[], input: FitInput): readonly FitStop[] {
  let current = stops.slice(0, 6);
  while (current.length > 2 && durationOf(current, input.budgetMode) > input.durationMinutes) {
    current = dropFarthest(current);
  }
  while (current.length > 2 && overBudget(current, input)) {
    current = current.slice(0, -1);
  }
  return current;
}

function durationOf(stops: readonly FitStop[], budgetMode: FitInput["budgetMode"]): number {
  const legs = legsFor(stops, budgetMode);
  return DWELL_MINUTES * stops.length + legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
}

function overBudget(stops: readonly FitStop[], input: FitInput): boolean {
  if (input.budgetMode !== "custom" || input.budgetRub === null) return false;
  const price = legsFor(stops, input.budgetMode).reduce((sum, leg) => sum + (leg.priceRub ?? 0), 0);
  return price > input.budgetRub;
}

function appendFood(stops: readonly FitStop[], foods: readonly FitStop[], input: FitInput): { readonly stops: readonly FitStop[]; readonly legs: readonly FitLeg[] } {
  const base = { stops, legs: legsFor(stops, input.budgetMode) };
  if (input.budgetMode === "free" || stops.length === 0 || stops.length >= 6) return base;
  const last = stops[stops.length - 1];
  if (last === undefined) return base;
  const near = foods.find((food) => haversineMeters(last, food.latitude, food.longitude) <= FOOD_METERS);
  if (near === undefined) return base;
  const next = [...stops, near];
  const legs = legsFor(next, input.budgetMode);
  if (!fits(next, legs, input)) return base;
  return { stops: next, legs };
}

function fits(stops: readonly FitStop[], legs: readonly FitLeg[], input: FitInput): boolean {
  if (stops.length < 2) return false;
  const duration = DWELL_MINUTES * stops.length + legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
  if (duration > input.durationMinutes) return false;
  if (input.budgetMode !== "custom" || input.budgetRub === null) return true;
  const price = legs.reduce((sum, leg) => sum + (leg.priceRub ?? 0), 0);
  return price <= input.budgetRub;
}

function dropFarthest(stops: readonly FitStop[]): FitStop[] {
  const start = stops[0];
  if (start === undefined || stops.length < 2) return [...stops];
  let farIndex = 1;
  let farMeters = -1;
  for (let index = 1; index < stops.length; index += 1) {
    const stop = stops[index];
    if (stop === undefined) continue;
    const meters = haversineMeters(start, stop.latitude, stop.longitude);
    if (meters > farMeters) {
      farMeters = meters;
      farIndex = index;
    }
  }
  return stops.filter((_, index) => index !== farIndex);
}

function orderFromCentroid(stops: readonly FitStop[]): FitStop[] {
  if (stops.length === 0) return [];
  const centroid = {
    latitude: stops.reduce((sum, stop) => sum + stop.latitude, 0) / stops.length,
    longitude: stops.reduce((sum, stop) => sum + stop.longitude, 0) / stops.length,
  };
  const start = closest(stops, centroid.latitude, centroid.longitude);
  if (start === null) return [];
  const ordered = [start];
  const rest = stops.filter((stop) => stop.id !== start.id);
  while (rest.length > 0) {
    const previous = ordered[ordered.length - 1];
    if (previous === undefined) break;
    const next = closest(rest, previous.latitude, previous.longitude);
    if (next === null) break;
    ordered.push(next);
    const index = rest.findIndex((stop) => stop.id === next.id);
    if (index >= 0) rest.splice(index, 1);
  }
  return ordered;
}

function closest(stops: readonly FitStop[], latitude: number, longitude: number): FitStop | null {
  const first = stops[0];
  if (first === undefined) return null;
  return stops.reduce((best, stop) => (haversineMeters({ latitude, longitude }, stop.latitude, stop.longitude) < haversineMeters({ latitude, longitude }, best.latitude, best.longitude) ? stop : best), first);
}

function legsFor(stops: readonly FitStop[], budgetMode: FitInput["budgetMode"]): FitLeg[] {
  const legs: FitLeg[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1];
    const to = stops[index];
    if (from === undefined || to === undefined) continue;
    legs.push(legBetween(from, to, budgetMode));
  }
  return legs;
}

function legBetween(from: FitStop, to: FitStop, budgetMode: FitInput["budgetMode"]): FitLeg {
  const meters = haversineMeters(from, to.latitude, to.longitude);
  if (budgetMode === "free") {
    return { fromTitle: from.title, toTitle: to.title, travelMinutes: travelMinutes(meters, "walk"), distanceKm: meters / 1000, mode: "walk", transfers: 0, priceRub: null };
  }
  const transfer = transferFor(meters, "no_taxi");
  return { fromTitle: from.title, toTitle: to.title, travelMinutes: transfer.minutes, distanceKm: meters / 1000, mode: transfer.mode, transfers: 0, priceRub: transfer.priceRub };
}
