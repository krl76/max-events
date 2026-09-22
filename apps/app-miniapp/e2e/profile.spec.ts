import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("profile edit saves a changed city", async ({ page }) => {
  await enterAsUser(page);
  await page.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "Настройки профиля" }).click();
  const city = page.getByLabel("Город");
  await city.fill("Казань");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.locator(".app-profile-city")).toHaveText("Казань");
});
