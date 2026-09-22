import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("plans tab renders plan cards", async ({ page }) => {
  await enterAsUser(page);
  await page.getByRole("button", { name: "Моё" }).click();
  await expect(page.getByText(/Ты \+ \d+ (друг|друга|друзей)/).first()).toBeVisible();
  await expect(page.getByText(/Сбор \d{2}:\d{2}/).first()).toBeVisible();
});
