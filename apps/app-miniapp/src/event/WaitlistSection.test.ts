import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatOfferCountdown, WaitlistView } from "./WaitlistSection";

const handlers = { onJoin: () => {}, onConfirm: () => {}, onDecline: () => {} };

describe("WaitlistView", () => {
  it("offers joining the waitlist in the idle state", () => {
    const html = renderToStaticMarkup(createElement(WaitlistView, { state: { status: "idle" }, ...handlers }));

    expect(html).toContain("Встать в лист ожидания");
    expect(html).not.toContain("Подтвердить");
  });

  it("shows the queue position in the waiting state", () => {
    const html = renderToStaticMarkup(createElement(WaitlistView, { state: { status: "waiting", position: 3 }, ...handlers }));

    expect(html).toContain("Вы 3-й в очереди");
    expect(html).not.toContain("Встать в лист ожидания");
  });

  it("shows the countdown and the confirm/decline actions in the offered state", () => {
    const html = renderToStaticMarkup(createElement(WaitlistView, { state: { status: "offered", secondsLeft: 599 }, ...handlers }));

    expect(html).toContain("9:59");
    expect(html).toContain("Подтвердить");
    expect(html).toContain("Отказаться");
    expect(html).not.toContain("Встать в лист ожидания");
  });

  it("renders the error state instead of the actions", () => {
    const html = renderToStaticMarkup(createElement(WaitlistView, { state: { status: "error" }, ...handlers }));

    expect(html).toContain("app-state--error");
    expect(html).not.toContain("Встать в лист ожидания");
  });
});

describe("formatOfferCountdown", () => {
  it("formats m:ss and clamps negative values", () => {
    expect(formatOfferCountdown(900)).toBe("15:00");
    expect(formatOfferCountdown(61)).toBe("1:01");
    expect(formatOfferCountdown(0)).toBe("0:00");
    expect(formatOfferCountdown(-5)).toBe("0:00");
  });
});
