import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, MOCK_SANDBOX_FAIL_AMOUNT, mockEvents, resetMockBookings, resetMockWaitlist } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const PAID_EVENT_ID = "c0000005-0000-4000-8000-000000000005";
const FAILING_EVENT_ID = "c0000012-0000-4000-8000-000000000012";
const WAITLIST_EVENT_ID = "c0000008-0000-4000-8000-000000000008";
const FREE_EVENT_ID = "c0000003-0000-4000-8000-000000000003";

describe("booking payments via mock (sandbox parity)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
    resetMockWaitlist();
  });

  const client = () => new ApiClient("/api");

  it("creates a pending payment with the event price when booking a paid event", async () => {
    restore = installMockApi();
    const event = mockEvents.find((item) => item.id === PAID_EVENT_ID)!;

    const booking = await client().createBooking({ userId: DEMO_USER_ID, eventId: event.id });

    expect(booking.payment?.status).toBe("pending");
    expect(booking.payment?.amountRub).toBe(event.priceRub);
    expect(booking.payment?.bookingId).toBe(booking.id);
  });

  it("settles a pending payment on pay and stays idempotent on repeat", async () => {
    restore = installMockApi();
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: PAID_EVENT_ID });

    const paid = await api.payBooking(booking.id);
    expect(paid.payment?.status).toBe("succeeded");
    expect(paid.payment?.amountRub).toBe(booking.payment?.amountRub);

    const again = await api.payBooking(booking.id);
    expect(again.payment?.id).toBe(paid.payment?.id);
    expect(again.payment?.status).toBe("succeeded");
  });

  it("declines a payment at the sandbox fail amount and keeps it failed on retry", async () => {
    restore = installMockApi();
    const event = mockEvents.find((item) => item.id === FAILING_EVENT_ID)!;
    expect(event.priceRub).toBe(MOCK_SANDBOX_FAIL_AMOUNT);
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: event.id });

    const failed = await api.payBooking(booking.id);
    expect(failed.payment?.status).toBe("failed");

    const retried = await api.payBooking(booking.id);
    expect(retried.payment?.status).toBe("failed");
  });

  it("rejects paying a cancelled booking with 409 and an unknown one with 404", async () => {
    restore = installMockApi();
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: PAID_EVENT_ID });
    await api.cancelBooking(booking.id);

    await expect(api.payBooking(booking.id)).rejects.toMatchObject({ name: "ApiError", status: 409 });
    await expect(api.payBooking("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("refunds the succeeded payment when a paid booking is cancelled", async () => {
    restore = installMockApi();
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: PAID_EVENT_ID });
    const paid = await api.payBooking(booking.id);
    expect(paid.payment?.status).toBe("succeeded");

    const cancelled = await api.cancelBooking(booking.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.payment?.status).toBe("refunded");
    expect(cancelled.payment?.amountRub).toBe(paid.payment?.amountRub);

    const again = await api.cancelBooking(booking.id);
    expect(again.payment?.status).toBe("refunded");
  });

  it("cancels a booking with a pending payment without a refund", async () => {
    restore = installMockApi();
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: PAID_EVENT_ID });
    expect(booking.payment?.status).toBe("pending");

    const cancelled = await api.cancelBooking(booking.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.payment?.status).toBe("pending");
  });

  it("keeps free events paymentless, including the pay endpoint", async () => {
    restore = installMockApi();
    const api = client();
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: FREE_EVENT_ID });
    expect(booking.payment).toBeNull();

    const paid = await api.payBooking(booking.id);
    expect(paid.payment).toBeNull();
  });

  it("creates the pending payment when a waitlist offer is confirmed on a paid event", async () => {
    restore = installMockApi();
    const event = mockEvents.find((item) => item.id === WAITLIST_EVENT_ID)!;
    const api = client();
    let firstBookingId = "";
    for (let index = 0; index < (event.capacity ?? 0); index += 1) {
      const booking = await api.createBooking({ userId: `f0000000-0000-4000-8000-${String(index).padStart(12, "0")}`, eventId: event.id });
      if (index === 0) firstBookingId = booking.id;
    }

    await api.joinWaitlist(event.id, DEMO_USER_ID);
    await api.cancelBooking(firstBookingId);
    const offered = await api.getMyWaitlistEntry(event.id, DEMO_USER_ID);
    expect(offered?.status).toBe("offered");

    await api.confirmWaitlistOffer(offered!.id);
    const details = await api.getEventDetails(event.id, DEMO_USER_ID);
    expect(details.activeBookingId).not.toBeNull();

    const paid = await api.payBooking(details.activeBookingId!);
    expect(paid.payment?.status).toBe("succeeded");
    expect(paid.payment?.amountRub).toBe(event.priceRub);
  });
});
