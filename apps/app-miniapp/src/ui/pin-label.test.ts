import { describe, expect, it } from "vitest";
import { parsePinLabel, pinLabel, placePinLabel, placePinTitle } from "./pin-label";

describe("place pin labels", () => {
  it("keeps a bare coordinate string readable as a map point", () => {
    expect(pinLabel(55.7522, 37.6156)).toBe("55.75220, 37.61560");
    expect(parsePinLabel("55.75220, 37.61560")).toEqual({ lat: 55.7522, lng: 37.6156 });
    expect(placePinTitle("55.75220, 37.61560")).toBe("Точка на карте");
  });

  it("shows the street and still finds the coordinates after it", () => {
    const label = placePinLabel("Тверская улица, 12", 55.7522, 37.6156);

    expect(placePinTitle(label)).toBe("Тверская улица, 12");
    expect(parsePinLabel(label)).toEqual({ lat: 55.7522, lng: 37.6156 });
  });

  it("leaves a venue name untouched", () => {
    expect(parsePinLabel("Парк Горького")).toBeNull();
    expect(placePinTitle("Парк Горького")).toBe("Парк Горького");
  });
});
