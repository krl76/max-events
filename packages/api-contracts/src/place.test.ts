import { describe, expect, it } from "vitest";
import { CreatePlaceSchema, PlaceSchema } from "./place.js";

const validPlace = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  title: "Парк Горького",
  address: "ул. Крымский Вал, 9",
  city: "Москва",
  category: "park",
  latitude: 55.7297,
  longitude: 37.6035,
  createdAt: "2026-09-01T10:00:00+03:00",
  updatedAt: "2026-09-01T10:00:00+03:00",
};

describe("PlaceSchema", () => {
  it("accepts a valid place", () => {
    const parsed = PlaceSchema.parse(validPlace);
    expect(parsed.title).toBe("Парк Горького");
    expect(parsed.category).toBe("park");
    expect(parsed.logoUrl).toBeNull();
  });

  it("keeps an explicit logo URL and rejects a non-URL", () => {
    expect(PlaceSchema.parse({ ...validPlace, logoUrl: "https://cdn.example.com/gorky.png" }).logoUrl).toBe("https://cdn.example.com/gorky.png");
    expect(PlaceSchema.safeParse({ ...validPlace, logoUrl: "not-a-url" }).success).toBe(false);
  });

  it("defaults published to true and keeps an explicit value", () => {
    expect(PlaceSchema.parse(validPlace).published).toBe(true);
    expect(PlaceSchema.parse({ ...validPlace, published: false }).published).toBe(false);
  });

  it("rejects latitude outside [-90, 90]", () => {
    expect(PlaceSchema.safeParse({ ...validPlace, latitude: 95 }).success).toBe(false);
    expect(PlaceSchema.safeParse({ ...validPlace, latitude: -95 }).success).toBe(false);
  });

  it("rejects longitude outside [-180, 180]", () => {
    expect(PlaceSchema.safeParse({ ...validPlace, longitude: 200 }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(PlaceSchema.safeParse({ ...validPlace, category: "ship" }).success).toBe(false);
  });
});

describe("CreatePlaceSchema", () => {
  it("does not require id or timestamps", () => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = validPlace;
    expect(CreatePlaceSchema.safeParse(payload).success).toBe(true);
    expect(CreatePlaceSchema.safeParse({ ...payload, title: "" }).success).toBe(false);
    expect("published" in CreatePlaceSchema.parse({ ...payload, published: false })).toBe(false);
  });

  it("does not fill logoUrl on a title-only patch, so an existing logo is not wiped", () => {
    expect(CreatePlaceSchema.partial().parse({ title: "Новое имя" })).toEqual({ title: "Новое имя" });
  });
});
