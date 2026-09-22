import { type Page } from "@playwright/test";

/** Mock/dev shell shows EntryPage; live MAX contour skips it. */
export async function enterAsUser(page: Page): Promise<void> {
  await page.goto("/");
  const login = page.getByRole("button", { name: /Войти/ });
  if (await login.count()) await login.first().click();
}
