// START_MODULE_CONTRACT
// PURPOSE: Plan budget block on the plan screen: expense list, add-expense form (title/amount/payer/shares), per-person totals and the who-owes-whom table.
// SCOPE: Data via apiClient.getPlanBudget/addPlanExpense; all money values (shares, nets, debts, total) come from the API budget aggregate, never computed on the client; 403 hides the block (budget is a participant-only surface, backend canView/canSpend parity); inline validation errors.
// DEPENDS: ../api/client.js (apiClient, ApiError), ../auth/AuthContext.js (useAuth), @max-events/api-contracts (Friend, PlanBudget), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BudgetState - union of the budget fetch states (loading / error / hidden / ready)
// - ExpenseDraft - add-expense form draft (string amount field)
// - emptyExpenseDraft - initial form state for a payer
// - expenseDraftErrors - inline validation errors (ru), empty list when ready
// - expenseNameOf - user id -> display name (plan participant names; «Ты» only for the viewer id, «Участник» for unknown)
// - BudgetView - presentational: expenses, totals, debts table, add form
// - BudgetSection - container: loads the budget of a plan, wires expense creation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend, PlanBudget } from "@max-events/api-contracts";
import { apiClient, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AppButton, AppState } from "../ui/primitives";

export type BudgetState = { status: "loading" } | { status: "error" } | { status: "hidden" } | { status: "ready"; budget: PlanBudget };

export interface ExpenseDraft {
  title: string;
  amount: string;
  payerUserId: string;
  shareUserIds: string[];
}

export function emptyExpenseDraft(payerUserId: string): ExpenseDraft {
  return { title: "", amount: "", payerUserId, shareUserIds: [] };
}

export function expenseDraftErrors(draft: ExpenseDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim() === "") errors.push("Укажите, за что платили");
  const amount = draft.amount.trim() === "" ? null : Number(draft.amount);
  if (amount === null || !Number.isInteger(amount) || amount < 1) errors.push("Сумма — целое число от 1 ₽");
  if (draft.shareUserIds.length === 0) errors.push("Выберите, на кого делится расход");
  return errors;
}

/** Resolve a budget party member to a display name; «Ты» only for the viewer id (the host is not in plan.participants), an unknown id reads as «Участник» — a non-host viewer must not see the host as «Ты». */
export function expenseNameOf(members: Friend[], userId: string, ownId: string | null): string {
  if (ownId !== null && userId === ownId) return "Ты";
  return members.find((member) => member.id === userId)?.name ?? "Участник";
}

interface BudgetViewProps {
  budget: PlanBudget;
  members: Friend[];
  ownId: string | null;
  draft: ExpenseDraft;
  saving: boolean;
  failed: boolean;
  showErrors: boolean;
  onDraftChange: (draft: ExpenseDraft) => void;
  onSubmit: () => void;
}

