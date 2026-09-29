// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ORGANIZER_BACK_COVER, ORGANIZER_BACK_SECTION, OrganizerNativeBackRoot, useOrganizerNativeBack } from "./organizer-native-back";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function installBackButton(): { shown: () => boolean; press: () => void } {
  let shown = false;
  let handler: (() => void) | null = null;
  window.WebApp = {
    platform: "web",
    version: "test",
    initData: "",
    initDataUnsafe: {},
    ready() {},
    openLink() {},
    openMaxLink() {},
    close() {},
    BackButton: {
      show() {
        shown = true;
      },
      hide() {
        shown = false;
      },
      onClick(callback: () => void) {
        handler = callback;
      },
      offClick(callback: () => void) {
        if (handler === callback) handler = null;
      },
    },
  };
  return {
    shown: () => shown,
    press() {
      handler?.();
    },
  };
}

async function mount(node: ReactElement): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(node);
  });
  return host;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  delete window.WebApp;
});

function WizardCabinet() {
  const [screen, setScreen] = useState<"list" | "wizard" | "manage">("list");
  const [step, setStep] = useState(1);
  const covered = screen === "manage";
  useOrganizerNativeBack(
    screen !== "list",
    () => {
      setScreen("list");
      setStep(1);
    },
    covered ? ORGANIZER_BACK_COVER : 0,
  );
  useOrganizerNativeBack(
    screen === "wizard",
    () => {
      if (step > 1) setStep((current) => current - 1);
      else setScreen("list");
    },
    ORGANIZER_BACK_SECTION,
  );
  const label = screen === "wizard" ? `wizard-${step}` : screen;
  return createElement(
    "div",
    null,
    createElement("p", null, label),
    createElement("button", { type: "button", onClick: () => setScreen("wizard") }, "open-wizard"),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          setScreen("wizard");
          setStep(2);
        },
      },
      "open-step",
    ),
    createElement("button", { type: "button", onClick: () => setScreen("manage") }, "open-manage"),
  );
}

describe("organizer native back", () => {
  it("hides the messenger button on a root screen and shows it once there is a step to leave", async () => {
    const button = installBackButton();
    const view = await mount(createElement(OrganizerNativeBackRoot, null, createElement(WizardCabinet)));

    expect(view.textContent).toContain("list");
    expect(button.shown()).toBe(false);

    await act(async () => {
      view.querySelector("button")?.click();
    });
    expect(view.textContent).toContain("wizard-1");
    expect(button.shown()).toBe(true);
  });

  it("steps the wizard before closing it, then hides the button on the list", async () => {
    const button = installBackButton();
    const view = await mount(createElement(OrganizerNativeBackRoot, null, createElement(WizardCabinet)));
    const openStep = [...view.querySelectorAll("button")].find((item) => item.textContent === "open-step");

    await act(async () => {
      openStep?.click();
    });
    expect(view.textContent).toContain("wizard-2");

    await act(async () => {
      button.press();
    });
    expect(view.textContent).toContain("wizard-1");
    expect(button.shown()).toBe(true);

    await act(async () => {
      button.press();
    });
    expect(view.textContent).toContain("list");
    expect(button.shown()).toBe(false);
  });

  it("lets a covering screen win over a section that is still mounted underneath", async () => {
    const button = installBackButton();
    function Covered() {
      const [screen, setScreen] = useState<"manage" | "home">("manage");
      const [place, setPlace] = useState("open");
      useOrganizerNativeBack(place === "open", () => setPlace("closed"), ORGANIZER_BACK_SECTION);
      useOrganizerNativeBack(screen === "manage", () => setScreen("home"), ORGANIZER_BACK_COVER);
      return createElement("p", null, `${screen}-${place}`);
    }
    const view = await mount(createElement(OrganizerNativeBackRoot, null, createElement(Covered)));

    await act(async () => {
      button.press();
    });
    expect(view.textContent).toContain("home-open");
    expect(button.shown()).toBe(true);
  });

  it("keeps working when the messenger did not provide a back button", async () => {
    delete window.WebApp;
    const view = await mount(createElement(OrganizerNativeBackRoot, null, createElement(WizardCabinet)));

    await act(async () => {
      view.querySelector("button")?.click();
    });
    expect(view.textContent).toContain("wizard-1");
    expect(window.WebApp).toBeUndefined();
  });
});
