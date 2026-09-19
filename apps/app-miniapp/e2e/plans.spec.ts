import { expect, test } from "@playwright/test";

test("plans tab renders plan cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Планы" }).click();
  await expect(page.getByRole("banner").getByText("Планы", { exact: true })).toBeVisible();
  await expect(page.getByText(/Ты \+ \d+ (друг|друга|друзей)/).first()).toBeVisible();
  await expect(page.getByText(/Сбор \d{2}:\d{2}/).first()).toBeVisible();
});
