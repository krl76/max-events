// START_MODULE_CONTRACT
// PURPOSE: App UI primitives over MAX UI: AppButton, AppTitle, AppText, AppAvatar, AppChip.
// SCOPE: Thin typed wrappers; AppChip is token-styled (MAX UI 0.4.0 has no chip component); visual styling in ./theme.css.
// DEPENDS: @maxhub/max-ui (Button, Typography, Avatar), ./theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppButton - MAX Button wrapper; tone primary|secondary|danger|ghost, stretched = full width; app-btn classes carry the pill skin in theme.css
// - AppButtonTone - union of AppButton tones
// - AppTitle - MAX Typography.Title wrapper, asChild for semantic h1/h2 headings
// - AppText - MAX Typography.Text wrapper
// - AppAvatar - MAX Avatar.Container: image when src given, otherwise the label children
// - AppChip - toggle chip button (aria-pressed)
// - AppNavTiles - grid of navigation tiles (icon + label) replacing full-width entry buttons
// - AppState - loading/empty/error state block: alert icon on error, text, optional retry action
// - AppSkeleton - pulsing placeholder block (lines or media) for loading states
// - AppSection - section rhythm primitive: title row with an optional right-side action, unified top margin
// - AppMedia - media placeholder: category-fixed MAX gradient + category icon (neutral gradient without a category)
// END_MODULE_MAP

import type { ComponentProps, ReactNode } from "react";
import { Avatar, Button, Typography } from "@maxhub/max-ui";
import type { EventCategory } from "@max-events/api-contracts";
import { ActionIcon, type ActionIconName } from "./icons";

export type AppButtonTone = "primary" | "secondary" | "danger" | "ghost";

const TONE_VARIANT: Record<AppButtonTone, NonNullable<ComponentProps<typeof Button>["variant"]>> = {
  primary: "primary",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
};

export function AppButton({ tone = "primary", stretched = false, className, ...props }: ComponentProps<typeof Button> & { tone?: AppButtonTone; stretched?: boolean }) {
  const buttonClass = `app-btn app-btn--${tone}${className ? ` ${className}` : ""}`;
  return <Button className={buttonClass} stretched={stretched} variant={TONE_VARIANT[tone]} {...props} />;
}

export function AppTitle({ variant = "medium-strong", ...props }: ComponentProps<typeof Typography.Title>) {
  return <Typography.Title variant={variant} {...props} />;
}

export function AppText({ variant = "body", ...props }: ComponentProps<typeof Typography.Text>) {
  return <Typography.Text variant={variant} {...props} />;
}

export function AppAvatar({ src, size = 44, children }: { src?: string | null; size?: number; children?: ReactNode }) {
  return <Avatar.Container size={size}>{src ? <Avatar.Image alt="" src={src} /> : <Avatar.Text>{children}</Avatar.Text>}</Avatar.Container>;
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

export function AppState({ error = false, action, children }: { error?: boolean; action?: AppStateAction; children: ReactNode }) {
  return (
    <div className="app-state-block">
      {error && (
        <span className="app-state-icon" aria-hidden="true">
          <ActionIcon name="alert" size={28} />
        </span>
      )}
      <p className={error ? "app-state app-state--error" : "app-state"}>{children}</p>
      {action && (
        <AppButton tone="secondary" onClick={action.onClick}>
          {action.label}
        </AppButton>
      )}
    </div>
  );
}

export function AppSkeleton({ variant = "line", width }: { variant?: "line" | "line-short" | "block" | "media"; width?: string }) {
  const className = variant === "media" ? "app-skeleton-block app-skeleton-block--media" : variant === "block" ? "app-skeleton-block" : variant === "line-short" ? "app-skeleton-line app-skeleton-line--short" : "app-skeleton-line";
  return <span className={className} style={width ? { width } : undefined} aria-hidden="true" />;
}

export function AppSection({ title, action, className, ariaLabel, children }: { title?: string; action?: ReactNode; className?: string; ariaLabel?: string; children: ReactNode }) {
  const sectionClass = className ? `app-section ${className}` : "app-section";
  return (
    <section className={sectionClass} aria-label={ariaLabel ?? title}>
      {title !== undefined && (
        <div className="app-section-head">
          <AppTitle asChild>
            <h2 className="app-section-title">{title}</h2>
          </AppTitle>
          {action}
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

export function AppMedia({ category, className }: { category?: EventCategory; className?: string }) {
  const mediaClass = ["app-card-media", category !== undefined ? `app-media--${category}` : "", className ?? ""].filter(Boolean).join(" ");
  return <div className={mediaClass}>{category !== undefined && <ActionIcon name={CATEGORY_MEDIA_ICON[category]} size={22} />}</div>;
}
