// START_MODULE_CONTRACT
// PURPOSE: Экран 15 «План на вечер»: шапка с днём и размером компании, таймлайн точек с переездами, расходы и сумма на человека, компания с приглашением, чипы уточнений и низ с чатом плана, отправкой в MAX и записью в календарь.
// SCOPE: Данные через apiClient.getPlan / getPlanTimeline / getPlanBudget; приглашение — apiClient.addPlanParticipant и listFriends (реальные эндпоинты бэкенда), «В календарь» — apiClient.createBooking, «Отправить в чат MAX» — shareResult из ../max/bridge.js, чат плана — apiClient.createPlanChat (мок до P1-7-b). Полный редактор расходов и долгов (#218) остаётся за раскрывающимся блоком «Расходы и долги».
// DEPENDS: ../api/client.js (apiClient, ApiError, PlanTimeline), ../auth/AuthContext.js, @max-events/api-contracts (Friend, PlanBudget, PlanCancelScope, PlanCard, PlanParticipantStatus), ./BudgetSection.js, ./PlanCreatePage.js (planRepeatLabel), ./PlanTimeline.js, ../max/bridge.js (openChatLink, shareResult, webApp), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLAN_STATUS_LABELS - ru labels for participant statuses (invited/confirmed/declined)
// - PlanState - union of plan fetch states (loading / error / ready)
// - PlanTimelineState - union of the timeline fetch states (loading / error / absent when the backend has no such endpoint / ready)
// - PlanBudgetState - union of the money-block fetch states (loading / hidden / ready)
// - planShareText - текст, который уходит в чат MAX: событие, сбор и точки вечера
// - planChatLabel - подпись главной кнопки: чат плана уже есть — или его ещё надо создать
// - PlanFaces - стопка инициалов компании; имена живут в подписи, поэтому стопка — одна картинка
// - PlanView - презентационно: шапка, таймлайн, деньги, компания, чипы и низ экрана
// - PlanPage - контейнер маршрута plan: грузит план, таймлайн и бюджет, ведёт приглашение, чат, отправку и отмену
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend, PlanBudget, PlanCancelScope, PlanCard, PlanParticipantStatus } from "@max-events/api-contracts";
import { ApiError, apiClient, isEndpointMissing, type PlanTimeline } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { openChatLink, shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppSkeleton, AppState } from "../ui/primitives";
import { BudgetSection } from "./BudgetSection";
import { planRepeatLabel } from "./PlanCreatePage";
import { PLAN_TWEAKS, PlanMoneyBlock, PlanStepsList, planHeaderSubtitle, planStepTime } from "./PlanTimeline";

export const PLAN_STATUS_LABELS: Record<PlanParticipantStatus, string> = { invited: "ждёт ответа", confirmed: "идёт", declined: "не идёт" };

export type PlanState = { status: "loading" } | { status: "error" } | { status: "ready"; card: PlanCard };

export type PlanTimelineState = { status: "loading" } | { status: "error" } | { status: "absent" } | { status: "ready"; timeline: PlanTimeline };

/** 403 прячет блок денег целиком: бюджет — поверхность участников (backend canView), а не всех, кто открыл ссылку. */
export type PlanBudgetState = { status: "loading" } | { status: "hidden" } | { status: "ready"; budget: PlanBudget };

/** То, что уходит в чат MAX: без таймлайна — хотя бы событие и время сбора, иначе получатель читает пустую ссылку. */
export function planShareText(card: PlanCard, timeline: PlanTimeline | null): string {
  const head = `План на вечер: ${card.event.title}, сбор ${planStepTime(card.plan.meetingAt)} ${card.plan.meetingPoint}`;
  if (timeline === null || timeline.steps.length === 0) return head;
  return `${head}. ${timeline.steps.map((step) => `${planStepTime(step.at)} — ${step.title}`).join(", ")}`;
}

