// START_MODULE_CONTRACT
// PURPOSE: The moderator contour: «Очередь» (макет, экран 46) with its two streams grouped by reported object, and «Разбор» (макет, экран 47) with the irreversible actions behind an explicit confirmation.
// SCOPE: ModerationQueueView / ModerationCaseView are presentational; ModerationPage loads GET /reports?status=open plus GET /moderation/targets and answers a 403 with the «не в списке модераторов» state of экран 48, because that is what the backend says to everyone outside MODERATOR_MAX_USER_IDS. A sanction leaves the row open so both sanctions stay reachable; only «Решить без действий» closes it.
// DEPENDS: react, @max-events/api-contracts (Report), ../api/client.js (ApiError, apiClient, ModerationTarget), ../catalog/format.js (pluralRu), ../routing/router.js, ./ModerationQueue.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ModerationState - queue fetch state union (loading / forbidden / error / ready)
// - ModerationQueueView - экран 46 presentational: the moderator badge, the two streams as the app-wide row of filter pills and one card per reported object
// - ModerationCaseView - экран 47 presentational: the object, its complaints, the confirmation card and the two irreversible actions
// - ModerationPage - container: loads the queue with its targets, opens one разбор, wires unpublish / ban / dismiss
// - ModerationEntry - profile tile that appears only for a viewer the backend lets into the queue
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Report } from "@max-events/api-contracts";
import { ApiError, apiClient, type ModerationTarget } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppChip, AppEmptyState, AppNavTiles, AppSkeletonList, AppState } from "../ui/primitives";
import { ACTION_DONE_LABELS, MODERATION_CONFIRM_COPY, MODERATION_IRREVERSIBLE_NOTE, MODERATION_STREAMS, REPORT_REASON_LABELS, REPORT_TARGET_LABELS, claimsTitle, formatClaimWhen, groupModerationQueue, moderationStreamCounts, type ModerationAction, type ModerationGroup, type ModerationStream } from "./ModerationQueue";

export type ModerationState = { status: "loading" } | { status: "forbidden" } | { status: "error" } | { status: "ready"; reports: Report[]; targets: ModerationTarget[] };

interface ModerationQueueViewProps {
  state: ModerationState;
  stream?: ModerationStream;
  onStream?: (stream: ModerationStream) => void;
  onOpen?: (group: ModerationGroup) => void;
}

export function ModerationQueueView({ state, stream = "complaints", onStream = () => {}, onOpen = () => {} }: ModerationQueueViewProps) {
  // «Не в списке модераторов» — состояние, а не ошибка: экран 48 уже знает эти слова.
  if (state.status === "forbidden") return <AppEmptyState kind="not-moderator" />;
  if (state.status === "error") return <AppState error>Не удалось загрузить очередь модерации.</AppState>;
  const counts = state.status === "ready" ? moderationStreamCounts(state.reports) : { complaints: 0, checks: 0 };
  const groups = state.status === "ready" ? groupModerationQueue(state.reports, state.targets, stream) : [];
  return (
    <section className="app-mod" aria-label="Модерация">
      <div className="app-mod-head">
        <h1 className="app-mod-title">Модерация</h1>
        <span className="app-mod-badge">
          <ActionIcon name="shield" size={13} strokeWidth={2.2} /> Только для модераторов
        </span>
      </div>
      {/* Тот же ряд пилюль, что и на вкладке «Планы»: переключение раздела списка в приложении выглядит одинаково */}
      <div className="app-tab-row" role="group" aria-label="Потоки очереди">
        {MODERATION_STREAMS.map((tab) => (
          <AppChip key={tab.id} pressed={stream === tab.id} onClick={() => onStream(tab.id)}>
            {tab.label} <span className="app-tab-count">{counts[tab.id]}</span>
          </AppChip>
        ))}
      </div>
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "ready" && groups.length === 0 && <AppState>{stream === "complaints" ? "Открытых жалоб нет." : "Выборочных проверок нет."}</AppState>}
      {groups.map((group) => (
        <button key={`${group.targetType}:${group.targetId}`} type="button" className="app-mod-card" onClick={() => onOpen(group)}>
          <span className="app-mod-card-chips">
            <span className="app-mod-chip">{REPORT_TARGET_LABELS[group.targetType]}</span>
            {stream === "complaints" ? (
              <span className="app-mod-chip app-mod-chip--count">
                {group.count} {group.count === 1 ? "жалоба" : group.count < 5 ? "жалобы" : "жалоб"}
              </span>
            ) : (
              <span className="app-mod-chip app-mod-chip--check">Выборочная проверка</span>
            )}
          </span>
          <span className="app-mod-card-title">{group.title}</span>
          <span className="app-mod-card-note">{group.note}</span>
        </button>
      ))}
    </section>
  );
}

