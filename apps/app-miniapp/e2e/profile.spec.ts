import { expect, test } from "@playwright/test";

test("profile edit saves a changed city", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Профиль" }).click();
  await expect(page.getByText("Редактировать")).toBeVisible();

  await page.getByText("Редактировать").click();
  const city = page.getByLabel("Город");
  await city.fill("Казань");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.locator(".app-profile-city")).toHaveText("Казань");
});
