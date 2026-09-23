import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlaceSlot, SlotBoard } from "../api/client";
import { mockPlaces } from "../api/mock";
import { slotBoardSubtitle, SlotBookingView, slotMetaLine, splitNote } from "./SlotBookingPage";

const park = mockPlaces[0];

function slot(overrides: Partial<PlaceSlot> = {}): PlaceSlot {
  return {
    id: "f0000000-0000-4000-8000-202609190001",
    placeId: park.id,
    startsAt: "2026-09-19T14:00:00+03:00",
    endsAt: "2026-09-19T17:00:00+03:00",
    capacity: 12,
    takenSeats: 0,
    priceRub: 2400,
    status: "free",
    busyUntil: null,
    weather: { temperatureC: 22.3, condition: "ясно", conditionCode: 0, precipitationProbability: 5 },
    ...overrides,
  };
}

function board(overrides: Partial<SlotBoard> = {}): SlotBoard {
  return {
    place: park,
    unitTitle: "Беседка №4 у залива",
    pricePerHourRub: 800,
    cancelBefore: "2026-09-19T12:00:00+03:00",
    amenities: ["мангал и решётки", "навес от дождя"],
    extras: [{ id: "coal", title: "Уголь и шампуры", priceRub: 600 }],
    days: [
      { date: "2026-09-19", weather: { temperatureC: 22.3, condition: "ясно", conditionCode: 0, precipitationProbability: 5 }, hasFreeSlots: true },
      { date: "2026-09-20", weather: null, hasFreeSlots: false },
    ],
    date: "2026-09-19",
    slots: [slot(), slot({ id: "f0000000-0000-4000-8000-202609190002", startsAt: "2026-09-19T11:00:00+03:00", endsAt: "2026-09-19T13:30:00+03:00", status: "booked", busyUntil: "2026-09-19T13:30:00+03:00" })],
    company: [{ id: "f1", name: "Анна Соколова", avatarUrl: null }],
    candidates: [{ id: "f2", name: "Дима Кузнецов", avatarUrl: null }],
    ...overrides,
  };
}

/** ru-RU groups thousands with a no-break space; the assertions read better with a plain one. */
const plain = (value: string): string => value.replaceAll("\u00a0", " ");

function viewHtml(overrides: Partial<SlotBoard> = {}, slotId: string | null = "f0000000-0000-4000-8000-202609190001", extraIds: string[] = []): string {
  const data = board(overrides);
  return plain(
    renderToStaticMarkup(
      createElement(SlotBookingView, {
        board: data,
        day: data.date,
        slotId,
        extraIds,
        company: data.company,
        busy: false,
        failed: null,
        onBack: () => {},
        onPickDay: () => {},
        onPickSlot: () => {},
        onToggleExtra: () => {},
        onAddCompanion: () => {},
        onBook: () => {},
      }),
    ),
  );
}

describe("slotMetaLine", () => {
  it("prints the length and the price of a free window", () => {
    expect(plain(slotMetaLine(slot()))).toBe("3 часа · 2 400 ₽");
    expect(slotMetaLine(slot({ priceRub: null }))).toBe("3 часа · бесплатно");
  });

  it("replaces both with the moment a taken window frees", () => {
    expect(slotMetaLine(slot({ status: "booked", busyUntil: "2026-09-19T13:30:00+03:00" }))).toBe("занято до 13:30");
    expect(slotMetaLine(slot({ status: "booked", busyUntil: null }))).toBe("недоступно");
  });
});

describe("slotBoardSubtitle", () => {
  it("names the venue and its hourly rate, and the venue alone when it is free", () => {
    expect(slotBoardSubtitle({ place: park, pricePerHourRub: 800 })).toBe("Парк Горького · 800 ₽/час");
    expect(slotBoardSubtitle({ place: park, pricePerHourRub: null })).toBe("Парк Горького");
  });
});

describe("splitNote", () => {
  it("appears only once there is somebody to split the bill with", () => {
    expect(splitNote(1)).toBeNull();
    expect(splitNote(3)).toBe("счёт делится на 3");
  });
});

describe("SlotBookingView", () => {
  it("renders the strip, the windows, what is included and the bill of the picked window", () => {
    const html = viewHtml({}, "f0000000-0000-4000-8000-202609190001", ["coal"]);

    expect(html).toContain("Беседка №4 у залива");
    expect(html).toContain("Парк Горького · 800 ₽/час");
    expect(html).toContain("СБ");
    expect(html).toContain("+22°");
    expect(html).toContain("Доступные слоты · суббота, 19 сентября");
    expect(html).toContain("14:00 – 17:00");
    expect(html).toContain("3 часа · 2 400 ₽");
    expect(html).toContain("занято до 13:30");
    expect(html).toContain("Выбрано");
    expect(html).toContain("Что входит");
    expect(html).toContain("мангал и решётки");
    expect(html).toContain("Уголь и шампуры");
    expect(html).toContain("Ты и Анна · счёт делится на 2");
    // 2 400 ₽ за окно + 600 ₽ за уголь, поделённые на двоих
    expect(html).toContain("Итого на человека");
    expect(html).toContain("1 500 ₽");
    expect(html).toContain("3 000 ₽");
    expect(html).toContain("Забронировать слот");
  });

  it("asks for a window before it shows a bill", () => {
    const html = viewHtml({}, null);

    expect(html).toContain("Выбери окно — и мы посчитаем счёт.");
    expect(html).toContain("Окно не выбрано");
    expect(html).not.toContain("Итого на человека");
  });

  it("says so when the venue opened no windows that day", () => {
    expect(viewHtml({ slots: [] }, null)).toContain("На этот день площадка окон не открыла.");
  });
});
