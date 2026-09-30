import { describe, expect, it } from "vitest";
import { drivingRoute, osrmTrip, stitchWalkingRoute, walkingRoute } from "./walkingRoute";

const from: [number, number] = [55.75, 37.61];
const to: [number, number] = [55.76, 37.62];

describe("walkingRoute", () => {
  it("follows the OSRM geometry when the router answers", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              duration: 540,
              geometry: {
                coordinates: [
                  [37.61, 55.75],
                  [37.615, 55.753],
                  [37.62, 55.76],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    await expect(walkingRoute(from, to, fetchImpl)).resolves.toEqual([
      [55.75, 37.61],
      [55.753, 37.615],
      [55.76, 37.62],
    ]);
  });

  it("falls back to the two endpoints when the router fails", async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 502 });
    await expect(walkingRoute(from, to, fetchImpl)).resolves.toEqual([from, to]);
  });

  it("reads OSRM duration as whole minutes", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              duration: 125,
              geometry: {
                coordinates: [
                  [37.61, 55.75],
                  [37.62, 55.76],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    await expect(osrmTrip(from, to, "foot", fetchImpl)).resolves.toEqual({
      path: [from, to],
      minutes: 2,
    });
  });

  it("asks the driving graph for a car path", async () => {
    const fetchImpl: typeof fetch = async (url) => {
      expect(String(url)).toContain("/route/v1/driving/");
      return new Response(
        JSON.stringify({
          routes: [
            {
              geometry: {
                coordinates: [
                  [37.61, 55.75],
                  [37.62, 55.76],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    await expect(drivingRoute(from, to, fetchImpl)).resolves.toEqual([from, to]);
  });

  it("joins each leg and keeps a straight segment when one leg fails", async () => {
    const mid: [number, number] = [55.755, 37.615];
    const fetchImpl: typeof fetch = async (url) => {
      const target = String(url);
      if (target.includes("37.62,55.76")) return new Response(null, { status: 502 });
      return new Response(
        JSON.stringify({
          routes: [
            {
              geometry: {
                coordinates: [
                  [37.61, 55.75],
                  [37.612, 55.752],
                  [37.615, 55.755],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    await expect(stitchWalkingRoute([from, mid, to], fetchImpl)).resolves.toEqual([
      [55.75, 37.61],
      [55.752, 37.612],
      [55.755, 37.615],
      [55.76, 37.62],
    ]);
  });
});
