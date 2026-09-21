import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { isRainy, OPEN_METEO_FORECAST_URL, utcHourKey, weatherConditionLabel, WeatherClient, type WeatherFetch } from "./weather.client";

const at = new Date("2026-09-12T16:30:00Z");

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<WeatherFetch>> {
  return { ok: status >= 200 && status < 300, json: async () => body };
}

describe("utcHourKey and isRainy", () => {
  it("truncates to the UTC hour and treats mm or probability as rain", () => {
    expect(utcHourKey(at)).toBe("2026-09-12T16:00");
    expect(isRainy({ precipitationMm: 0.4, precipitationProbability: 10 })).toBe(true);
    expect(isRainy({ precipitationMm: 0, precipitationProbability: 80 })).toBe(true);
    expect(isRainy({ precipitationMm: 0, precipitationProbability: 10 })).toBe(false);
  });
});

describe("WeatherClient.precipitationAt", () => {
  it("reads the matching UTC hour from Open-Meteo hourly arrays", async () => {
    const calls: string[] = [];
    const fetchImpl: WeatherFetch = async (url) => {
      calls.push(url);
      return jsonResponse(200, {
        hourly: {
          time: ["2026-09-12T15:00", "2026-09-12T16:00", "2026-09-12T17:00"],
          precipitation: [0, 1.2, 0],
          precipitation_probability: [5, 70, 20],
        },
      });
    };
    const client = new WeatherClient(OPEN_METEO_FORECAST_URL, fetchImpl);
    await expect(client.precipitationAt(55.75, 37.62, at)).resolves.toEqual({ precipitationMm: 1.2, precipitationProbability: 70 });
    expect(calls[0]).toContain("latitude=55.75");
    expect(calls[0]).toContain("longitude=37.62");
    expect(calls[0]).toContain("hourly=precipitation,precipitation_probability");
  });

  it("returns null on HTTP, missing hour, malformed body, and network errors", async () => {
    const down = new WeatherClient(OPEN_METEO_FORECAST_URL, async () => jsonResponse(503, {}));
    await expect(down.precipitationAt(1, 2, at)).resolves.toBeNull();

    const missing = new WeatherClient(OPEN_METEO_FORECAST_URL, async () => jsonResponse(200, { hourly: { time: ["2026-09-12T10:00"], precipitation: [0] } }));
    await expect(missing.precipitationAt(1, 2, at)).resolves.toBeNull();

    const malformed = new WeatherClient(OPEN_METEO_FORECAST_URL, async () => jsonResponse(200, { ok: true }));
    await expect(malformed.precipitationAt(1, 2, at)).resolves.toBeNull();

    const network = new WeatherClient(OPEN_METEO_FORECAST_URL, async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(network.precipitationAt(1, 2, at)).resolves.toBeNull();
  });
});

describe("weatherConditionLabel", () => {
  it("maps WMO weather codes to short Russian labels", () => {
    expect(weatherConditionLabel(0)).toBe("ясно");
    expect(weatherConditionLabel(2)).toBe("облачно");
    expect(weatherConditionLabel(3)).toBe("пасмурно");
    expect(weatherConditionLabel(61)).toBe("дождь");
    expect(weatherConditionLabel(71)).toBe("снег");
    expect(weatherConditionLabel(95)).toBe("гроза");
  });
});

describe("WeatherClient.forecastAt", () => {
  it("reads temperature, weather code and rain chance at the UTC hour", async () => {
    const fetchImpl: WeatherFetch = async (url) => {
      expect(url).toContain("hourly=temperature_2m,weather_code,precipitation,precipitation_probability");
      return jsonResponse(200, {
        hourly: {
          time: ["2026-09-12T15:00", "2026-09-12T16:00"],
          temperature_2m: [11.1, 12.4],
          weather_code: [1, 2],
          precipitation: [0, 0],
          precipitation_probability: [10, 40],
        },
      });
    };
    const client = new WeatherClient(OPEN_METEO_FORECAST_URL, fetchImpl);
    await expect(client.forecastAt(55.75, 37.62, at)).resolves.toEqual({
      temperatureC: 12.4,
      conditionCode: 2,
      precipitationMm: 0,
      precipitationProbability: 40,
    });
  });

  it("returns null when temperature is missing or the provider fails", async () => {
    const missingTemp = new WeatherClient(OPEN_METEO_FORECAST_URL, async () =>
      jsonResponse(200, { hourly: { time: ["2026-09-12T16:00"], precipitation: [0], precipitation_probability: [0] } }),
    );
    await expect(missingTemp.forecastAt(1, 2, at)).resolves.toBeNull();
    const down = new WeatherClient(OPEN_METEO_FORECAST_URL, async () => jsonResponse(503, {}));
    await expect(down.forecastAt(1, 2, at)).resolves.toBeNull();
  });
});

describe("WeatherClient DI constructability", () => {
  it("marks both constructor params as optional for Nest DI", () => {
    const optional = (Reflect.getMetadata("optional:paramtypes", WeatherClient) as number[] | undefined) ?? [];
    expect([...optional].sort()).toEqual([0, 1]);
    expect(new WeatherClient().precipitationAt).toBeInstanceOf(Function);
  });
});
