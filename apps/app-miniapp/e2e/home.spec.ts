import { expect, test } from "@playwright/test";

test("home renders CTA pair and catalog cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Куда пойдём?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Рядом со мной" })).toBeVisible();
  // The event also appears in the promo rail above the catalog; the catalog card
  // is the one whose accessible name carries the city line.
  await expect(page.getByText(/Вечер Рахманинова/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Вечер Рахманинова.*Москва/ })).toBeVisible();
});
