import { describe, expect, it } from "vitest";
import { placePhotoUrl } from "./place-covers";

describe("placePhotoUrl", () => {
  it("keeps a stored logo", () => {
    expect(placePhotoUrl({ title: "Парк Горького", logoUrl: "/custom.jpg" })).toBe("/custom.jpg");
  });

  it("matches a known Moscow venue even with extra quotes or spaces", () => {
    expect(placePhotoUrl({ title: "Парк Горького" })).toBe("/onboarding/gorky.jpg");
    expect(placePhotoUrl({ title: "«Лужники»" })).toBe("/covers/places/luzhniki.jpg");
    expect(placePhotoUrl({ title: "ГМИИ им. А. С. Пушкина" })).toBe("/covers/places/pushkin.jpg");
  });

  it("falls back to the category when the title is unknown", () => {
    expect(placePhotoUrl({ title: "Сквер на углу", category: "park" })).toBe("/onboarding/gorky.jpg");
    expect(placePhotoUrl({ title: "Новый зал", category: "museum" })).toBe("/covers/visits/museum.jpg");
  });
});
