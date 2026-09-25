import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizerAuthProvider } from "./OrganizerAuthContext";
import { OrganizerLoginForm } from "./OrganizerSpace";

const noop = () => {};

function draw(): string {
  return renderToStaticMarkup(createElement(OrganizerAuthProvider, null, createElement(OrganizerLoginForm, { onExit: noop })));
}

describe("OrganizerLoginForm (макет, экран 42)", () => {
  it("titles itself «Панель организатора» and says who the door is for", () => {
    const html = draw();

    expect(html).toContain("Панель организатора");
    expect(html).toContain("Отдельный вход для площадок и организаторов.");
  });

  it("wears the афиша·MAX wordmark макета, not a bare glyph", () => {
    expect(draw()).toContain('aria-label="афиша MAX"');
  });

  it("labels both fields instead of leaning on placeholders alone", () => {
    const html = draw();

    expect(html).toContain("Логин");
    expect(html).toContain("Пароль");
    expect(html).toContain('type="password"');
  });

  it("offers to reveal the password, named for a screen reader in both states", () => {
    const html = draw();

    expect(html).toContain("Показать пароль");
    expect(html).toContain('aria-pressed="false"');
  });

  it("carries the support line макета with its accented tail", () => {
    const html = draw();

    expect(html).toContain("Нет логина? Напишите в поддержку афиши —");
    expect(html).toContain("заведём аккаунт");
  });

  it("keeps a way back out: reaching this screen by mistake must not trap the app", () => {
    expect(draw()).toContain("Назад");
  });

  it("holds «Войти» shut until both fields are filled", () => {
    expect(draw()).toContain("disabled");
  });
});
