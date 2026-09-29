// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { CityWalk } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { ApiError } from "../api/endpoints/transport";
import { SavedWalkList, SavedWalkPage, SavedWalkView, sortWalksNewest } from "./SavedWalks";

const PLACE_ID = "11111111-1111-4111-8111-111111111111";

function sampleWalk(createdAt = "2026-09-27T12:00:00.000Z", title = "Кремль"): CityWalk {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    city: "Тула",
    durationMinutes: 120,
    budgetMode: "any",
    budgetRub: null,
    interests: ["cultural"],
    sourceLabel: "catalog",
    fitted: true,
    stops: [
      {
        order: 1,
        title,
        address: "Кремль, Тула",
        latitude: 54.2,
        longitude: 37.6,
        description: "Старая крепость.",
        sourceUrl: `app://places/${PLACE_ID}`,
        placeId: PLACE_ID,
        done: false,
      },
      {
        order: 2,
        title: "Набережная",
        address: "Упа, Тула",
        latitude: 54.21,
        longitude: 37.61,
        description: "Река рядом.",
        sourceUrl: "https://www.wikidata.org/wiki/Q1",
        placeId: null,
        done: false,
      },
    ],
    legs: [{ fromTitle: title, toTitle: "Набережная", travelMinutes: 15, distanceKm: 1.2, mode: "walk", transfers: 0, priceRub: null }],
    createdAt,
  };
}

async function mount(node: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return { host, root };
}

function clickText(host: HTMLElement, text: string): void {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (button === undefined) throw new Error(`missing button ${text}`);
  button.click();
}

function OpenHarness({ walk }: { readonly walk: CityWalk }) {
  const [id, setId] = useState<string | null>(null);
  if (id === null) return createElement(SavedWalkList, { walks: [walk], onOpen: setId });
  return createElement(SavedWalkView, { walk, onToggle: () => {} });
}

describe("saved city walks", () => {
  it("lists the newest walk first and does not compose", () => {
    const older = { ...sampleWalk("2026-09-26T12:00:00.000Z"), id: "33333333-3333-4333-8333-333333333333", city: "Калуга" };
    const newer = sampleWalk("2026-09-27T12:00:00.000Z");
    expect(sortWalksNewest([older, newer])[0]?.city).toBe("Тула");
    const html = renderToStaticMarkup(createElement(SavedWalkList, { walks: [older, newer], onOpen: () => {} }));
    expect(html.indexOf("Тула")).toBeLessThan(html.indexOf("Калуга"));
    expect(html).toContain("2 остановки");
    const source = readFileSync("src/search/SavedWalks.tsx", "utf8");
    expect(source).not.toContain("composeCityWalk");
    expect(source).not.toContain("checkIn");
  });

  it("opens a saved walk title", async () => {
    const walk = sampleWalk();
    const { host, root } = await mount(createElement(OpenHarness, { walk }));
    await act(async () => {
      clickText(host, "Тула");
    });
    expect(host.textContent).toContain("Кремль");
    root.unmount();
    host.remove();
  });

  it("marks one stop done without a check-in and rolls the flag back when save fails", async () => {
    const walk = sampleWalk();
    const calls: string[] = [];
    const checkIns: string[] = [];
    const { host, root } = await mount(
      createElement(SavedWalkPage, {
        id: walk.id,
        load: () => Promise.resolve(walk),
        setDone: (_id, order, done) => {
          calls.push(`${order}:${done}`);
          if (calls.length === 1) return Promise.resolve({ ...walk, stops: walk.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)) });
          return Promise.reject(new Error("save failed"));
        },
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      clickText(host, "Пройдено");
    });
    expect(host.querySelector("[aria-pressed='true']")).not.toBeNull();
    expect(calls).toEqual(["1:true"]);
    expect(checkIns).toEqual([]);
    await act(async () => {
      clickText(host, "Пройдено");
    });
    expect(calls).toEqual(["1:true", "1:false"]);
    expect(host.querySelector("[aria-pressed='true']")).not.toBeNull();
    root.unmount();
    host.remove();
  });

  it("says the walk is missing when get returns 404", async () => {
    const { host, root } = await mount(
      createElement(SavedWalkPage, {
        id: "missing",
        load: () => Promise.reject(new ApiError(404, "missing")),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Прогулка не найдена.");
    expect(host.querySelector(".app-walk-back")).toBeNull();
    root.unmount();
    host.remove();
  });

  it("displays error message when get returns non-404 error", async () => {
    const { host, root } = await mount(
      createElement(SavedWalkPage, {
        id: "error-id",
        load: () => Promise.reject(new Error("Сетевой сбой")),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Не удалось открыть прогулку");
    expect(host.textContent).toContain("Сетевой сбой");
    expect(host.querySelector(".app-walk-back")).toBeNull();
    root.unmount();
    host.remove();
  });

  it("shows loading state with back button while fetching", async () => {
    let resolveWalk!: (walk: CityWalk) => void;
    const pending = new Promise<CityWalk>((resolve) => {
      resolveWalk = resolve;
    });
    const { host, root } = await mount(
      createElement(SavedWalkPage, {
        id: "slow-id",
        load: () => pending,
      }),
    );
    expect(host.textContent).toContain("Открываем прогулку");
    expect(host.querySelector(".app-walk-back")).toBeNull();
    await act(async () => {
      resolveWalk(sampleWalk());
    });
    expect(host.textContent).toContain("Тула");
    root.unmount();
    host.remove();
  });

  it("renders saved walk page using default load prop without infinite loop", async () => {
    const walk = sampleWalk();
    const spy = vi.spyOn(apiClient, "getCityWalk").mockResolvedValue(walk);
    const { host, root } = await mount(
      createElement(SavedWalkPage, {
        id: walk.id,
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenCalledWith(walk.id);
    expect(host.textContent).toContain("Тула");
    expect(host.textContent).toContain("Кремль");
    spy.mockRestore();
    root.unmount();
    host.remove();
  });

  it("calls onPlace when place button is clicked in SavedWalkView", async () => {
    const walk = sampleWalk();
    const openedPlaces: string[] = [];
    const { host, root } = await mount(
      createElement(SavedWalkView, {
        walk,
        onToggle: () => {},
        onPlace: (id) => openedPlaces.push(id),
      }),
    );
    clickText(host, "Кремль");
    expect(openedPlaces).toEqual([PLACE_ID]);
    root.unmount();
    host.remove();
  });
});