export function BudgetView({ budget, members, ownId, draft, saving, failed, showErrors, onDraftChange, onSubmit }: BudgetViewProps) {
  const errors = expenseDraftErrors(draft);
  const toggleShare = (userId: string) => onDraftChange({ ...draft, shareUserIds: draft.shareUserIds.includes(userId) ? draft.shareUserIds.filter((item) => item !== userId) : [...draft.shareUserIds, userId] });
  return (
    <section className="app-plan" aria-label="Бюджет плана">
      <p className="app-card-title">Бюджет</p>
      {budget.expenses.length === 0 && <AppState>Пока нет расходов.</AppState>}
      <ul className="app-plan-participants" aria-label="Расходы">
        {budget.expenses.map((expense) => (
          <li key={expense.id} className="app-plan-participant">
            <span className="app-plan-friend-name">
              {expense.title} — {expense.amountRub} ₽
            </span>
            <span className="app-card-subtitle">
              оплатил {expenseNameOf(members, expense.payerUserId, ownId)}, делится на {expense.shareUserIds.length}
            </span>
          </li>
        ))}
      </ul>
      {budget.expenses.length > 0 && (
        <>
          <p className="app-card-subtitle">Итого {budget.totalRub} ₽</p>
          <ul className="app-plan-participants" aria-label="По людям">
            {budget.perPerson.map((person) => (
              <li key={person.userId} className="app-plan-participant">
                <span className="app-plan-friend-name">{expenseNameOf(members, person.userId, ownId)}</span>
                <span className="app-card-subtitle">
                  доля {person.shareRub} ₽ · оплачено {person.paidRub} ₽
                </span>
              </li>
            ))}
          </ul>
          {budget.debts.length > 0 && (
            <ul className="app-plan-participants" aria-label="Кто кому должен">
              {budget.debts.map((debt) => (
                <li key={`${debt.fromUserId}-${debt.toUserId}`} className="app-plan-participant">
                  {expenseNameOf(members, debt.fromUserId, ownId)} → {expenseNameOf(members, debt.toUserId, ownId)} {debt.amountRub} ₽
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <form
        className="app-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input className="app-profile-input" type="text" aria-label="За что" placeholder="За что платили" value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
        <input className="app-profile-input" type="number" min={1} step={1} aria-label="Сумма" placeholder="Сумма, ₽" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} />
        <select className="app-profile-input" aria-label="Кто оплатил" value={draft.payerUserId} onChange={(event) => onDraftChange({ ...draft, payerUserId: event.target.value })}>
          {budget.perPerson.map((person) => (
            <option key={person.userId} value={person.userId}>
              {expenseNameOf(members, person.userId, ownId)}
            </option>
          ))}
        </select>
        <ul className="app-plan-participants" aria-label="Делится на">
          {budget.perPerson.map((person) => (
            <li key={person.userId} className="app-plan-participant">
              <label>
                <input type="checkbox" checked={draft.shareUserIds.includes(person.userId)} onChange={() => toggleShare(person.userId)} /> {expenseNameOf(members, person.userId, ownId)}
              </label>
            </li>
          ))}
        </ul>
        {showErrors &&
          errors.map((error) => (
            <p key={error} className="app-state app-state--error">
              {error}
            </p>
          ))}
        {failed && <AppState error>Не удалось сохранить расход.</AppState>}
        <AppButton stretched tone="secondary" disabled={saving} type="submit">
          Добавить расход
        </AppButton>
      </form>
    </section>
  );
}

export function BudgetSection({ planId, members }: { planId: string; members: Friend[] }) {
  const auth = useAuth();
  const ownId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<BudgetState>({ status: "loading" });
  const [draft, setDraft] = useState<ExpenseDraft>(() => emptyExpenseDraft(""));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getPlanBudget(planId).then(
      (budget) => {
        if (!alive) return;
        setState({ status: "ready", budget });
        setDraft((current) => (current.payerUserId === "" && budget.perPerson.length > 0 ? { ...current, payerUserId: budget.perPerson[0].userId } : current));
      },
      (error) => {
        if (!alive) return;
        setState(error instanceof ApiError && (error.status === 403 || error.status === 404) ? { status: "hidden" } : { status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [planId]);

  const submit = () => {
    if (state.status !== "ready") return;
    if (expenseDraftErrors(draft).length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setFailed(false);
    apiClient.addPlanExpense(planId, { title: draft.title.trim(), amountRub: Number(draft.amount), payerUserId: draft.payerUserId, shareUserIds: draft.shareUserIds }).then(
      (budget) => {
        setState({ status: "ready", budget });
        setDraft(emptyExpenseDraft(draft.payerUserId));
        setSaving(false);
        setShowErrors(false);
      },
      () => {
        setSaving(false);
        setFailed(true);
      },
    );
  };

  if (state.status === "hidden") return null;
  if (state.status === "loading") return <AppState>Загружаем бюджет…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить бюджет.</AppState>;
  return <BudgetView budget={state.budget} members={members} ownId={ownId} draft={draft} saving={saving} failed={failed} showErrors={showErrors} onDraftChange={setDraft} onSubmit={submit} />;
}
