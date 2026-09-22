import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("place page: load from an event, check in and report (regression #414)", async ({ page }) => {
  await enterAsUser(page);
  // The «Лекция об импрессионистах» today-block event belongs to «ГМИИ им. А. С. Пушкина»;
  // the catalog card's accessible name carries the city line (same pattern as event.spec).
  await page.getByRole("button", { name: /Лекция об импрессионистах.*Москва/ }).click();
  await expect(page.locator(".app-header-title")).toHaveText("Событие");
  await page.getByRole("button", { name: "ГМИИ им. А. С. Пушкина" }).click();

  await expect(page.locator(".app-header-title")).toHaveText("Место");
  await expect(page.getByText("Не удалось загрузить место.")).toHaveCount(0);
  await expect(page.getByText("ул. Волхонка, 12")).toBeVisible();
  await expect(page.getByRole("button", { name: "Я здесь" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Пожаловаться" })).toBeVisible();

  await page.getByRole("button", { name: "Я здесь" }).click();
  await expect(page.getByRole("button", { name: "Вы были здесь" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вы были здесь" })).toBeDisabled();

  await page.getByRole("button", { name: "Пожаловаться" }).click();
  await expect(page.getByText("Спам или реклама")).toBeVisible();
  await page.getByText("Спам или реклама").click();
  await expect(page.getByText("Жалоба отправлена. Мы её проверим.")).toBeVisible();
});
