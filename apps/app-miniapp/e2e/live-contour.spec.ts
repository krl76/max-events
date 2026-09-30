import { expect, test } from "@playwright/test";

const live = process.env.LIVE_BASE_URL;

test("plain browser session is the owner MAX contour, not the messenger-only gate", async ({ page }, testInfo) => {
  testInfo.skip(!live, "set LIVE_BASE_URL to run against a deployed stack");
  await page.goto(live.endsWith("/") ? live : `${live}/`);
  await page.waitForLoadState("networkidle");
  const userEntry = page.getByRole("button", { name: "Вход пользователя" });
  const chooser = await userEntry.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);
  if (chooser) await userEntry.click();
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Откройте MAX Events в мессенджере MAX/);
  expect(body).not.toMatch(/Войти через MAX/);
  expect(body).toMatch(/Лента/);
});
