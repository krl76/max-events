import { expect, test } from "@playwright/test";

const live = process.env.LIVE_BASE_URL;

test("plain browser session is the owner MAX contour, not the messenger-only gate", async ({ page }) => {
  test.skip(!live, "set LIVE_BASE_URL to run against a deployed stack");
  await page.goto(live.endsWith("/") ? live : `${live}/`);
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Откройте MAX Events в мессенджере MAX/);
  expect(body).toMatch(/Лента|События|MAX Events|Войти/);
});
