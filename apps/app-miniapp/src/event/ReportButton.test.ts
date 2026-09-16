import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { REPORT_REASON_LABELS, ReportButton, ReportMenu } from "./ReportButton";

describe("ReportButton", () => {
  it("renders the closed report button", () => {
    const html = renderToStaticMarkup(createElement(ReportButton, { eventId: "c0000001-0000-4000-8000-000000000001", userId: "a0000000-0000-4000-8000-000000000001" }));

    expect(html).toContain("Пожаловаться");
    expect(html).not.toContain("Спам");
  });
});

describe("ReportMenu", () => {
  it("renders every reason preset", () => {
    const html = renderToStaticMarkup(createElement(ReportMenu, { onReport: () => {}, sending: false, done: null }));

    for (const label of Object.values(REPORT_REASON_LABELS)) {
      expect(html).toContain(label);
    }
  });

  it("locks the reasons while the report is sending", () => {
    const html = renderToStaticMarkup(createElement(ReportMenu, { onReport: () => {}, sending: true, done: null }));

    expect(html).toContain("disabled");
  });

  it("shows the submitted state instead of the reasons", () => {
    const html = renderToStaticMarkup(createElement(ReportMenu, { onReport: () => {}, sending: false, done: "Жалоба отправлена. Мы её проверим." }));

    expect(html).toContain("Жалоба отправлена");
    expect(html).not.toContain("Спам или реклама");
  });
});
