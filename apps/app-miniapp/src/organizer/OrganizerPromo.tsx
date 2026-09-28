// START_MODULE_CONTRACT
// PURPOSE: Promotion section: running campaigns and the actions that start one (boost, chat mailing, promo code, refer-a-friend, early access). Charts live on the overview.
// SCOPE: Pure helpers plus OrganizerPromoView (presentational) and OrganizerPromo (container). Campaigns and promo codes are real endpoints per event, so the screen fans out over the organizer's own events.
// DEPENDS: react, @max-events/api-contracts (PromoCode, PromotionCampaign), ../api/client.js (apiClient, OrganizerEvent, OrganizerSummary, StatsPeriodQuery), ./OrganizerDashboard.js (OrganizerPromoIntent, TRAFFIC_SOURCE_LABELS, barHeights, formatCount), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PROMOTION_ACTIONS - the five actions, in the order the screen lists them
// - promotionTimeLeft - «Осталось 14 ч» / «Осталось 3 дня» / «Завершена»
// - CampaignRow - one «Активные кампании» row, whichever of the three kinds it came from
// - campaignRows - promotions, referral campaigns and promo codes merged into the rows the screen lists
// - PROMOTION_TYPE_LABELS - ru label per promotion type
// - OrganizerPromoView - presentational: running campaigns and the action form
// - OrganizerPromo - container: the summary, the campaigns across own events, creating one and downloading the report
// END_MODULE_MAP

import type { PromoCampaign, PromoCode, PromotionCampaign, PromotionType } from "@max-events/api-contracts";
import type { OrganizerEvent } from "../api/client";
import { pluralRu } from "../catalog/format";
import type { ActionIconName } from "../ui/icons";
import { type OrganizerPromoIntent } from "./OrganizerDashboard";
import { OrganizerPromotion } from "./OrganizerPromotion";

export { PROMO_PERIODS, formatDelta, periodQueryFor, salesCsv } from "./OrganizerDashboard";

export const PROMOTION_ACTIONS: Array<{ intent: OrganizerPromoIntent; label: string; aria: string; icon: ActionIconName; dark?: boolean }> = [
  { intent: "boost", label: "Лента", aria: "Поднять в ленте", icon: "trend" },
  { intent: "target_collection", label: "Рассылка", aria: "Рассылка в чаты", icon: "megaphone" },
  { intent: "promocode", label: "Промокод", aria: "Промокод", icon: "ticket" },
  { intent: "referral", label: "Друг", aria: "Приведи друга", icon: "users" },
  { intent: "early_access", label: "Ранний", aria: "Ранний доступ", icon: "clock" },
];

export function promotionTimeLeft(endsAt: string, now: Date = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return "Завершена";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `Осталось ${hours} ч`;
  const days = Math.round(hours / 24);
  return `Осталось ${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = { boost: "Поднятие в ленте", banner: "Баннер", pin: "Закрепление", target_collection: "Рассылка в чаты" };

export type CampaignPhase = "active" | "scheduled" | "done";

export interface CampaignRow {
  id: string;
  eventId: string;
  icon: ActionIconName;
  accent: boolean;
  title: string;
  note: string;
  phase: CampaignPhase;
  result: string;
  /** 0..100 of the campaign's own window; null for a promo code, which has no clock. */
  progress: number | null;
}

/**
 * Three endpoints, one list: the design shows «Поднятие в ленте» and «Промокод» side by side, and the
 * viewer has no reason to care which table each came from.
 */
export function campaignRows(promotions: PromotionCampaign[], campaigns: PromoCampaign[], codes: PromoCode[], events: OrganizerEvent[], now: Date = new Date()): CampaignRow[] {
  const titleOf = (eventId: string) => events.find((item) => item.id === eventId)?.title ?? "Событие";
  const rows: CampaignRow[] = [];
  for (const promotion of promotions) {
    const span = new Date(promotion.endsAt).getTime() - new Date(promotion.startsAt).getTime();
    const gone = now.getTime() - new Date(promotion.startsAt).getTime();
    const phase: CampaignPhase = promotion.status === "completed" || new Date(promotion.endsAt).getTime() <= now.getTime() ? "done" : new Date(promotion.startsAt).getTime() > now.getTime() ? "scheduled" : "active";
    rows.push({
      id: promotion.id,
      eventId: promotion.eventId,
      icon: promotion.type === "target_collection" ? "megaphone" : "trend",
      accent: true,
      title: `${PROMOTION_TYPE_LABELS[promotion.type]} · ${titleOf(promotion.eventId)}`,
      note: `${promotionTimeLeft(promotion.endsAt, now)} · ${promotion.priceRub === 0 ? "без оплаты" : `${promotion.priceRub} ₽`}`,
      phase,
      result: promotion.type === "target_collection" ? "Это подборка для тех, кто уже был на событиях, а не сообщение в чат MAX. Доставку и открытия кабинет не считает." : promotion.paidAt === null ? "Показы и переходы не считаются. Запись без оплаты в ленту не попадает." : "Кампания отмечена оплаченной. Отдельных показов и переходов кабинет не хранит.",
      progress: span <= 0 ? 100 : Math.min(Math.max(Math.round((gone / span) * 100), 0), 100),
    });
  }
  for (const campaign of campaigns) {
    rows.push({
      id: campaign.id,
      eventId: campaign.eventId,
      icon: "friends",
      accent: true,
      title: `${campaign.title} · ${titleOf(campaign.eventId)}`,
      note: `Код ${campaign.code} · сработал ${campaign.fulfillmentCount} ${pluralRu(campaign.fulfillmentCount, "раз", "раза", "раз")}`,
      phase: campaign.status === "completed" ? "done" : "active",
      result: `Первый визит нового аккаунта засчитан ${campaign.fulfillmentCount} ${pluralRu(campaign.fulfillmentCount, "раз", "раза", "раз")}. Скидки в рублях нет.`,
      progress: null,
    });
  }
  for (const code of codes) {
    const expired = code.expiresAt !== null && new Date(code.expiresAt).getTime() <= now.getTime();
    rows.push({
      id: code.id,
      eventId: code.eventId,
      icon: "tag",
      accent: false,
      title: `Промокод ${code.code}`,
      note: `Использован ${code.redeemedCount} ${pluralRu(code.redeemedCount, "раз", "раза", "раз")}${code.maxRedemptions === null ? "" : ` из ${code.maxRedemptions}`}`,
      phase: expired ? "done" : "active",
      result: `Использований: ${code.redeemedCount}. Цену билета код не снижает.`,
      progress: null,
    });
  }
  return rows;
}


export function OrganizerPromo(_props: { organizationName: string; intent: OrganizerPromoIntent | null; eventId: string | null; onOpenEvent: (eventId: string) => void }) {
  return <OrganizerPromotion />;
}