export function planChatLabel(card: PlanCard): string {
  return card.plan.chatLink === null ? "Собрать план и создать чат" : "Открыть чат плана";
}

export function PlanFaces({ participants }: { participants: Friend[] }) {
  return (
    <span className="app-plan-faces" role="img" aria-label={["Ты", ...participants.map((friend) => friend.name)].join(", ")}>
      <span className="app-plan-face">Я</span>
      {participants.map((friend, index) => (
        <span key={friend.id} className={index % 2 === 0 ? "app-plan-face app-plan-face--alt" : "app-plan-face app-plan-face--third"}>
          {friend.name.charAt(0)}
        </span>
      ))}
    </span>
  );
}

interface PlanViewProps {
  state: PlanState;
  timeline: PlanTimelineState;
  budget: PlanBudgetState;
  onBack?: () => void;
  onOpenEvent?: (eventId: string) => void;
  onAsk?: (ask: string) => void;
  onChat?: () => void;
  onShare?: () => void;
  onCalendar?: () => void;
  /** Строка под нижними кнопками: что ответили «В календарь» и отправка в чат. */
  notice?: string | null;
  /** Компания раскрыта: имена со статусами и список друзей, которых можно позвать. */
  editingParty?: boolean;
  onEditParty?: () => void;
  invitable?: Friend[];
  onInvite?: (userId: string) => void;
  /** The viewer: only the host may cancel, so nobody else is offered a button that answers 403. */
  viewerId?: string | null;
  /** Set once «Отменить» was pressed: the choice of scope is the second step, not a surprise. */
  cancelling?: boolean;
  cancelFailed?: boolean;
  onCancelStart?: () => void;
  onCancelDismiss?: () => void;
  onCancel?: (scope: PlanCancelScope) => void;
}

