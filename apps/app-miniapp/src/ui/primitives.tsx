// START_MODULE_CONTRACT
// PURPOSE: App UI primitives over Ionic React: AppButton, AppTitle, AppText, AppAvatar, AppChip.
// SCOPE: Thin typed wrappers; AppChip is token-styled (no Ionic equivalent); visual styling in ./theme.css.
// DEPENDS: @ionic/react (IonButton, IonAvatar), ./theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppButton - IonButton wrapper; tone primary|secondary|danger|ghost|confirm, stretched = full width; app-btn classes carry the pill skin in theme.css
// - AppButtonTone - union of AppButton tones; form carries meaning - filled = badge, outlined = irreversible, dark fill = confirmation
// - appButtonClass - tone -> class mapping; exported because ionic hides className from rendered markup
// - AppIconButton - round icon-only IonButton (create/share actions)
// - AppTitle - heading text (app-title class)
// - AppText - body text (app-text class)
// - AppAvatar - IonAvatar: image when src given, otherwise the label children
// - AppChip - toggle chip button (aria-pressed)
// - AppNavTiles - grid of navigation tiles (icon + label) replacing full-width entry buttons
// - AppNavTileItem - one navigation tile (icon, label, onClick)
// - AppState - loading/empty/error state block: alert icon on error, text, optional hint line and up to two actions
// - AppStateAction - retry action payload of AppState (label + onClick)
// - AppStateKind - the reusable empty/blocked states of the design (screen 48)
// - APP_STATE_COPY - wording per AppStateKind, so screens do not each invent their own
// - AppEmptyState - AppState preconfigured from APP_STATE_COPY; actions render only when a handler is given
// - AppSkeleton - pulsing placeholder block (lines or media) for loading states; className shapes one placeholder while the variant keeps the pulse
// - AppSkeletonList - the loading state of a list: N skeleton rows announced as a single status
// - AppSection - section rhythm primitive: title row with an optional right-side action, unified top margin
// - CATEGORY_MEDIA_ICON - event category -> placeholder icon mapping
// - AppMedia - media placeholder: category-fixed MAX gradient + category icon (neutral gradient without a category)
// END_MODULE_MAP

import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { IonAvatar, IonButton } from "@ionic/react";
import type { EventCategory } from "@max-events/api-contracts";
import { ActionIcon, type ActionIconName } from "./icons";

export type AppButtonTone = "primary" | "secondary" | "danger" | "ghost" | "confirm";

// Skins live in theme.css on .app-btn--<tone>. Ни один тон не передаёт color в Ionic:
// color красит --background внутри тени и перекрывает класс, поэтому primary тоже рисуется классом.
const TONE_PROPS: Record<AppButtonTone, { color?: string; fill?: "clear" }> = {
  // Без color: Ionic красит --background своим #007aff внутри тени и перекрывает градиент класса.
  primary: {},
  secondary: {},
  danger: {},
  ghost: { fill: "clear" },
  confirm: {},
};

/**
 * The tone -> class mapping, split out because it cannot be asserted through the rendered markup:
 * @ionic/react drops className before createElement and re-attaches it to the DOM node on mount,
 * so server-rendered ion-button carries no class at all. This is the seam tests can hold onto.
 */
export function appButtonClass(tone: AppButtonTone, className?: string): string {
  return `app-btn app-btn--${tone}${className ? ` ${className}` : ""}`;
}

export function AppButton({ tone = "primary", stretched = false, className, ...props }: ComponentProps<typeof IonButton> & { tone?: AppButtonTone; stretched?: boolean }) {
  return <IonButton className={appButtonClass(tone, className)} expand={stretched ? "block" : undefined} {...TONE_PROPS[tone]} {...props} />;
}

export function AppIconButton({ className, children, ...props }: ComponentProps<typeof IonButton>) {
  const buttonClass = `app-icon-btn${className ? ` ${className}` : ""}`;
  return (
    <IonButton className={buttonClass} shape="round" {...props}>
      {children}
    </IonButton>
  );
}

export function AppTitle({ asChild = false, children, ...props }: ComponentProps<"h1"> & { asChild?: boolean }) {
  if (asChild && isValidElement(children)) return children;
  return (
    <h1 className="app-title" {...props}>
      {children}
    </h1>
  );
}

export function AppText({ className, ...props }: ComponentProps<"p">) {
  return <p className={className ? `app-text ${className}` : "app-text"} {...props} />;
}

export function AppAvatar({ src, size = 44, children }: { src?: string | null; size?: number; children?: ReactNode }) {
  return (
    <IonAvatar className="app-avatar" style={{ width: size, height: size }}>
      {src ? <img alt="" src={src} /> : <span className="app-avatar-label">{children}</span>}
    </IonAvatar>
  );
}

export function AppChip({ pressed = false, className, ...props }: ComponentProps<"button"> & { pressed?: boolean }) {
  const chipClass = className ? `${className} app-chip` : "app-chip";
  return <button aria-pressed={pressed} className={pressed ? `${chipClass} app-chip--on` : chipClass} type="button" {...props} />;
}

