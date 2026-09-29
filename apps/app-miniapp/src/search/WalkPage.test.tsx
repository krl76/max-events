// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { CityWalk, ComposeCityWalkWrite } from "@max-events/api-contracts";
import { ApiError } from "../api/endpoints/transport";
import { mockEvents } from "../api/mock";
import { cityWalkAsk, nextWalkAsk, walkBudgetLabel, walkBudgetRub, walkClock, walkSpanLabel, walkSpanMinutes, WalkPage, WalkView } from "./WalkPage";
import { WalkResult, walkArrivalOffsetMinutes, walkErrorText, walkStopKeys } from "./WalkResult";
import { EMPTY_WALK_CHOICE, selectWalkBudget, selectWalkTime, toggleWalkInterest, walkComposeReady, WalkWizard } from "./WalkWizard";

describe("city walk query", () => {
  it("asks for sights in the selected city, and a later ask asks for a different route", () => {
    expect(cityWalkAsk("Тула")).toContain("Тула");
    expect(cityWalkAsk("Тула")).toContain("достопримечательностям");
    expect(nextWalkAsk("Тула")).toContain("другой");
    expect(nextWalkAsk("Тула")).not.toBe(cityWalkAsk("Тула"));
  });
});

describe("walk totals", () => {
  it("sums ticket prices and labels a free route", () => {
    expect(walkBudgetRub([{ event: { priceRub: 400 } }, { event: { priceRub: null } }])).toBe(400);
    expect(walkBudgetLabel(0)).toBe("Бесплатно");
    expect(walkBudgetLabel(1200)).toContain("200");
    expect(walkBudgetLabel(1200)).toContain("₽");
  });

  it("reads the span between the first and last stop", () => {
    expect(walkSpanMinutes([{ at: "2026-09-27T09:00:00" }, { at: "2026-09-27T10:53:00" }])).toBe(113);
    expect(walkSpanLabel(113)).toBe("1 ч 53 мин");
    expect(walkSpanLabel(null)).toBe("пешком");
    expect(walkClock("2026-09-27T09:00:00")).toMatch(/09:00/);
  });
});

describe("WalkView", () => {
  it("shows the reference title and the new-walk action once a draft is ready", () => {
    const event = { ...mockEvents[0], title: "Тульский кремль", city: "Тула", priceRub: 0, isPaid: false, paymentUrl: null, ratingAverage: 4.8 };
    const html = renderToStaticMarkup(
      createElement(WalkView, {
        city: "Тула",
        onBack: () => {},
        onAnother: () => {},
        state: {
          status: "ready",
          day: {
            summary: "Кремль и набережная",
            date: "2026-09-27",
            plan: null,
            planDraft: { eventId: event.id, participantIds: [], meetingPoint: "Кремль", meetingAt: event.startsAt },
            stops: [{ at: event.startsAt, explanation: "Начать с кремля", event }],
          },
        },
      }),
    );

    expect(html).toContain("Маршрут выходного дня: Тула");
    expect(html).toContain("Тульский кремль");
    expect(html).toContain("Хочу новую прогулку");
  });
});

describe("walk wizard", () => {
  it("shows time first and does not start a walk request", () => {
    const html = renderToStaticMarkup(createElement(WalkPage, { city: "Тула" }));
    expect(html).toContain("1 час");
    expect(html).toContain("2 часа");
    expect(html).toContain("Полдня");
    expect(html).toContain("кофе и одна точка");
    expect(html).toContain("не спеша, с фото");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Своё");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Собираем прогулку");
    expect(html).not.toContain("Бесплатно");
  });

  it("enables compose only after time, budget, and one interest", () => {
    const timed = selectWalkTime(EMPTY_WALK_CHOICE, 120);
    const budgeted = selectWalkBudget(timed, "any");
    const ready = toggleWalkInterest(budgeted, "cultural");
    expect(walkComposeReady(EMPTY_WALK_CHOICE)).toBe(false);
    expect(walkComposeReady(timed)).toBe(false);
    expect(walkComposeReady(budgeted)).toBe(false);
    expect(walkComposeReady(ready)).toBe(true);
    const html = renderToStaticMarkup(createElement(WalkWizard, { city: "Тула", choice: ready, onChange: () => {}, onBack: () => {} }));
    expect(html).toContain("Культурные");
    expect(html).toContain("Собрать прогулку");
    expect(html).not.toContain("disabled");
    expect(html).toContain('aria-pressed="false"');
  });
});

const PLACE_ID = "11111111-1111-4111-8111-111111111111";

function sampleWalk(): CityWalk {
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
        title: "Кремль",
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
    legs: [{ fromTitle: "Кремль", toTitle: "Набережная", travelMinutes: 15, distanceKm: 1.2, mode: "walk", transfers: 0, priceRub: null }],
    createdAt: "2026-09-27T12:00:00.000Z",
  };
}

