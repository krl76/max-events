import { describe, expect, it } from "vitest";
import { walkingRoute } from "./walkingRoute";

const from: [number, number] = [55.75, 37.61];
const to: [number, number] = [55.76, 37.62];

describe("walkingRoute", () => {
  it("follows the OSRM geometry when the router answers", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
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
});
