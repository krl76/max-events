import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { getMetadataArgsStorage } from "typeorm";
import { CityWalkEntity } from "./city-walk.entity";

describe("CityWalkEntity", () => {
  it("maps userId and payload onto city_walks", () => {
    const table = getMetadataArgsStorage().tables.find((item) => item.target === CityWalkEntity);
    const columns = getMetadataArgsStorage().columns.filter((item) => item.target === CityWalkEntity);
    const names = columns.map((item) => item.propertyName);
    expect(table?.name).toBe("city_walks");
    expect(names).toContain("userId");
    expect(names).toContain("payload");
  });
});
