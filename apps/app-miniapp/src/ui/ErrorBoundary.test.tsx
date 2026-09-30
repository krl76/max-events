/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScreenErrorBoundary } from "./ErrorBoundary";

function Boom({ message }: { message: string }): ReactNode {
  throw new Error(message);
}

let allowRender = false;

function Gate({ message }: { message: string }): ReactNode {
  if (!allowRender) throw new Error(message);
  return <span>opened</span>;
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

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("ScreenErrorBoundary", () => {
  it("keeps the fallback and remounts a render crash on «Повторить»", async () => {
    allowRender = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { host, root } = await mount(
      createElement(ScreenErrorBoundary, { label: "profile crashed", children: createElement(Gate, { message: "Cannot read properties of null" }) }),
    );

    expect(host.textContent).toContain("Не удалось открыть экран");
    const retry = [...host.querySelectorAll("button, ion-button")].find((button) => button.textContent?.includes("Повторить"));
    expect(retry).toBeDefined();
    allowRender = true;
    await act(async () => {
      (retry as HTMLElement).click();
    });
    expect(host.textContent).toContain("opened");
    expect(host.textContent).not.toContain("Не удалось открыть экран");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("reloads the document when a stale chunk takes the screen down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const { host, root } = await mount(
      createElement(ScreenErrorBoundary, {
        label: "profile crashed",
        children: createElement(Boom, { message: "Failed to fetch dynamically imported module: /assets/ProfilePage.js" }),
      }),
    );

    expect(reload).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Не удалось открыть экран");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("swallows a quiet crash so an optional tile cannot take the screen with it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { host, root } = await mount(
      createElement(
        "div",
        null,
        createElement("span", null, "profile"),
        createElement(ScreenErrorBoundary, { label: "moderation entry crashed", quiet: true, children: createElement(Boom, { message: "nope" }) }),
      ),
    );

    expect(host.textContent).toContain("profile");
    expect(host.textContent).not.toContain("Не удалось открыть экран");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
