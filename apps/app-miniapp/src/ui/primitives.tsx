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
// END_MODULE_MAP

import type { ComponentProps, ReactNode } from "react";
import { Avatar, Button, Typography } from "@maxhub/max-ui";
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
