// START_MODULE_CONTRACT
// PURPOSE: Entry screen (макет, экран 01): full-bleed branded backdrop under a darkening veil, the афиша·MAX wordmark, «Войти через MAX» / «Вход организатора» and the terms line.
// SCOPE: Presentational screen; the chosen mode is handed to the caller. The wordmark lives here because the entry screen owns it and the onboarding intro reuses it.
// DEPENDS: ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EntryMode - user | organizer
// - AfishaWordmark - «афиша · MAX» wordmark with the brand-cyan dot between the words (entry screen and onboarding intro)
// - EntryPage - branded backdrop + wordmark + the two entry options + the terms line
// END_MODULE_MAP

import { ActionIcon } from "../ui/icons";

export type EntryMode = "user" | "organizer";

/** aria-label rather than markup text: the dot between the words is decor, and "афишаMAX" is what it would otherwise read as. */
export function AfishaWordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `app-wordmark ${className}` : "app-wordmark"} aria-label="афиша MAX">
      <span aria-hidden="true">афиша</span>
      <span className="app-wordmark-dot" aria-hidden="true" />
      <span aria-hidden="true">MAX</span>
    </span>
  );
}

export function EntryPage({ onSelect, userLabel = "Войти через MAX" }: { onSelect: (mode: EntryMode) => void; userLabel?: string }) {
  return (
    <section className="app-entry">
      {/* Макет ставит здесь фотографию города вечером под затемнением. Фото в продукте нет и по
          брендбуку быть не может, поэтому подложка экрана — gradient-dark, а вертикальная вуаль
          из макета остаётся: она держит композицию (светлая середина, тёмные края под текстом). */}
      <span className="app-entry-veil" aria-hidden="true" />
      <div className="app-entry-hero">
        <span className="app-entry-logo">
          <ActionIcon name="pin" size={40} strokeWidth={2.2} />
        </span>
        <h1 className="app-entry-title">
          <AfishaWordmark />
        </h1>
        <p className="app-entry-tagline">События, места и друзья рядом с тобой</p>
      </div>
      {/* Нативные кнопки, а не AppButton: у заставки собственная форма (56px, радиус карточки,
          белая заливка на тёмной земле), а ion-button с атрибутом color кладёт цвет темы в
          теневом DOM через !important и такой инверсии не отдаёт. */}
      <div className="app-entry-actions">
        <button type="button" className="app-entry-btn app-entry-btn--max" onClick={() => onSelect("user")}>
          <span className="app-entry-max-mark" aria-hidden="true">
            M
          </span>
          {userLabel}
        </button>
        <button type="button" className="app-entry-btn app-entry-btn--organizer" onClick={() => onSelect("organizer")}>
          <ActionIcon name="building" size={20} strokeWidth={2.1} />
          Вход организатора
        </button>
        <p className="app-entry-legal">Продолжая, вы принимаете условия использования и политику конфиденциальности</p>
      </div>
    </section>
  );
}