function readyChoice() {
  return toggleWalkInterest(selectWalkBudget(selectWalkTime(EMPTY_WALK_CHOICE, 120), "any"), "cultural");
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
  const buttons = [...host.querySelectorAll("button, ion-button")];
  const button = buttons.find((item) => item.textContent?.trim() === text) ?? buttons.find((item) => (item.textContent ?? "").includes(text) && (item.className ?? "").includes("app-walk-tile"));
  if (button === undefined) throw new Error(`missing button ${text}`);
  if (button instanceof HTMLElement) button.click();
}

describe("composed walk", () => {
  it("renders both stop descriptions without a star", () => {
    const html = renderToStaticMarkup(
      createElement(WalkResult, {
        city: "Тула",
        walk: sampleWalk(),
        now: Date.parse("2026-09-27T09:00:00"),
        onBack: () => {},
        onAnother: () => {},
        onPlace: () => {},
      }),
    );
    expect(html).toContain("Старая крепость.");
    expect(html).toContain("Река рядом.");
    expect(html).toContain("Маршрут из каталога");
    expect(html).toContain("Бесплатно");
    expect(html).not.toContain("★");
    expect(walkArrivalOffsetMinutes(1, sampleWalk().legs)).toBe(35);
    expect(walkStopKeys(sampleWalk())).toContain(PLACE_ID);
    expect(walkErrorText(new ApiError(422, "no_sights"))).toBe("В этом городе пока нет двух мест для прогулки.");
    expect(walkErrorText(new Error("later"))).toBe("Не удалось собрать прогулку.");
  });

  it("shows the trail wait screen, then the stop title, and does not call assistDay", async () => {
    let release: (walk: CityWalk) => void = () => {};
    const pending = new Promise<CityWalk>((resolve) => {
      release = resolve;
    });
    const { host, root } = await mount(createElement(WalkPage, { city: "Тула", initialChoice: readyChoice(), compose: () => pending }));
    await act(async () => {
      clickText(host, "Собрать прогулку");
    });
    expect(host.textContent).toContain("Прокладываю маршрут по Тула");
    expect(host.textContent).toContain("проверяю реальные места и расстояния");
    await act(async () => {
      release(sampleWalk());
      await pending;
    });
    expect(host.textContent).toContain("Кремль");
    expect(host.textContent).toContain("Старая крепость.");
    expect(host.textContent).toContain("Река рядом.");
    expect(host.textContent).not.toContain("★");
    expect(readFileSync("src/search/WalkPage.tsx", "utf8")).not.toContain("assistDay");
    root.unmount();
    host.remove();
  });

  it("keeps the wizard values when compose is rejected", async () => {
    const compose = (): Promise<CityWalk> => Promise.reject(new ApiError(422, "no_sights"));
    const { host, root } = await mount(createElement(WalkPage, { city: "Тула", initialChoice: readyChoice(), compose }));
    await act(async () => {
      clickText(host, "Собрать прогулку");
    });
    expect(host.textContent).toContain("В этом городе пока нет двух мест для прогулки.");
    expect(host.textContent).toContain("Культурные");
    root.unmount();
    host.remove();
  });

  it("returns to the first step and excludes the current stops on the next compose", async () => {
    const calls: ComposeCityWalkWrite[] = [];
    const compose = (body: ComposeCityWalkWrite): Promise<CityWalk> => {
      calls.push(body);
      return Promise.resolve(sampleWalk());
    };
    const { host, root } = await mount(createElement(WalkPage, { city: "Тула", initialChoice: readyChoice(), compose }));
    await act(async () => {
      clickText(host, "Собрать прогулку");
    });
    expect(host.textContent).toContain("Кремль");
    await act(async () => {
      clickText(host, "Хочу новую прогулку");
    });
    expect(host.textContent).toContain("1 час");
    await act(async () => {
      clickText(host, "2 часа");
    });
    await act(async () => {
      clickText(host, "Любой");
    });
    await act(async () => {
      clickText(host, "Культурные");
    });
    await act(async () => {
      clickText(host, "Собрать прогулку");
    });
    expect(calls[1]?.excludeKeys).toContain(PLACE_ID);
    expect(calls[1]?.excludeKeys).toContain("https://www.wikidata.org/wiki/Q1");
    root.unmount();
    host.remove();
  });

  it("navigates between wizard steps via Back button and progress tabs without emojis", async () => {
    let backCalled = false;
    const { host, root } = await mount(
      createElement(WalkWizard, {
        city: "Тула",
        choice: readyChoice(),
        onChange: () => {},
        onBack: () => {
          backCalled = true;
        },
      }),
    );
    expect(host.textContent).toContain("Интересы");
    expect(host.textContent).toContain("Выбрано: 1");
    expect(host.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

    await act(async () => {
      clickText(host, "Назад");
    });
    expect(host.textContent).toContain("Бюджет");
    expect(host.textContent).toContain("Любой");

    await act(async () => {
      clickText(host, "Назад");
    });
    expect(host.textContent).toContain("Сколько времени");
    expect(host.textContent).toContain("1 час");

    await act(async () => {
      clickText(host, "Назад");
    });
    expect(backCalled).toBe(true);

    await act(async () => {
      clickText(host, "Интересы");
    });
    expect(host.textContent).toContain("Интересы");

    root.unmount();
    host.remove();
  });
});