export interface AppNavTileItem {
  icon: ActionIconName;
  label: string;
  onClick: () => void;
}

export function AppNavTiles({ items }: { items: AppNavTileItem[] }) {
  return (
    <div className="app-nav-tiles">
      {items.map((item) => (
        <button key={item.label} type="button" className="app-nav-tile" onClick={item.onClick}>
          <ActionIcon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface AppStateAction {
  label: string;
  onClick: () => void;
}

export function AppState({ error = false, hint, action, secondaryAction, children }: { error?: boolean; hint?: ReactNode; action?: AppStateAction; secondaryAction?: AppStateAction; children: ReactNode }) {
  return (
    <div className="app-state-block">
      {error && (
        <span className="app-state-icon" aria-hidden="true">
          <ActionIcon name="alert" size={28} />
        </span>
      )}
      <p className={error ? "app-state app-state--error" : "app-state"}>{children}</p>
      {hint !== undefined && <p className="app-state-hint">{hint}</p>}
      {(action ?? secondaryAction) !== undefined && (
        <div className="app-state-actions">
          {action && (
            <AppButton tone="secondary" onClick={action.onClick}>
              {action.label}
            </AppButton>
          )}
          {secondaryAction && (
            <AppButton tone="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}

export type AppStateKind = "empty-feed" | "offline" | "forbidden" | "not-moderator" | "empty-match" | "friends-unsynced";

/** One wording per state, shared by every screen that can reach it (макет, экран 51). */
export const APP_STATE_COPY: Record<AppStateKind, { text: string; hint?: string; action?: string; secondaryAction?: string }> = {
  "empty-feed": { text: "На эти выходные у друзей пока нет планов", action: "Предложить первым" },
  offline: { text: "Показываем сохранённое", hint: "Твои планы доступны офлайн", action: "Обновить" },
  forbidden: { text: "Этот список открыт не для всех", action: "Попросить доступ" },
  "not-moderator": { text: "Раздел модерации недоступен" },
  "empty-match": { text: "Под такие ответы ничего нет", action: "Изменить бюджет", secondaryAction: "Ответить заново" },
  "friends-unsynced": { text: "Пока никого нет", action: "Синхронизировать контакты" },
};

/** An action without a handler is not rendered: a dead button reads as a broken screen. */
export function AppEmptyState({ kind, onAction, onSecondaryAction }: { kind: AppStateKind; onAction?: () => void; onSecondaryAction?: () => void }) {
  const copy = APP_STATE_COPY[kind];
  return (
    <AppState hint={copy.hint} action={copy.action !== undefined && onAction !== undefined ? { label: copy.action, onClick: onAction } : undefined} secondaryAction={copy.secondaryAction !== undefined && onSecondaryAction !== undefined ? { label: copy.secondaryAction, onClick: onSecondaryAction } : undefined}>
      {copy.text}
    </AppState>
  );
}

export function AppSkeleton({ variant = "line", width, className }: { variant?: "line" | "line-short" | "block" | "media"; width?: string; className?: string }) {
  const variantClass = variant === "media" ? "app-skeleton-block app-skeleton-block--media" : variant === "block" ? "app-skeleton-block" : variant === "line-short" ? "app-skeleton-line app-skeleton-line--short" : "app-skeleton-line";
  // The extra class shapes one placeholder (a ring, a hero) while the pulse keeps coming from the variant.
  return <span className={className ? `${variantClass} ${className}` : variantClass} style={width ? { width } : undefined} aria-hidden="true" />;
}

/** The rows are aria-hidden on their own, so the status label is what assistive tech reads. */
export function AppSkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="app-skeleton-list" role="status" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-skeleton-row">
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      ))}
    </div>
  );
}

export function AppSection({ title, action, className, ariaLabel, children }: { title?: string; action?: ReactNode; className?: string; ariaLabel?: string; children: ReactNode }) {
  const sectionClass = className ? `app-section ${className}` : "app-section";
  return (
    <section className={sectionClass} aria-label={ariaLabel ?? title}>
      {title !== undefined && (
        <div className="app-section-head">
          <h2 className="app-section-title">{title}</h2>
          {action !== undefined && <div className="app-section-actions">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const CATEGORY_MEDIA_ICON: Record<EventCategory, ActionIconName> = {
  afisha: "ticket",
  volunteering: "heart",
  tourism: "pin",
  sport: "star",
};

export function AppMedia({ category, className, src }: { category?: EventCategory; className?: string; src?: string | null }) {
  const mediaClass = ["app-card-media", category !== undefined ? `app-media--${category}` : "", className ?? ""].filter(Boolean).join(" ");
  if (src) {
    return (
      <div className={mediaClass}>
        <img alt="" className="app-card-media-img" src={src} />
      </div>
    );
  }
  return <div className={mediaClass}>{category !== undefined && <ActionIcon name={CATEGORY_MEDIA_ICON[category]} size={22} />}</div>;
}
