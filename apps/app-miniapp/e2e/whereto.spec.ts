import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("whereto wizard walks through company, context and shows the result", async ({ page }) => {
  await enterAsUser(page);
  await page.getByRole("button", { name: "Куда пойдём?" }).click();
  await expect(page.getByText("Шаг 1 из 3 — Кто идёт?")).toBeVisible();

  await page.getByRole("button", { name: "С друзьями" }).click();
  await expect(page.getByText("Шаг 2 из 3 — Настроение и бюджет")).toBeVisible();

  await page.getByRole("button", { name: "Спокойное" }).click();
  await page.getByRole("button", { name: "До 3000 ₽" }).click();
  await page.getByRole("button", { name: "Показать подборку" }).click();

  await expect(page.getByText("Шаг 3 из 3 — Ваша подборка")).toBeVisible();
  await expect(page.getByRole("button", { name: "Отправить друзьям" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Выставка импрессионистов/ })).toBeVisible();
});
