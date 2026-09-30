import { describe, expect, it } from "vitest";
import { genitiveCity, prepositionalCity } from "./city-case";

describe("prepositionalCity", () => {
  it("puts Russian city names into the prepositional case after «по»", () => {
    expect(prepositionalCity("Москва")).toBe("Москве");
    expect(prepositionalCity("Тула")).toBe("Туле");
    expect(prepositionalCity("Казань")).toBe("Казани");
    expect(prepositionalCity("Тверь")).toBe("Твери");
    expect(prepositionalCity("Санкт-Петербург")).toBe("Санкт-Петербурге");
    expect(prepositionalCity("Нижний Новгород")).toBe("Нижнем Новгороде");
    expect(prepositionalCity("Ростов-на-Дону")).toBe("Ростове-на-Дону");
  });

  it("leaves indeclinable and non-Russian names alone", () => {
    expect(prepositionalCity("Сочи")).toBe("Сочи");
    expect(prepositionalCity("Осло")).toBe("Осло");
    expect(prepositionalCity("New York")).toBe("New York");
  });
});

describe("genitiveCity", () => {
  it("puts Russian city names into the genitive after «города»", () => {
    expect(genitiveCity("Москва")).toBe("Москвы");
    expect(genitiveCity("Тула")).toBe("Тулы");
    expect(genitiveCity("Казань")).toBe("Казани");
    expect(genitiveCity("Санкт-Петербург")).toBe("Санкт-Петербурга");
  });
});