export function PlanView({ state, timeline, budget, onBack = () => {}, onOpenEvent = () => {}, onAsk = () => {}, onChat = () => {}, onShare = () => {}, onCalendar = () => {}, notice = null, editingParty = false, onEditParty = () => {}, invitable = [], onInvite = () => {}, viewerId = null, cancelling = false, cancelFailed = false, onCancelStart = () => {}, onCancelDismiss = () => {}, onCancel = () => {} }: PlanViewProps) {
  if (state.status === "loading")
    return (
      <div className="app-plan" aria-busy="true">
        <AppSkeleton variant="line-short" />
        <AppSkeleton />
        <AppSkeleton />
      </div>
    );
  if (state.status === "error") return <AppState error>Не удалось загрузить план.</AppState>;

  const { plan } = state.card;
  const repeat = planRepeatLabel(plan.recurringRule);
  const participants = plan.participants.map((row) => row.friend);
  return (
    <section className="app-plan">
      <header className="app-plan-top">
        <button type="button" className="app-plan-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={20} strokeWidth={2} />
        </button>
        <span className="app-plan-top-text">
          <span className="app-plan-top-line">
            <h1 className="app-plan-top-title">План на вечер</h1>
            {/* Бейдж — один на экран, и он занят: вечер собрал ассистент, а не пользователь.
                Стоит он у заголовка, а не у строки даты: у даты он отнял бы треть ширины и
                разломил «Суббота, 19 сентября · 4 человека» на две строки. */}
            {timeline.status === "ready" && timeline.timeline.assembledByMax && <span className="app-plan-badge">MAX СОБРАЛ</span>}
          </span>
          <span className="app-plan-top-sub">{planHeaderSubtitle(state.card)}</span>
        </span>
      </header>

      {timeline.status === "loading" && <AppState>Собираем вечер…</AppState>}
      {timeline.status === "error" && <AppState error>Не удалось загрузить таймлайн вечера.</AppState>}
      {timeline.status === "ready" && <PlanStepsList timeline={timeline.timeline} onOpenEvent={onOpenEvent} />}
      {repeat !== null && <p className="app-plan-repeat">Повторяется {repeat}</p>}

      {budget.status === "ready" && <PlanMoneyBlock budget={budget.budget} viewerId={viewerId} />}

      <div className="app-plan-party">
        <span className="app-plan-party-head">Компания</span>
        <div className="app-plan-party-row">
          <PlanFaces participants={participants} />
          <button type="button" className="app-plan-party-edit" onClick={onEditParty}>
            {editingParty ? "Готово" : "Изменить"}
          </button>
        </div>
        {editingParty && (
          <>
            <ul className="app-plan-participants">
              {plan.participants.map(({ friend, status }) => (
                <li key={friend.id} className="app-plan-participant">
                  <span className="app-plan-friend-name">{friend.name}</span>
                  <span className={`app-plan-friend-status app-plan-friend-status--${status}`}>{PLAN_STATUS_LABELS[status]}</span>
                </li>
              ))}
            </ul>
            {viewerId === plan.hostUserId &&
              (invitable.length === 0 ? (
                <p className="app-plan-repeat">Звать больше некого — все друзья уже в плане.</p>
              ) : (
                <ul className="app-plan-participants" aria-label="Кого позвать">
                  {invitable.map((friend) => (
                    <li key={friend.id} className="app-plan-participant">
                      <span className="app-plan-friend-name">{friend.name}</span>
                      <AppButton size="small" tone="secondary" onClick={() => onInvite(friend.id)}>
                        Позвать
                      </AppButton>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        )}
      </div>

      <div className="app-plan-tweaks" role="group" aria-label="Уточнить план">
        {PLAN_TWEAKS.map((tweak) => (
          <button key={tweak.label} type="button" className="app-plan-tweak" onClick={() => onAsk(tweak.ask)}>
            {tweak.label}
          </button>
        ))}
      </div>

      {budget.status === "ready" && (
        <details className="app-plan-expenses">
          <summary>Расходы и долги</summary>
          <BudgetSection planId={plan.id} members={participants} />
        </details>
      )}

      {viewerId === plan.hostUserId && cancelling ? (
        <div className="app-plan-cancel">
          {/* A repeating plan asks which one: cancelling every future meeting by accident cannot be undone. */}
          <AppButton tone="danger" stretched onClick={() => onCancel("occurrence")}>
            {plan.seriesId === null ? "Отменить план" : "Отменить эту встречу"}
          </AppButton>
          {plan.seriesId !== null && (
            <AppButton tone="danger" stretched onClick={() => onCancel("series")}>
              Отменить всю серию
            </AppButton>
          )}
          <AppButton tone="secondary" stretched onClick={onCancelDismiss}>
            Не отменять
          </AppButton>
        </div>
      ) : viewerId === plan.hostUserId ? (
        <AppButton tone="ghost" stretched onClick={onCancelStart}>
          Отменить план
        </AppButton>
      ) : null}
      {cancelFailed && <AppState error>Не удалось отменить план.</AppState>}

      <div className="app-plan-cta">
        <button type="button" className="app-plan-cta-main" onClick={onChat}>
          <ActionIcon name="spark" size={20} filled />
          {planChatLabel(state.card)}
        </button>
        <div className="app-plan-cta-row">
          <button type="button" className="app-plan-cta-side" onClick={onShare}>
            <ActionIcon name="comment" size={18} />
            Отправить в чат MAX
          </button>
          <button type="button" className="app-plan-cta-side" onClick={onCalendar}>
            <ActionIcon name="calendar" size={18} />В календарь
          </button>
        </div>
        {notice !== null && <p className="app-plan-notice">{notice}</p>}
      </div>
    </section>
  );
}

export function PlanPage({ id }: { id: string }) {
  const { navigate, back } = useRoute();
  const auth = useAuth();
  const viewerId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<PlanState>({ status: "loading" });
  const [timeline, setTimeline] = useState<PlanTimelineState>({ status: "loading" });
  const [budget, setBudget] = useState<PlanBudgetState>({ status: "loading" });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [editingParty, setEditingParty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    setTimeline({ status: "loading" });
    setBudget({ status: "loading" });
    apiClient.getPlan(id).then(
      (card) => {
        if (alive) setState({ status: "ready", card });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    apiClient.getPlanTimeline(id).then(
      (loaded) => {
        if (alive) setTimeline({ status: "ready", timeline: loaded });
      },
      // Пошагового вечера на бэкенде нет вовсе — тогда блока просто нет; «не удалось» остаётся за
      // запросом, который мог бы пройти.
      (error: unknown) => {
        if (alive) setTimeline({ status: isEndpointMissing(error) ? "absent" : "error" });
      },
    );
    apiClient.getPlanBudget(id).then(
      (loaded) => {
        if (alive) setBudget({ status: "ready", budget: loaded });
      },
      // 403 is the backend saying the viewer is not in the party; anything else hides the block too,
      // because a money block that failed to load reads worse than no money block at all.
      () => {
        if (alive) setBudget({ status: "hidden" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (loaded) => {
        if (alive) setFriends(loaded);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const card = state.status === "ready" ? state.card : null;
  const invited = new Set(card === null ? [] : card.plan.participants.map((row) => row.friend.id));
  const invitable = friends.filter((friend) => !invited.has(friend.id));

  const openChat = () => {
    if (card === null) return;
    if (card.plan.chatLink !== null) {
      openChatLink(card.plan.chatLink);
      return;
    }
    setNotice(null);
    apiClient.createPlanChat(card.plan.id).then(
      (updated) => {
        setState({ status: "ready", card: updated });
        if (updated.plan.chatLink !== null) openChatLink(updated.plan.chatLink);
      },
      () => setNotice("Не удалось создать чат плана."),
    );
  };

  const share = () => {
    if (card === null) return;
    void shareResult(webApp, planShareText(card, timeline.status === "ready" ? timeline.timeline : null)).then(
      (channel) => setNotice(channel === "clipboard" ? "План скопирован — вставь его в чат MAX." : "План отправлен в чат MAX."),
      () => setNotice("Не удалось отправить план в чат."),
    );
  };

  const addToCalendar = () => {
    if (card === null || viewerId === null) return;
    setNotice(null);
    apiClient.createBooking({ userId: viewerId, eventId: card.event.id }).then(
      () => setNotice("Событие плана в твоём календаре."),
      (error: unknown) => setNotice(error instanceof ApiError && error.status === 409 ? "Это событие уже в твоём календаре." : "Не удалось добавить в календарь."),
    );
  };

  const invite = (userId: string) => {
    if (card === null) return;
    setNotice(null);
    apiClient.addPlanParticipant(card.plan.id, userId).then(
      (updated) => setState({ status: "ready", card: updated }),
      () => setNotice("Не удалось позвать — попробуй ещё раз."),
    );
  };

  return (
    <PlanView
      state={state}
      timeline={timeline}
      budget={budget}
      onBack={back}
      onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })}
      onAsk={(ask) => navigate({ name: "assist", ask })}
      onChat={openChat}
      onShare={share}
      onCalendar={addToCalendar}
      notice={notice}
      editingParty={editingParty}
      onEditParty={() => setEditingParty((current) => !current)}
      invitable={invitable}
      onInvite={invite}
      viewerId={viewerId}
      cancelling={cancelling}
      cancelFailed={cancelFailed}
      onCancelStart={() => {
        setCancelFailed(false);
        setCancelling(true);
      }}
      onCancelDismiss={() => setCancelling(false)}
      onCancel={(scope) => {
        setCancelFailed(false);
        apiClient.cancelPlan(id, scope).then(
          () => navigate({ name: "plans" }),
          () => {
            setCancelling(false);
            setCancelFailed(true);
          },
        );
      }}
    />
  );
}
