import { describe, expect, it } from "vitest";
import type { EventWeather, Friend } from "@max-events/api-contracts";
import type { PlaceSlot, SlotExtra } from "../api/client";
import { codeMatrix, companyLabel, formatBookingDate, formatRub, formatSlotDayTitle, formatSlotDuration, formatSlotWindow, formatTemperature, formatTime, slotBill, slotDayCell, slotMinutes, slotStatusLabel, weatherIcon } from "./slots";

function slot(overrides: Partial<PlaceSlot> = {}): PlaceSlot {
  return {
    id: "f0000001-0000-4000-8000-202609190002",
    placeId: "b0000001-0000-4000-8000-000000000001",
    startsAt: "2026-09-19T17:30:00+03:00",
    endsAt: "2026-09-19T20:30:00+03:00",
    capacity: 12,
    takenSeats: 0,
    priceRub: 2400,
    status: "free",
    busyUntil: null,
    weather: null,
    ...overrides,
  };
}

const friend = (id: string, name: string): Friend => ({ id, name, avatarUrl: null });

const weather = (conditionCode: number): EventWeather => ({ temperatureC: 19.4, condition: "ясно", conditionCode, precipitationProbability: 10 });

describe("slot window formatting", () => {
  it("prints the window, its length and its price the way the design does", () => {
    expect(formatSlotWindow(slot())).toBe("17:30 – 20:30");
    expect(slotMinutes(slot())).toBe(180);
    expect(formatSlotDuration(slot())).toBe("3 часа");
    // ru-RU groups thousands with a no-break space, which is what the design prints too
    expect(formatRub(2400)).toBe("2\u00a0400 ₽");
  });

  it("keeps half hours as a decimal, and the plural of whole ones", () => {
    expect(formatSlotDuration(slot({ startsAt: "2026-09-19T21:00:00+03:00", endsAt: "2026-09-19T23:30:00+03:00" }))).toBe("2,5 часа");
    expect(formatSlotDuration(slot({ startsAt: "2026-09-19T14:00:00+03:00", endsAt: "2026-09-19T15:00:00+03:00" }))).toBe("1 час");
    expect(formatSlotDuration(slot({ startsAt: "2026-09-19T09:00:00+03:00", endsAt: "2026-09-19T14:00:00+03:00" }))).toBe("5 часов");
  });

  it("reads the window in Moscow time regardless of the offset it arrives in", () => {
    expect(formatTime("2026-09-19T14:30:00Z")).toBe("17:30");
  });
});

describe("slot dates", () => {
  it("builds the two lines of a strip cell and the title over the windows", () => {
    expect(slotDayCell("2026-09-18")).toEqual({ weekday: "ПТ", day: "18" });
    expect(formatSlotDayTitle("2026-09-18")).toBe("пятница, 18 сентября");
    expect(formatBookingDate("2026-09-18T20:00:00+03:00")).toBe("Пт, 18 сентября");
  });
});

describe("weather glyph", () => {
  it("picks the sun for a clear sky, the cloud below the drizzles and the rain above them", () => {
    expect(weatherIcon(weather(0))).toBe("sun");
    expect(weatherIcon(weather(3))).toBe("weather");
    expect(weatherIcon(weather(61))).toBe("rain");
  });

  it("signs a temperature above zero and leaves the minus alone", () => {
    expect(formatTemperature(19.4)).toBe("+19°");
    expect(formatTemperature(-4.2)).toBe("-4°");
    expect(formatTemperature(0)).toBe("0°");
  });
});

describe("slotStatusLabel", () => {
  it("tells a free window from a taken one and says when the taken one frees", () => {
    expect(slotStatusLabel(slot())).toEqual({ label: "Свободно", free: true, hint: null });
    expect(slotStatusLabel(slot({ status: "booked", busyUntil: "2026-09-19T13:30:00+03:00" }))).toEqual({ label: "Занято", free: false, hint: "занято до 13:30" });
    expect(slotStatusLabel(slot({ status: "held", busyUntil: null }))).toEqual({ label: "Держим", free: false, hint: null });
  });
});

describe("companyLabel", () => {
  it("opens with the viewer and joins the company the russian way", () => {
    expect(companyLabel([])).toBe("Ты");
    expect(companyLabel([friend("f1", "Катя Орлова")])).toBe("Ты и Катя");
    expect(companyLabel([friend("f1", "Анна Соколова"), friend("f2", "Дима Кузнецов")])).toBe("Ты, Анна и Дима");
  });
});

describe("slotBill", () => {
  const coal: SlotExtra = { id: "coal", title: "Уголь и шампуры", priceRub: 600 };

  it("adds the add-ons to the window and splits the sum between the company", () => {
    const bill = slotBill(slot(), [coal], 3);

    expect(bill.rows).toEqual([
      { label: "Слот 17:30 – 20:30", amountRub: 2400 },
      { label: "Уголь и шампуры", amountRub: 600 },
    ]);
    expect(bill.totalRub).toBe(3000);
    expect(bill.perPersonRub).toBe(1000);
  });

  it("rounds the share up, so the shares always cover the bill", () => {
    expect(slotBill(slot({ priceRub: 2000 }), [], 3).perPersonRub).toBe(667);
  });

  it("treats a company of nobody as one payer and a free window as zero", () => {
    expect(slotBill(slot({ priceRub: null }), [], 0)).toMatchObject({ totalRub: 0, perPersonRub: 0, partySize: 1 });
  });
});

describe("codeMatrix", () => {
  it("is stable per code and fills the square", () => {
    expect(codeMatrix("MAX-4821-19SB")).toEqual(codeMatrix("MAX-4821-19SB"));
    expect(codeMatrix("MAX-4821-19SB")).toHaveLength(49);
    expect(codeMatrix("MAX-4821-19SB", 3)).toHaveLength(9);
  });

  it("differs between codes and draws something in both sizes", () => {
    expect(codeMatrix("MAX-4821-19SB")).not.toEqual(codeMatrix("MAX-7735-18TT"));
    expect(codeMatrix("MAX-4821-19SB").some((cell) => cell !== "off")).toBe(true);
    expect(codeMatrix("MAX-7735-18TT", 3).some((cell) => cell !== "off")).toBe(true);
  });
});
