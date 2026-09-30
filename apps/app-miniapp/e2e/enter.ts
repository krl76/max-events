import { type Page } from "@playwright/test";

/** First open shows the chooser. A stored choice in this profile skips it. */
export async function enterAsUser(page: Page): Promise<void> {
  await page.goto("/");
  const login = page.getByRole("button", { name: "Вход пользователя" });
  const visible = await login.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);
  if (visible) await login.click();
}
