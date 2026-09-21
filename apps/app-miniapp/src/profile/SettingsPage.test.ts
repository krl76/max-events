import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsView } from "./SettingsPage";
import type { Profile } from "@max-events/api-contracts";

const profile: Profile = { userId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", city: "Москва", interests: ["бег", "джаз"], smartAlerts: { leaveNow: true, weather: true, friendLeft: true, listDigest: true }, privacy: { visitHistory: "friends", routes: "friends" }, recommendationsEnabled: true };

describe("SettingsView", () => {
  it("renders the profile fields prefilled from the profile", () => {
    const html = renderToStaticMarkup(createElement(SettingsView, { profile, saving: false, onSave: () => {}, onCancel: () => {} }));

    expect(html).toContain('value="Москва"');
    expect(html).toContain('value="бег, джаз"');
    expect(html).toContain("Сохранить");
    expect(html).toContain("Отмена");
  });

  it("disables saving while a save is in flight", () => {
    const html = renderToStaticMarkup(createElement(SettingsView, { profile, saving: true, onSave: () => {}, onCancel: () => {} }));

    expect(html).toContain("Сохранение…");
    expect(html).toContain("disabled");
  });
});
