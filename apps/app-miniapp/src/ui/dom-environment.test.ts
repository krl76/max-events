/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

describe("happy-dom environment", () => {
  it("records DOM state after a click", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.addEventListener("click", () => button.setAttribute("aria-pressed", "true"));
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});
