import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, OFFER_TTL_MS, resetMockBookings, resetMockWaitlist } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const USER_A = "a0000000-0000-4000-8000-0000000000a1";
const USER_B = "a0000000-0000-4000-8000-0000000000b2";

const client = () => new ApiClient("/api");

function smallestCapacityEvent() {
  const capacity = Math.min(...mockEvents.map((item) => item.capacity ?? Number.MAX_SAFE_INTEGER));
  return mockEvents.find((item) => item.capacity === capacity)!;
}

async function fillEvent(api: ApiClient, eventId: string, capacity: number): Promise<string> {
  let firstBookingId = "";
  for (let i = 0; i < capacity; i += 1) {
    const booking = await api.createBooking({ userId: `f0000000-0000-4000-8000-${String(i).padStart(12, "0")}`, eventId });
    if (i === 0) firstBookingId = booking.id;
  }
  return firstBookingId;
}

describe("waitlist mock flow", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockWaitlist();
    resetMockBookings();
  });

  it("joins the queue of a sold-out event with a FIFO position", async () => {
    restore = installMockApi();
    const api = client();
    const target = smallestCapacityEvent();
    await fillEvent(api, target.id, target.capacity!);

    const first = await api.joinWaitlist(target.id, DEMO_USER_ID);
    expect(first.status).toBe("waiting");
    expect(first.position).toBe(1);

    const second = await api.joinWaitlist(target.id, USER_A);
    expect(second.position).toBe(2);

    const mine = await api.getMyWaitlistEntry(target.id, USER_A);
    expect(mine?.position).toBe(2);
    expect(mine?.status).toBe("waiting");
  });

  it("rejects a duplicate join with 409", async () => {
    restore = installMockApi();
    const api = client();
    const target = smallestCapacityEvent();
    await fillEvent(api, target.id, target.capacity!);
    await api.joinWaitlist(target.id, DEMO_USER_ID);

    await expect(api.joinWaitlist(target.id, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("rejects joining while seats are still available", async () => {
    restore = installMockApi();
    const target = mockEvents.find((item) => item.capacity !== null)!;

    await expect(client().joinWaitlist(target.id, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("returns null when the user has no active entry", async () => {
    restore = installMockApi();

    expect(await client().getMyWaitlistEntry(mockEvents[0].id, DEMO_USER_ID)).toBeNull();
  });

  it("offers the freed seat to the first in line when a booking is cancelled", async () => {
    restore = installMockApi();
    const api = client();
    const target = smallestCapacityEvent();
    const bookingId = await fillEvent(api, target.id, target.capacity!);
    await api.joinWaitlist(target.id, USER_A);
    await api.joinWaitlist(target.id, USER_B);

    await api.cancelBooking(bookingId);

    const offered = await api.getMyWaitlistEntry(target.id, USER_A);
    expect(offered?.status).toBe("offered");
    expect(offered?.offeredUntil).not.toBeNull();
    expect((await api.getMyWaitlistEntry(target.id, USER_B))?.status).toBe("waiting");

    // the offered seat stays reserved for everyone else
    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(0);
  });

  it("confirm turns the offer into a booking and drops the entry from the queue", async () => {
    restore = installMockApi();
    const api = client();
    const target = smallestCapacityEvent();
    const bookingId = await fillEvent(api, target.id, target.capacity!);
    await api.joinWaitlist(target.id, DEMO_USER_ID);
    await api.cancelBooking(bookingId);

    const mine = await api.getMyWaitlistEntry(target.id, DEMO_USER_ID);
    const confirmed = await api.confirmWaitlistOffer(mine!.id);
    expect(confirmed.status).toBe("confirmed");

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.activeBookingId).not.toBeNull();
    expect(await api.getMyWaitlistEntry(target.id, DEMO_USER_ID)).toBeNull();
  });

  it("decline passes the offer to the next in line", async () => {
    restore = installMockApi();
    const api = client();
    const target = smallestCapacityEvent();
    const bookingId = await fillEvent(api, target.id, target.capacity!);
    await api.joinWaitlist(target.id, USER_A);
    await api.joinWaitlist(target.id, USER_B);
    await api.cancelBooking(bookingId);

    const offered = await api.getMyWaitlistEntry(target.id, USER_A);
    const declined = await api.declineWaitlistOffer(offered!.id);
    expect(declined.status).toBe("cancelled");

    const next = await api.getMyWaitlistEntry(target.id, USER_B);
    expect(next?.status).toBe("offered");
    expect(next?.position).toBe(1);
  });

  it("expires the offer by deadline, offers the next in line and rejects the stale confirm", async () => {
    vi.useFakeTimers();
    try {
      restore = installMockApi();
      const api = client();
      const target = smallestCapacityEvent();
      const bookingId = await fillEvent(api, target.id, target.capacity!);
      await api.joinWaitlist(target.id, USER_A);
      await api.joinWaitlist(target.id, USER_B);
      await api.cancelBooking(bookingId);
      const staleId = (await api.getMyWaitlistEntry(target.id, USER_A))!.id;

      await vi.advanceTimersByTimeAsync(OFFER_TTL_MS + 1000);

      expect(await api.getMyWaitlistEntry(target.id, USER_A)).toBeNull();
      expect((await api.getMyWaitlistEntry(target.id, USER_B))?.status).toBe("offered");
      await expect(api.confirmWaitlistOffer(staleId)).rejects.toMatchObject({ name: "ApiError", status: 409 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports 404 for actions on an unknown entry", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.confirmWaitlistOffer("82000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.declineWaitlistOffer("82000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