interface ModerationCaseViewProps {
  group: ModerationGroup;
  confirm: "unpublish" | "ban" | null;
  busy: boolean;
  done: ModerationAction[];
  failed: boolean;
  onConfirm: (action: "unpublish" | "ban" | null) => void;
  onRun: (action: ModerationAction) => void;
  onOpenTarget: () => void;
  onBack: () => void;
}

export function ModerationCaseView({ group, confirm, busy, done, failed, onConfirm, onRun, onOpenTarget, onBack }: ModerationCaseViewProps) {
  const source = group.reports[0]?.source ?? "user";
  const claims = [...group.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const copy = confirm === null ? null : MODERATION_CONFIRM_COPY[confirm];
  return (
    <section className="app-mod" aria-label="Разбор жалобы">
      <div className="app-mod-topbar">
        <button type="button" className="app-mod-round" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.6} />
        </button>
        <h1 className="app-mod-topbar-title">
          {source === "spot_check" ? "Проверка" : "Жалоба"} · {REPORT_TARGET_LABELS[group.targetType].toLowerCase()}
        </h1>
      </div>
      <div className="app-mod-target">
        <span className="app-mod-target-media" aria-hidden="true" />
        <span className="app-mod-target-body">
          <span className="app-mod-target-title">{group.title}</span>
          {/* Ноль записей не пишем: строка про охват имеет смысл, только когда охват есть. */}
          <span className="app-mod-target-note">{[group.target?.organizerName == null ? null : `Автор: ${group.target.organizerName}`, group.target?.reachCount ? `${group.target.reachCount} ${pluralRu(group.target.reachCount, "запись", "записи", "записей")}` : null, group.target?.subtitle ?? null].filter((part) => part !== null).join(" · ")}</span>
        </span>
        {group.targetType === "event" || group.targetType === "place" ? (
          <button type="button" className="app-mod-target-open" onClick={onOpenTarget}>
            Открыть
          </button>
        ) : null}
      </div>
      <p className="app-mod-group-title">{claimsTitle(group.count, source)}</p>
      <div className="app-mod-claims">
        {claims.map((report) => (
          <span key={report.id} className="app-mod-claim">
            <span className="app-mod-claim-text">{REPORT_REASON_LABELS[report.reason]}</span>
            <span className="app-mod-claim-when">{formatClaimWhen(report.createdAt)}</span>
          </span>
        ))}
      </div>
      {done.length > 0 && <p className="app-mod-done">{done.map((action) => ACTION_DONE_LABELS[action]).join(" · ")}</p>}
      {copy !== null && confirm !== null && (
        <div className="app-mod-confirm">
          <span className="app-mod-confirm-title">{copy.question}</span>
          <span className="app-mod-confirm-text">{copy.consequence}</span>
          <div className="app-mod-confirm-actions">
            <AppButton tone="confirm" disabled={busy} onClick={() => onRun(confirm)}>
              {copy.verb}
            </AppButton>
            <AppButton tone="secondary" disabled={busy} onClick={() => onConfirm(null)}>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
      {/* Открытое подтверждение убирает только свою кнопку: остальные решения по жалобе остаются под ним, как в макете. */}
      <div className="app-mod-actions">
        {confirm !== "unpublish" && (
          <AppButton tone="danger" className="app-btn--wide" disabled={busy || done.includes("unpublish")} onClick={() => onConfirm("unpublish")}>
            {MODERATION_CONFIRM_COPY.unpublish.open}
          </AppButton>
        )}
        <AppButton tone="secondary" disabled={busy || done.includes("dismiss")} onClick={() => onRun("dismiss")}>
          Решить без действий
        </AppButton>
        {group.target?.organizerId != null && confirm !== "ban" && (
          <AppButton tone="danger" disabled={busy || done.includes("ban")} onClick={() => onConfirm("ban")}>
            {MODERATION_CONFIRM_COPY.ban.open}
          </AppButton>
        )}
      </div>
      {failed && <AppState error>Не удалось выполнить действие.</AppState>}
      <p className="app-mod-note">{MODERATION_IRREVERSIBLE_NOTE}</p>
    </section>
  );
}

export function ModerationPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<ModerationState>({ status: "loading" });
  const [stream, setStream] = useState<ModerationStream>("complaints");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"unpublish" | "ban" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, ModerationAction[]>>({});
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.listOpenReports(), apiClient.listModerationTargets().catch(() => [] as ModerationTarget[])]).then(
      ([reports, targets]) => {
        if (!alive) return;
        setState({ status: "ready", reports, targets });
      },
      (reason: unknown) => {
        // 403 is the backend saying "not a moderator", which is a state, not a failure.
        if (alive) setState({ status: reason instanceof ApiError && reason.status === 403 ? "forbidden" : "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [reloads]);

  const groups = state.status === "ready" ? groupModerationQueue(state.reports, state.targets, stream) : [];
  const open = groups.find((group) => `${group.targetType}:${group.targetId}` === openKey) ?? null;

  /**
   * A sanction leaves the rows open: unpublishing and banning are separate answers, and «Решить без
   * действий» is the moderator's own third button. Otherwise the first press would take the card away
   * and with it the chance to also ban the author behind it.
   */
  const run = useCallback((group: ModerationGroup, action: ModerationAction) => {
    const key = `${group.targetType}:${group.targetId}`;
    setBusy(true);
    setFailed(false);
    const request = action === "unpublish" ? apiClient.unpublishTarget({ targetType: group.targetType, targetId: group.targetId }) : action === "ban" ? apiClient.banOrganizer(group.target!.organizerId!) : Promise.all(group.reports.map((report) => apiClient.resolveReport(report.id)));
    request.then(
      () => {
        setBusy(false);
        setConfirm(null);
        setDone((current) => ({ ...current, [key]: [...(current[key] ?? []), action] }));
        if (action === "dismiss") {
          setOpenKey(null);
          setReloads((value) => value + 1);
        }
      },
      () => {
        setBusy(false);
        setConfirm(null);
        setFailed(true);
      },
    );
  }, []);

  if (open !== null) {
    const key = `${open.targetType}:${open.targetId}`;
    return (
      <ModerationCaseView
        group={open}
        confirm={confirm}
        busy={busy}
        done={done[key] ?? []}
        failed={failed}
        onConfirm={setConfirm}
        onRun={(action) => run(open, action)}
        onOpenTarget={() => navigate(open.targetType === "event" ? { name: "event", id: open.targetId } : { name: "place", id: open.targetId })}
        onBack={() => {
          setConfirm(null);
          setFailed(false);
          setOpenKey(null);
        }}
      />
    );
  }

  return (
    <ModerationQueueView
      state={state}
      stream={stream}
      onStream={(next) => {
        setStream(next);
        setOpenKey(null);
      }}
      onOpen={(group) => {
        setConfirm(null);
        setFailed(false);
        setOpenKey(`${group.targetType}:${group.targetId}`);
      }}
    />
  );
}

export function ModerationEntry() {
  const { navigate } = useRoute();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // The same probe as the screen: only a moderator gets a list instead of a 403, and only then a tile.
    apiClient.listOpenReports().then(
      (reports) => {
        if (alive) setOpen(moderationStreamCounts(reports).complaints + moderationStreamCounts(reports).checks);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  // Не модератор не видит точку входа вовсе: 403 оставляет open === null, и плитки просто нет.
  if (open === null) return null;
  return <AppNavTiles items={[{ icon: "shield", label: open === 0 ? "Модерация" : `Модерация · ${open}`, onClick: () => navigate({ name: "moderation" }) }]} />;
}
