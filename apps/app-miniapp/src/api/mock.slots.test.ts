import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { MOCK_SILVER_FOREST, installMockApi, mockPlaces, mockSlotBookings, mockSlotWaitlist, resetMockSlots } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const GORKY = mockPlaces[0];
const SEEDED_BOOKING_ID = "f1000000-0000-4000-8000-000000000001";

describe("slot mock endpoints", () => {
  let restore: (() => void) | null = null;

  function client(): ApiClient {
    restore = installMockApi();
    return new ApiClient("/api");
  }

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockSlots();
  });

  it("answers the board of экран 19 for a venue that rents something", async () => {
    const board = await client().getSlotBoard(MOCK_SILVER_FOREST.id);
    expect(board.place.id).toBe(MOCK_SILVER_FOREST.id);
    expect(board.unitTitle).toBe("Беседка №4 у залива");
    expect(board.pricePerHourRub).toBe(800);
    // Семь дней полосы дат и прогноз на каждый — иначе полосе нечего рисовать
    expect(board.days).toHaveLength(7);
    expect(board.days.every((day) => day.weather !== null)).toBe(true);
    expect(board.amenities).toContain("мангал и решётки");
    expect(board.extras[0]).toMatchObject({ title: "Уголь и шампуры", priceRub: 600 });
  });

  it("404s the board of a venue that rents nothing", async () => {
    await expect(client().getSlotBoard(mockPlaces[1].id)).rejects.toThrow();
  });

  it("prices a window by its length at the hourly rate and keeps the reserved one taken", async () => {
    const board = await client().getSlotBoard(MOCK_SILVER_FOREST.id);
    const byWindow = new Map(board.slots.map((slot) => [slot.startsAt.slice(11, 16), slot]));
    // 800 ₽/час: три часа — 2 400 ₽, два с половиной — 2 000 ₽
    expect(byWindow.get("14:00")?.priceRub).toBe(2400);
    expect(byWindow.get("21:00")?.priceRub).toBe(2000);
    expect(byWindow.get("11:00")?.status).toBe("booked");
    expect(byWindow.get("11:00")?.busyUntil).not.toBeNull();
  });

  it("gives the same day the same forecast on every request", async () => {
    const api = client();
    const first = await api.getSlotBoard(MOCK_SILVER_FOREST.id);
    const second = await api.getSlotBoard(MOCK_SILVER_FOREST.id, first.date);
    expect(second.days.map((day) => day.weather?.temperatureC)).toEqual(first.days.map((day) => day.weather?.temperatureC));
  });

  it("books a free window, and refuses the same window twice", async () => {
    const api = client();
    const board = await api.getSlotBoard(GORKY.id);
    const free = board.slots.find((slot) => slot.status === "free");
    expect(free).toBeDefined();
    const booking = await api.createSlotBooking({ slotId: free!.id, userId: DEMO_USER_ID, companionIds: [], extraIds: [] });
    expect(booking.slotId).toBe(free!.id);
    expect(booking.partySize).toBe(1);
    expect(booking.totalRub).toBe(free!.priceRub);
    expect(booking.checkInCode).toMatch(/^MAX-\d{4}-\d{2}[A-Z]{2}$/);
    await expect(api.createSlotBooking({ slotId: free!.id, userId: DEMO_USER_ID, companionIds: [], extraIds: [] })).rejects.toThrow();
  });

  it("counts the companions into the party and the add-ons into the total", async () => {
    const api = client();
    const board = await api.getSlotBoard(GORKY.id);
    const free = board.slots.find((slot) => slot.status === "free")!;
    const booking = await api.createSlotBooking({ slotId: free.id, userId: DEMO_USER_ID, companionIds: board.candidates.slice(0, 2).map((friend) => friend.id), extraIds: [board.extras[0].id] });
    expect(booking.partySize).toBe(3);
    expect(booking.totalRub).toBe((free.priceRub ?? 0) + board.extras[0].priceRub);
  });

  it("404s a booking of a window that does not exist", async () => {
    await expect(client().createSlotBooking({ slotId: "f0000000-0000-4000-8000-000000000000", userId: DEMO_USER_ID, companionIds: [], extraIds: [] })).rejects.toThrow();
  });

  it("answers экран 20 for the seeded booking: code, window, venue, company and chat", async () => {
    const screen = await client().getSlotBooking(SEEDED_BOOKING_ID);
    expect(screen.booking.id).toBe(SEEDED_BOOKING_ID);
    expect(screen.booking.partySize).toBe(3);
    expect(screen.place.id).toBe(MOCK_SILVER_FOREST.id);
    expect(screen.slot.id).toBe(screen.booking.slotId);
    expect(screen.company).toHaveLength(2);
    expect(screen.freeSeats).toBe(screen.slot.capacity - screen.booking.partySize);
    expect(screen.chat[0].text).toContain("Беседка будет открыта");
  });

  it("cancels a booking and drops it out of «Мои брони»", async () => {
    const api = client();
    await api.cancelSlotBooking(SEEDED_BOOKING_ID);
    expect(mockSlotBookings.find((booking) => booking.id === SEEDED_BOOKING_ID)?.status).toBe("cancelled");
    const board = await api.listMySlots(DEMO_USER_ID);
    expect(board.bookings).toHaveLength(0);
  });

  it("keeps the waiting position of экран 21 visible past the publishing horizon", async () => {
    // Корт сдают только по четвергам, и ближайший четверг почти всегда дальше, чем площадка открыла
    // календарь. Позиция в очереди существует именно поэтому — прятать её вместе с окном нельзя.
    const board = await client().listMySlots(DEMO_USER_ID);
    expect(board.waitlist).toHaveLength(1);
    expect(board.waitlist[0].entry.position).toBe(2);
    expect(board.waitlist[0].unitTitle).toBe("Корт №3");
    expect(board.waitlist[0].slot.status).toBe("booked");
  });

  it("leaves a waiting position", async () => {
    const api = client();
    const board = await api.listMySlots(DEMO_USER_ID);
    await api.leaveSlotWaitlist(board.waitlist[0].entry.id);
    expect(mockSlotWaitlist).toHaveLength(0);
    expect((await api.listMySlots(DEMO_USER_ID)).waitlist).toHaveLength(0);
  });

  it("answers экран 34 with the occupancy curve, the hours of the day and what is bookable", async () => {
    const board = await client().getPlaceBoard(GORKY.id, DEMO_USER_ID);
    expect(board.openUntil).toBe("23:00");
    // Ось макета читается 10 … 22, поэтому в кривой должен быть каждый час открытого дня
    expect(board.occupancy[0].hour).toBe(10);
    expect(board.occupancy[board.occupancy.length - 1].hour).toBe(22);
    expect(board.occupancy.every((hour) => hour.load >= 0 && hour.load <= 1)).toBe(true);
    expect(board.unitTitle).toBe("Мангальная зона у пруда");
    expect(board.slots.length).toBeLessThanOrEqual(3);
    expect(board.slots.every((slot) => slot.status === "free")).toBe(true);
  });

  it("404s the board of an unknown venue", async () => {
    await expect(client().getPlaceBoard("b0000009-0000-4000-8000-000000000009", DEMO_USER_ID)).rejects.toThrow();
  });

  it("carries an entry code for every active booking of the viewer", async () => {
    const codes = await client().listCheckInCodes(DEMO_USER_ID);
    expect(codes.some((code) => code.bookingId === SEEDED_BOOKING_ID)).toBe(true);
    expect(codes.every((code) => /^MAX-\d{4}-\d{2}[A-Z]{2}$/.test(code.code))).toBe(true);
  });

  it("restores the seeded booking and waiting position on reset", async () => {
    const api = client();
    await api.cancelSlotBooking(SEEDED_BOOKING_ID);
    await api.leaveSlotWaitlist(mockSlotWaitlist[0].id);
    resetMockSlots();
    const board = await api.listMySlots(DEMO_USER_ID);
    expect(board.bookings).toHaveLength(1);
    expect(board.waitlist).toHaveLength(1);
  });
});
