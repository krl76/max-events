import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { EventWeatherService } from "./event-weather.service";
import { WeatherController } from "./weather.controller";

function createController() {
  const calls: { mapNow?: { latitude: number; longitude: number }; hoursAt?: { latitude: number; longitude: number; from: Date; to: Date }; city?: string } = {};
  const weather = {
    mapNow: async (latitude: number, longitude: number) => {
      calls.mapNow = { latitude, longitude };
      return { temperatureC: 19, condition: "ясно", changesAt: "2026-09-12T19:00:00.000Z", changesTo: "дождь" };
    },
    hoursAt: async (latitude: number, longitude: number, from: Date, to: Date) => {
      calls.hoursAt = { latitude, longitude, from, to };
      return { source: "Open-Meteo", hours: [], note: null };
    },
    coordsForCity: async (city: string) => {
      calls.city = city;
      return city === "Москва" ? { latitude: 55.75, longitude: 37.62 } : null;
    },
  } as unknown as EventWeatherService;
  return { calls, controller: new WeatherController(weather) };
}

describe("WeatherController", () => {
  it("resolves the map chip by city or by coordinates", async () => {
    const { calls, controller } = createController();
    await expect(controller.now({ city: "Москва" })).resolves.toMatchObject({ temperatureC: 19, condition: "ясно" });
    expect(calls.city).toBe("Москва");
    expect(calls.mapNow).toEqual({ latitude: 55.75, longitude: 37.62 });
    await expect(controller.now({ lat: "55.75", lng: "37.62" })).resolves.toMatchObject({ temperatureC: 19 });
    expect(calls.mapNow).toEqual({ latitude: 55.75, longitude: 37.62 });
  });

  it("rejects an incomplete or unknown map query", async () => {
    const { controller } = createController();
    await expect(controller.now({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.now({ lat: "55.75" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.now({ city: "Казань" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("passes a bounded hourly window through", async () => {
    const { calls, controller } = createController();
    await expect(controller.hourly({ lat: "55.75", lng: "37.62", from: "2026-09-12T16:00:00.000Z", to: "2026-09-12T20:00:00.000Z" })).resolves.toEqual({ source: "Open-Meteo", hours: [], note: null });
    expect(calls.hoursAt).toMatchObject({ latitude: 55.75, longitude: 37.62 });
  });

  it("rejects an hourly query without coords, with inverted bounds, or past 48 hours", async () => {
    const { controller } = createController();
    await expect(controller.hourly({ from: "2026-09-12T16:00:00.000Z", to: "2026-09-12T17:00:00.000Z" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.hourly({ lat: "55.75", lng: "37.62", from: "2026-09-12T20:00:00.000Z", to: "2026-09-12T16:00:00.000Z" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.hourly({ lat: "55.75", lng: "37.62", from: "2026-09-12T00:00:00.000Z", to: "2026-09-15T00:00:00.000Z" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
