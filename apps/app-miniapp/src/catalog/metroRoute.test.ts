import { describe, expect, it } from "vitest";
import { planMetroRide } from "./metroRoute";

const KROPOTKINSKAYA = { lat: 55.7453, lng: 37.6038 };
const BIBLIOTEKA = { lat: 55.7512, lng: 37.61 };
const TAGANSKAYA = { lat: 55.7418, lng: 37.6533 };

describe("planMetroRide", () => {
  it("у станции без поездки оставляет только два пеших шага", () => {
    const ride = planMetroRide(KROPOTKINSKAYA, KROPOTKINSKAYA);

    expect(ride).not.toBeNull();
    expect(ride?.transfers).toBe(0);
    expect(ride?.minutes).toBe(2);
    expect(ride?.steps).toEqual(["Пешком до «Кропоткинская» · 1 мин", "От «Кропоткинская» пешком · 1 мин"]);
    expect(ride?.steps.some((step) => step.includes("линия:") || step.includes("Пересадка"))).toBe(false);
  });

  it("одну станцию по Сокольнической пишет без пересадки", () => {
    const ride = planMetroRide(KROPOTKINSKAYA, BIBLIOTEKA);

    expect(ride?.transfers).toBe(0);
    expect(ride?.steps.some((step) => step.includes("Сокольническая линия: Кропоткинская → Библиотека имени Ленина"))).toBe(true);
    expect(ride?.steps.some((step) => step.includes("Пересадка"))).toBe(false);
  });

  it("до Таганской называет линию и пересадку", () => {
    const ride = planMetroRide(KROPOTKINSKAYA, TAGANSKAYA);

    expect(ride).not.toBeNull();
    expect(ride!.transfers).toBeGreaterThan(0);
    expect(ride?.steps.some((step) => step.includes("линия:"))).toBe(true);
    expect(ride?.steps.some((step) => step.startsWith("Пересадка"))).toBe(true);
    expect(ride?.steps[0]).toContain("Пешком до");
    expect(ride?.steps.at(-1)).toContain("пешком");
  });

  it("за океаном маршрута нет", () => {
    expect(planMetroRide({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeNull();
    expect(planMetroRide({ lat: 0, lng: 0 }, KROPOTKINSKAYA)).toBeNull();
  });

  it("один и тот же запрос даёт один и тот же маршрут", () => {
    expect(JSON.stringify(planMetroRide(KROPOTKINSKAYA, TAGANSKAYA))).toBe(JSON.stringify(planMetroRide(KROPOTKINSKAYA, TAGANSKAYA)));
  });
});
