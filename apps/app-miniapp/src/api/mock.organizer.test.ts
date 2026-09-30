import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, mockPlaces, resetMockOrganizer } from "./mock";

const NEW_EVENT = { title: "Встреча книжного клуба", description: "", category: "afisha", city: "Москва", placeId: null, startsAt: "2026-10-20T19:00:00+03:00", endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: 12, coverUrl: null } as const;
const NEW_PLACE = { title: "Антикафе «Свои»", address: "ул. Покровка, 17", city: "Москва", category: "other", latitude: 55.7602, longitude: 37.6467, logoUrl: null } as const;

describe("organizer panel flow", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockOrganizer();
  });

  const client = () => new ApiClient("/api");

  it("creates an event as a draft and publish flips it in the list", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createOrganizerEvent({ ...NEW_EVENT });
    expect(created.draft).toBe(true);

    const withDraft = await api.listOrganizerEvents();
    expect(withDraft.find((item) => item.id === created.id)?.draft).toBe(true);

    const published = await api.publishOrganizerEvent(created.id);
    expect(published.draft).toBe(false);

    // исход наблюдаем через повторный запрос состояния
    const afterPublish = await api.listOrganizerEvents();
    expect(afterPublish.find((item) => item.id === created.id)?.draft).toBe(false);

    const unpublished = await api.unpublishOrganizerEvent(created.id);
    expect(unpublished.draft).toBe(true);
    expect((await api.listOrganizerEvents()).find((item) => item.id === created.id)?.draft).toBe(true);
  });

  it("creates a place as a draft and publish flips it in the list", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createOrganizerPlace({ ...NEW_PLACE });
    expect(created.draft).toBe(true);

    const published = await api.publishOrganizerPlace(created.id);
    expect(published.draft).toBe(false);

    const list = await api.listOrganizerPlaces();
    expect(list.find((item) => item.id === created.id)?.draft).toBe(false);
  });

  it("rejects an invalid event payload with 400", async () => {
    restore = installMockApi();
    await expect(client().createOrganizerEvent({ ...NEW_EVENT, title: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("rejects create and update with endsAt before startsAt (backend assertTimeRange parity)", async () => {
    restore = installMockApi();
    const api = client();
    await expect(api.createOrganizerEvent({ ...NEW_EVENT, startsAt: "2026-10-20T19:00:00+03:00", endsAt: "2026-10-20T09:00:00+03:00" })).rejects.toMatchObject({ name: "ApiError", status: 400 });

    const created = await api.createOrganizerEvent({ ...NEW_EVENT });
    await expect(api.updateOrganizerEvent(created.id, { startsAt: "2026-10-20T19:00:00+03:00", endsAt: "2026-10-20T09:00:00+03:00" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("rejects an invalid place payload with 400", async () => {
    restore = installMockApi();
    await expect(client().createOrganizerPlace({ ...NEW_PLACE, latitude: 100 })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("reports 404 when publishing an unknown event and 403 for a catalog event owned by someone else", async () => {
    restore = installMockApi();
    const api = client();
    await expect(api.publishOrganizerEvent("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.publishOrganizerEvent(mockEvents[0].id)).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });

  it("edits a draft event title and rejects a patch breaking the payment invariant", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createOrganizerEvent({ ...NEW_EVENT });
    const updated = await api.updateOrganizerEvent(created.id, { title: "Книжный клуб: осень" });

    const list = await api.listOrganizerEvents();
    expect(list.find((item) => item.id === created.id)?.title).toBe("Книжный клуб: осень");
    expect(updated.draft).toBe(true);

    // негативный путь: платное событие без ссылки на оплату ломает merged EventSchema
    await expect(api.updateOrganizerEvent(created.id, { isPaid: true })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("edits a draft place address and refuses catalog places owned by someone else", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createOrganizerPlace({ ...NEW_PLACE });
    await api.updateOrganizerPlace(created.id, { address: "ул. Покровка, 21" });

    const list = await api.listOrganizerPlaces();
    expect(list.find((item) => item.id === created.id)?.address).toBe("ул. Покровка, 21");

    await expect(api.updateOrganizerPlace(mockPlaces[0].id, { title: "Захваченный парк" })).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });
});
