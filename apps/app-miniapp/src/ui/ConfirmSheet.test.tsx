// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmSheet } from "./ConfirmSheet";

async function mount(node: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { host, root };
}

async function unmount(host: HTMLDivElement, root: Root): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

describe("ConfirmSheet", () => {
  it("presents the question as a modal dialog with the safe choice first", async () => {
    const { host, root } = await mount(createElement(ConfirmSheet, { title: "Отменить запись?", confirmLabel: "Отменить запись", onConfirm: () => {}, onClose: () => {} }));

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Отменить запись?");
    const buttons = [...host.querySelectorAll("section button")].map((button) => button.textContent);
    expect(buttons).toEqual(["Оставить", "Отменить запись"]);

    await unmount(host, root);
  });

  it("fires the action only on the confirm button; cancel and the backdrop dismiss", async () => {
    let confirmed = 0;
    let closed = 0;
    const { host, root } = await mount(
      createElement(ConfirmSheet, {
        title: "Выйти?",
        confirmLabel: "Выйти",
        onConfirm: () => {
          confirmed += 1;
        },
        onClose: () => {
          closed += 1;
        },
      }),
    );

    const [cancel, confirm] = [...host.querySelectorAll("section button")] as HTMLButtonElement[];
    await act(async () => {
      cancel.click();
    });
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(confirmed).toBe(0);
    expect(closed).toBe(1);

    await act(async () => {
      confirm.click();
    });
    expect(confirmed).toBe(1);
    expect(closed).toBe(1);

    await act(async () => {
      (host.querySelector(".app-save-sheet-backdrop") as HTMLButtonElement).click();
    });
    expect(confirmed).toBe(1);
    expect(closed).toBe(2);

    await unmount(host, root);
  });
});
