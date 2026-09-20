import { expect, test } from "@playwright/test";

test("join and leave a micro event updates the participant counter", async ({ page }) => {
  await page.goto("/");

  const card = page.locator(".app-card", { hasText: "Играем в баскетбол" });
  const counter = card.getByText(/участников/);
  const before = await counter.textContent();

  await card.getByRole("button", { name: "Присоединиться" }).click();
  await expect(counter).not.toHaveText(before ?? "");
  await expect(card.getByRole("button", { name: "Вы участвуете" })).toBeVisible();

  await card.getByRole("button", { name: "Вы участвуете" }).click();
  await expect(counter).toHaveText(before ?? "");
});
