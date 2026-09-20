import { expect, test } from "@playwright/test";

test("feed like increments the counter and publishing an impression shows the post", async ({ page }) => {
  await page.goto("/");

  const firstPost = page.locator(".app-card--post").first();
  const likes = firstPost.locator(".app-post-likes");
  const before = await likes.textContent();
  await firstPost.getByRole("button", { name: "Нравится" }).click();
  await expect(likes).not.toHaveText(before ?? "");

  await page.getByRole("button", { name: "Поделиться впечатлением" }).click();
  const text = "Тестовое впечатление из e2e";
  await page.getByLabel("К какому событию").fill("Вечер Рахманинова: симфонический оркестр");
  await page.getByPlaceholder("Расскажи, как всё прошло").fill(text);
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText(text)).toBeVisible();
});
