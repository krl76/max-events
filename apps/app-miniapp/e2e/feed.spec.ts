import { expect, test } from "@playwright/test";
import { enterAsUser } from "./enter";

test("feed like increments the counter and publishing an impression shows the post", async ({ page }) => {
  await enterAsUser(page);

  const firstPost = page.locator(".app-card--post").first();
  const likes = firstPost.getByRole("button", { name: "Нравится", exact: true });
  const before = await likes.textContent();
  await likes.click();
  await expect(likes).not.toHaveText(before ?? "");

  await page.getByRole("button", { name: "Поделиться впечатлением" }).click();
  const text = "Тестовое впечатление из e2e";
  await page.getByLabel("К какому событию").fill("Вечер Рахманинова: симфонический оркестр");
  await page.getByPlaceholder("Расскажи, как всё прошло").fill(text);
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText(text)).toBeVisible();
});
