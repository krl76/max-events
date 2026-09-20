import { expect, test } from "@playwright/test";

test("event booking toggles between book and booked, then cancels", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Вечер Рахманинова.*Москва/ }).click();
  await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible();

  await page.getByRole("button", { name: "Записаться" }).click();
  await expect(page.getByRole("button", { name: "Вы записаны" })).toBeVisible();

  await page.getByRole("button", { name: "Вы записаны" }).click();
  await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible();
});
