// START_MODULE_CONTRACT
// PURPOSE: Разбор вечера для экрана 15 «План на вечер»: подпись шапки, таймлайн точек с переездами, денежные строки и сумма на человека, чипы уточнений.
// SCOPE: Чистые форматтеры и презентационные блоки над PlanCard / PlanTimeline / PlanBudget; ничего не грузит сам — данные приносит ./PlanPage.tsx.
// DEPENDS: ../api/client.js (PlanTimeline, PlanTransferMode), @max-events/api-contracts (PlanBudget, PlanCard), ../catalog/format.js (pluralRu), ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLAN_TRANSFER_ICON - вид переезда -> глиф (пешком / метро / такси)
// - PLAN_TRANSFER_LABELS - вид переезда -> ru-подпись
// - PLAN_TWEAKS - чипы уточнений макета и вопрос, с которым каждый уходит к ассистенту
// - planStepTime - «17:30» слева от шага
// - planHeaderSubtitle - «Пятница, 18 сентября · 4 человека» под заголовком экрана
// - formatRub - «1 200 ₽» без дробной части
// - planBudgetLines - расходы плана -> строки «за что / сколько»
// - planPerPersonRub - сумма на человека: доля зрителя, а без неё — общий счёт поровну
// - PlanStepsList - презентационно: точки вечера с точкой-маркером, временем и деталью
// - PlanMoneyBlock - презентационно: строки расходов и «Итого на человека»
// END_MODULE_MAP

import type { PlanBudget, PlanCard } from "@max-events/api-contracts";
import type { PlanTimeline, PlanTransferMode } from "../api/client";
import { pluralRu } from "../catalog/format";
import { ActionIcon, type ActionIconName } from "../ui/icons";

export const PLAN_TRANSFER_ICON: Record<PlanTransferMode, ActionIconName> = { walk: "navigation", metro: "metro", taxi: "car" };

export const PLAN_TRANSFER_LABELS: Record<PlanTransferMode, string> = { walk: "Пешком", metro: "Метро", taxi: "Такси" };

/**
 * Чипы под бюджетом (макет, экран 15). Каждый — просьба к тому же ассистенту, который вечер и собрал,
 * поэтому чип не правит план молча, а открывает экран 10 с уже набранным вопросом.
 */
export const PLAN_TWEAKS: ReadonlyArray<{ label: string; ask: string }> = [
  { label: "Добавить шаг", ask: "Добавь ещё одну точку в план на вечер" },
  { label: "Дешевле", ask: "Собери этот вечер дешевле" },
  { label: "Без такси", ask: "План на вечер без такси" },
  { label: "Другой вечер", ask: "Перенеси план на другой вечер" },
];

export function planStepTime(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** «Пятница, 18 сентября · 4 человека»: день сбора и вся компания вместе с хозяином плана. */
export function planHeaderSubtitle(card: PlanCard): string {
  const at = new Date(card.plan.meetingAt);
  const weekday = at.toLocaleDateString("ru-RU", { weekday: "long" });
  const people = card.plan.participants.length + 1;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${at.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · ${people} ${pluralRu(people, "человек", "человека", "человек")}`;
}

export function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

/** Строки блока денег — это расходы плана как есть: экран ничего не додумывает поверх бюджета. */
export function planBudgetLines(budget: PlanBudget): Array<{ id: string; title: string; amountRub: number }> {
  return budget.expenses.map((expense) => ({ id: expense.id, title: expense.title, amountRub: expense.amountRub }));
}

/**
 * «Итого на человека». Доля зрителя приходит из бюджета — она и есть ответ; общий счёт поровну остаётся
 * запасным путём для того, кого в разбивке нет (зритель ещё не участвовал ни в одном расходе).
 */
export function planPerPersonRub(budget: PlanBudget, viewerId: string | null): number {
  const own = viewerId === null ? undefined : budget.perPerson.find((row) => row.userId === viewerId);
  if (own !== undefined) return own.shareRub;
  return budget.perPerson.length === 0 ? budget.totalRub : Math.round(budget.totalRub / budget.perPerson.length);
}

export function PlanStepsList({ timeline, onOpenEvent }: { timeline: PlanTimeline; onOpenEvent: (eventId: string) => void }) {
  return (
    <ol className="app-plan-steps">
      {timeline.steps.map((step, index) => (
        <li key={`${step.at}-${step.title}`} className={index === timeline.steps.length - 1 ? "app-plan-step app-plan-step--last" : "app-plan-step"}>
          <span className="app-plan-step-rail" aria-hidden="true">
            <span className="app-plan-step-dot" />
            <span className="app-plan-step-line" />
          </span>
          <span className="app-plan-step-body">
            <span className="app-plan-step-at">{planStepTime(step.at)}</span>
            {step.eventId === null ? (
              <span className="app-plan-step-title">{step.title}</span>
            ) : (
              <button type="button" className="app-plan-step-title app-plan-step-title--link" onClick={() => onOpenEvent(step.eventId as string)}>
                {step.title}
              </button>
            )}
            <span className="app-plan-step-detail">
              {step.transfer !== null && (
                <span className="app-plan-step-mode" aria-hidden="true">
                  <ActionIcon name={PLAN_TRANSFER_ICON[step.transfer.mode]} size={14} strokeWidth={2} />
                </span>
              )}
              {step.detail}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PlanMoneyBlock({ budget, viewerId }: { budget: PlanBudget; viewerId: string | null }) {
  const lines = planBudgetLines(budget);
  return (
    <div className="app-plan-money">
      {lines.map((line) => (
        <div key={line.id} className="app-plan-money-row">
          <span className="app-plan-money-label">{line.title}</span>
          <span className="app-plan-money-value">{formatRub(line.amountRub)}</span>
        </div>
      ))}
      <div className="app-plan-money-row app-plan-money-row--total">
        <span className="app-plan-money-total-label">Итого на человека</span>
        <span className="app-plan-money-total-value">{formatRub(planPerPersonRub(budget, viewerId))}</span>
      </div>
    </div>
  );
}
