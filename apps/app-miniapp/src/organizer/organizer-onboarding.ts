// START_MODULE_CONTRACT
// PURPOSE: Organizer onboarding mechanism (макет, экраны 43 и 44): the three intro slides, the Площадка → Реквизиты → Событие step order, the activity chips and the "intro already seen" flag.
// SCOPE: Pure data and functions plus the localStorage flag of экран 43; the screens are ./OrganizerIntro.tsx and ./OrganizerSetup.tsx, the setup data itself travels through apiClient.getOrganizerSetup.
// DEPENDS: ../api/client.js (OrganizerActivity, OrganizerSetupStep), ../ui/icons.js (ActionIconName), window.localStorage
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_INTRO_STORAGE_KEY - localStorage key holding the "вступление организатора пройдено" flag (the max-events:onboarding neighbour of the user flow)
// - OrganizerIntroSlide - one slide of экран 43: hero label, title, description and which of the three hero gradients it wears
// - ORGANIZER_INTRO_SLIDES - the three slides of экран 43
// - isOrganizerIntroDone - whether вступление already ran on this device (storage failures read as "not yet")
// - markOrganizerIntroDone - persist the flag (storage failures are non-fatal: the flow must still finish)
// - ORGANIZER_SETUP_RAIL - the rail labels of экран 44 in step order: Площадка · Реквизиты · Событие
// - organizerSetupRailIndex - position of a step on that rail
// - nextOrganizerSetupStep - the step after this one, null when настройка is over
// - previousOrganizerSetupStep - the step before this one, null on the first step
// - OrganizerActivityOption - one «ЧЕМ ЗАНИМАЕТЕСЬ» chip: the contract value and its Russian label
// - ORGANIZER_ACTIVITY_OPTIONS - the five chips of экран 44 in the order макет lists them
// - organizerVenueInitials - the initials of the logo tile: up to two first letters of the venue name, uppercased
// - OrganizerNextUpItem - one «ДАЛЬШЕ ПОНАДОБИТСЯ» row: its glyph and text
// - ORGANIZER_NEXT_UP - the three rows макет puts under «ДАЛЬШЕ ПОНАДОБИТСЯ»
// - organizerSetupCtaLabel - the footer CTA of a step, naming where it leads the way макет does
// END_MODULE_MAP

import type { OrganizerActivity, OrganizerSetupStep } from "../api/client";
import type { ActionIconName } from "../ui/icons";

/** Сосед ключа пользовательского онбординга: то же пространство имён, тот же смысл «этот аппарат уже видел». */
export const ORGANIZER_INTRO_STORAGE_KEY = "max-events:organizer-onboarding";

export interface OrganizerIntroSlide {
  label: string;
  title: string;
  description: string;
  hero: 1 | 2 | 3;
}

/**
 * Макет рисует экран 43 на втором слайде — он здесь дословно. Первый и третий макет не показывает,
 * поэтому они говорят ровно о том, что в панели уже есть: дашборд с записями и источниками (экран 45)
 * и промо-инструменты с отчётом (экран 48). Обещать во вступлении то, чего за ним нет, нельзя.
 */
export const ORGANIZER_INTRO_SLIDES: readonly OrganizerIntroSlide[] = [
  { label: "Панель площадки", title: "Записи, люди и отдача — на одном экране", description: "Сколько записались, сколько дошли, откуда о вас узнали. Весь месяц виден сразу, без выгрузок.", hero: 1 },
  { label: "Записи и слоты", title: "Люди бронируют конкретное время", description: "Беседки, корты и столы — по часам. Занятость видна сразу, чек-ин закрывает запись на входе.", hero: 2 },
  { label: "Промо и отчёты", title: "Позвать тех, кто уже был", description: "Рассылка в чаты, подъём в ленте и промокоды — прямо из панели. Отчёт за месяц выгружается одной кнопкой.", hero: 3 },
];

export function isOrganizerIntroDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ORGANIZER_INTRO_STORAGE_KEY) === "done";
  } catch {
    // Приватный режим: показать вступление ещё раз лучше, чем запереть вход в панель.
    return false;
  }
}

export function markOrganizerIntroDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORGANIZER_INTRO_STORAGE_KEY, "done");
  } catch {
    // Потеря записи не должна отменять сам факт «прошёл».
  }
}

/** Рельс экрана 44 — тот же механизм, что у пользователя: подписи по шагам, заливка едет между ними. */
export const ORGANIZER_SETUP_RAIL: readonly { step: OrganizerSetupStep; label: string }[] = [
  { step: "venue", label: "Площадка" },
  { step: "payouts", label: "Реквизиты" },
  { step: "event", label: "Событие" },
];

export function organizerSetupRailIndex(step: OrganizerSetupStep): number {
  return ORGANIZER_SETUP_RAIL.findIndex((item) => item.step === step);
}

/** null means настройка is over — the caller hands the organizer to the dashboard or to «Создать». */
export function nextOrganizerSetupStep(step: OrganizerSetupStep): OrganizerSetupStep | null {
  return ORGANIZER_SETUP_RAIL[organizerSetupRailIndex(step) + 1]?.step ?? null;
}

/** null on «Площадка»: there is nothing before the first step to go back to. */
export function previousOrganizerSetupStep(step: OrganizerSetupStep): OrganizerSetupStep | null {
  const index = organizerSetupRailIndex(step);
  return index > 0 ? ORGANIZER_SETUP_RAIL[index - 1].step : null;
}

export interface OrganizerActivityOption {
  activity: OrganizerActivity;
  label: string;
}

export const ORGANIZER_ACTIVITY_OPTIONS: readonly OrganizerActivityOption[] = [
  { activity: "events", label: "События" },
  { activity: "slots", label: "Слоты и аренда" },
  { activity: "tours", label: "Экскурсии" },
  { activity: "sport", label: "Спорт" },
  { activity: "volunteering", label: "Волонтёрство" },
];

/**
 * Логотипа у площадки в контракте нет, поэтому плитка макета несёт инициалы названия — «Парк
 * Горького» читается как «ПГ». Два слова берутся по первым буквам, одно — по первым двум.
 */
export function organizerVenueInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface OrganizerNextUpItem {
  icon: ActionIconName;
  text: string;
}

export const ORGANIZER_NEXT_UP: readonly OrganizerNextUpItem[] = [
  { icon: "tag", text: "Реквизиты — чтобы принимать оплату" },
  { icon: "calendar", text: "Первое событие — черновик сохранится" },
  { icon: "qr", text: "Чек-ин на входе — включится сам" },
];

/** Кнопка макета называет не действие, а место, куда ведёт: «Дальше · реквизиты». */
export function organizerSetupCtaLabel(step: OrganizerSetupStep): string {
  const next = nextOrganizerSetupStep(step);
  if (next === null) return "Готово";
  return `Дальше · ${ORGANIZER_SETUP_RAIL[organizerSetupRailIndex(next)].label.toLowerCase()}`;
}
