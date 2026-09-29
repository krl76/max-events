import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("event page opens from a catalog card with the action panel", async ({ page }) => {
  await enterAsUser(page);
  // The event also appears in the promo rail above the catalog; the catalog card
  // is the one whose accessible name carries the city line.
  await page.getByRole("button", { name: /Вечер Рахманинова.*Москва/ }).click();
  await expect(page.locator(".app-header-title")).toHaveText("Событие");
  await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Собрать план" })).toBeVisible();
});
