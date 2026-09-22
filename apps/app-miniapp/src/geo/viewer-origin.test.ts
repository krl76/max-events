import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { useViewerOrigin } from "./viewer-origin";

function Probe() {
  const origin = useViewerOrigin();
  return createElement("span", null, `${origin.source}:${origin.latitude}:${origin.longitude}`);
}

describe("useViewerOrigin", () => {
  it("falls back to Moscow when geolocation is unavailable", () => {
    vi.stubGlobal("navigator", {});
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain(`fallback:${MOSCOW_CENTER[0]}:${MOSCOW_CENTER[1]}`);
    vi.unstubAllGlobals();
  });
});
