import { expect, test } from "@playwright/test";

test("header back button returns to home via history", async ({ page }) => {
  await page.goto("/");
  // The event also appears in the promo rail above the catalog; the catalog card
  // is the one whose accessible name carries the city line.
  await page.getByRole("button", { name: /Вечер Рахманинова.*Москва/ }).click();
  await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("button", { name: "Куда пойдём?" })).toBeVisible();
});
