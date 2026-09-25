// START_MODULE_CONTRACT
// PURPOSE: The pure layer behind the moderator contour (макет, экраны 49 и 50): labels, the two streams of the queue, the grouping by reported object and the wording of one разбор.
// SCOPE: Pure functions and tables only — no API calls and no JSX, so both screens and their tests share one source of truth about what the queue says.
// DEPENDS: @max-events/api-contracts (Report, ReportReason, ReportSource, ReportTargetType), ../api/client.js (ModerationTarget)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REPORT_REASON_LABELS - ru labels per report reason
// - REPORT_TARGET_LABELS - ru labels per report target type
// - REPORT_SOURCE_LABELS - ru labels: a complaint or a moderator's own spot check
// - MODERATION_STREAMS - the two tabs in design order: жалобы and выборочные проверки
// - ModerationStream - complaints | checks
// - ModerationGroup - one queue card: the object, how many rows point at it and what they say
// - groupModerationQueue - open reports + resolved targets -> the cards of one stream, busiest object first
// - moderationStreamCounts - how many cards each tab holds, for the numbers on the tabs
// - reasonSummary - the second line of a card: the reason the rows agree on, or the two loudest ones
// - claimsTitle - «ТРИ ЖАЛОБЫ» / «ВЫБОРОЧНАЯ ПРОВЕРКА» above the list of одна разборка
// - formatClaimWhen - «сегодня 14:20», «вчера 23:10», «16 сентября»
// - MODERATION_ACTIONS - the three answers to one queue card, in design order
// - ModerationAction - unpublish | ban | dismiss
// - ACTION_DONE_LABELS - what the screen says once an action went through
// - MODERATION_CONFIRM_COPY - the question, the consequence and the verb of each irreversible action
// - MODERATION_IRREVERSIBLE_NOTE - the footnote both irreversible actions share
// END_MODULE_MAP

import type { Report, ReportReason, ReportSource, ReportTargetType } from "@max-events/api-contracts";
import type { ModerationTarget } from "../api/client";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам и повторные публикации",
  abuse: "Оскорбления",
  inaccurate: "Вводит в заблуждение",
  inappropriate: "Неуместное содержание",
  other: "Другое",
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  event: "Событие",
  place: "Место",
  feed_post: "Пост ленты",
  micro_event: "Микро-событие",
};

export const REPORT_SOURCE_LABELS: Record<ReportSource, string> = { user: "жалоба", spot_check: "проверка модератора" };

export type ModerationStream = "complaints" | "checks";

/** Жалобы и выборочные проверки — разные потоки: их нельзя складывать в один список и считать одним числом. */
export const MODERATION_STREAMS: Array<{ id: ModerationStream; label: string; source: ReportSource }> = [
  { id: "complaints", label: "Жалобы", source: "user" },
  { id: "checks", label: "Проверка", source: "spot_check" },
];

export interface ModerationGroup {
  targetType: ReportTargetType;
  targetId: string;
  title: string;
  note: string;
  count: number;
  reports: Report[];
  target: ModerationTarget | null;
}

/** «3 жалобы» on a card: the plural the count needs, spelled out rather than glued on. */
function claimsWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "жалоб";
  if (mod10 === 1) return "жалоба";
  if (mod10 >= 2 && mod10 <= 4) return "жалобы";
  return "жалоб";
}

/**
 * Inside a stream the queue is grouped by the object, not by the row: three complaints about one event
 * are one decision, and three cards would invite three answers to the same question.
 */
export function groupModerationQueue(reports: Report[], targets: ModerationTarget[], stream: ModerationStream): ModerationGroup[] {
  const source = MODERATION_STREAMS.find((row) => row.id === stream)!.source;
  const byTarget = new Map<string, ModerationGroup>();
  for (const report of reports) {
    if (report.source !== source) continue;
    const key = `${report.targetType}:${report.targetId}`;
    const found = byTarget.get(key);
    if (found) {
      found.count += 1;
      found.reports.push(report);
      continue;
    }
    const target = targets.find((row) => row.targetType === report.targetType && row.targetId === report.targetId) ?? null;
    byTarget.set(key, { targetType: report.targetType, targetId: report.targetId, title: target?.title ?? "Объект недоступен", note: "", count: 1, reports: [report], target });
  }
  return [...byTarget.values()].map((group) => ({ ...group, note: reasonSummary(group.reports) })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export function moderationStreamCounts(reports: Report[]): Record<ModerationStream, number> {
  return { complaints: new Set(reports.filter((row) => row.source === "user").map((row) => `${row.targetType}:${row.targetId}`)).size, checks: new Set(reports.filter((row) => row.source === "spot_check").map((row) => `${row.targetType}:${row.targetId}`)).size };
}

/** One reason when the rows agree, the two loudest otherwise: the card has room for a line, not a list. */
export function reasonSummary(reports: Report[]): string {
  const counts = new Map<ReportReason, number>();
  for (const report of reports) counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked
    .slice(0, 2)
    .map(([reason]) => REPORT_REASON_LABELS[reason])
    .join(" · ");
}

const NUMBER_WORDS = ["", "ОДНА", "ДВЕ", "ТРИ", "ЧЕТЫРЕ", "ПЯТЬ", "ШЕСТЬ", "СЕМЬ", "ВОСЕМЬ", "ДЕВЯТЬ", "ДЕСЯТЬ"];

/** «ТРИ ЖАЛОБЫ» over the list, as in the design; past ten the word gives way to the digit. */
export function claimsTitle(count: number, source: ReportSource): string {
  if (source === "spot_check") return "ВЫБОРОЧНАЯ ПРОВЕРКА";
  const word = NUMBER_WORDS[count] ?? String(count);
  return `${word} ${claimsWord(count).toUpperCase()}`;
}

export function formatClaimWhen(createdAt: string, now: Date = new Date()): string {
  const at = new Date(createdAt);
  const time = at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return `сегодня ${time}`;
  if (days === 1) return `вчера ${time}`;
  return at.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export type ModerationAction = "unpublish" | "ban" | "dismiss";

export const MODERATION_ACTIONS: readonly ModerationAction[] = ["unpublish", "dismiss", "ban"];

export const ACTION_DONE_LABELS: Record<ModerationAction, string> = { unpublish: "Снято с публикации", ban: "Автор забанен", dismiss: "Решено без действий" };

/**
 * Both sanctions are irreversible from the interface, so neither runs on the first tap: the card names
 * the consequence out loud and only the dark-filled verb in it actually does the thing.
 */
export const MODERATION_CONFIRM_COPY: Record<"unpublish" | "ban", { open: string; question: string; consequence: string; verb: string }> = {
  unpublish: {
    open: "Снять с публикации",
    question: "Снять с публикации?",
    consequence: "Объект исчезнет из лент, поиска и карты. Участникам придёт уведомление. Вернуть публикацию из интерфейса нельзя.",
    verb: "Снять",
  },
  ban: {
    open: "Забанить автора",
    question: "Забанить автора?",
    consequence: "Автор потеряет доступ к публикации событий и мест. Его прошлые публикации останутся, пока их не снимут отдельно.",
    verb: "Забанить",
  },
};

export const MODERATION_IRREVERSIBLE_NOTE = "Бан и снятие с публикации необратимы в интерфейсе — отменить их можно только через поддержку.";
