import { describe, expect, it } from "vitest";
import { addressLine, nearestPlaceName } from "./address-at";

describe("addressLine", () => {
  it("joins the street, the house and the city", () => {
    expect(addressLine({ street: "Тверская улица", housenumber: "12", city: "Москва" })).toBe("Тверская улица, 12, Москва");
  });

  it("uses the place name when there is no street", () => {
    expect(addressLine({ name: "Парк Горького", city: "Москва" })).toBe("Парк Горького, Москва");
  });

  it("returns null when the payload is empty", () => {
    expect(addressLine({})).toBeNull();
  });
});

describe("nearestPlaceName", () => {
  const park = { title: "Парк Горького", address: "Крымский Вал, 9", latitude: 55.73, longitude: 37.6 };

  it("names a catalog place a short walk from the pin", () => {
    expect(nearestPlaceName([park], 55.731, 37.601)).toBe("Крымский Вал, 9");
  });

  it("ignores a place across the city", () => {
    expect(nearestPlaceName([park], 55.9, 37.9)).toBeNull();
  });
});
