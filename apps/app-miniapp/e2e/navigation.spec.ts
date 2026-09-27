import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("tabbar shows feed, search, map, plans and profile tabs", async ({ page }) => {
  await enterAsUser(page);
  const tabbar = page.locator(".app-tabbar");

  for (const label of ["Лента", "Поиск", "Карта", "Моё", "Профиль"]) {
    await expect(tabbar.getByRole("button", { name: label })).toBeVisible();
  }
  await expect(tabbar.getByRole("button", { name: "Лента" })).toHaveAttribute("aria-current", "page");

  await tabbar.getByRole("button", { name: "Поиск" }).click();
  await expect(tabbar.getByRole("button", { name: "Поиск" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Поиск событий")).toBeVisible();
  await expect(page.locator(".app-header")).toBeHidden();

  await tabbar.getByRole("button", { name: "Карта" }).click();
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.locator(".app-content")).toHaveClass(/app-content--flush/);

  await tabbar.getByRole("button", { name: "Моё" }).click();
  await expect(page.locator(".app-header")).toBeHidden();
});

test("header back button returns to home via history", async ({ page }) => {
  await enterAsUser(page);
  // The event also appears in the promo rail above the catalog; the catalog card
  // is the one whose accessible name carries the city line.
  await page.getByRole("button", { name: /Вечер Рахманинова.*Москва/ }).click();
  await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("region", { name: "Куда пойдём?" })).toBeVisible();
});
