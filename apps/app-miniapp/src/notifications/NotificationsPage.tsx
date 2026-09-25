// START_MODULE_CONTRACT
// PURPOSE: Экран 07 «Умные уведомления»: the decisions waiting for the viewer as cards, the rest of the inbox as history rows, and the quiet-hours switch under them.
// SCOPE: Data via apiClient.listNotifications / markAllNotificationsRead / markNotificationRead / answerNotification and the quiet-hours pair of apiClient.getAppSettings / updateAppSettings (экран 41 owns those two fields, so the switch here writes the same setting instead of a second copy of it). Navigation targets are mapped in ./format.ts; the whole notifications domain is mock-backed (#494).
// DEPENDS: ../api/client.js, ../auth/AuthContext.js, ../friends/avatar.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css, ./format.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NotificationsState - union of the inbox fetch states (loading / error / ready)
// - NotificationsQuietHours - what the switch at the foot of the screen shows: whether quiet hours are on and the window they cover
// - NotificationsView - presentational экран 07: own topbar, «Требует решения» cards, «Раньше» rows, quiet-hours switch
// - NotificationsPage - route container: loads the inbox, reads it on open, wires the actions, the row navigation and the quiet-hours write
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type AppNotification, type NotificationAction } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PersonAvatar } from "../friends/avatar";
import { useRoute, type Route } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";
import { groupNotifications, notificationActorLabel, notificationAgo, notificationCountdown, notificationGlyph, notificationIsChoice, notificationRoute, notificationShortAgo } from "./format";

export type NotificationsState = { status: "loading" } | { status: "error" } | { status: "ready"; notifications: AppNotification[] };

/** The «Тихие часы 23:00–09:00» row; null while the settings of экран 41 have not arrived (or refused to). */
export interface NotificationsQuietHours {
  enabled: boolean;
  from: string;
  to: string;
}

function ActionPill({ action, countdown, disabled, onPress }: { action: NotificationAction; countdown: string | null; disabled: boolean; onPress: () => void }) {
  return (
    <button type="button" className={`app-notify-act app-notify-act--${action.tone}`} disabled={disabled} onClick={onPress}>
      {countdown === null ? action.label : `${action.label} · ${countdown}`}
    </button>
  );
}

/**
 * A decision card (макет, экран 07). Two answers make it a fork: only that card is washed in
 * brand-cyan and only it repeats its type glyph in the headline — see notificationIsChoice.
 */
function DecisionCard({ notification, now, busy, onAct }: { notification: AppNotification; now: Date; busy: boolean; onAct: (action: NotificationAction) => void }) {
  const choice = notificationIsChoice(notification);
  const countdown = notificationCountdown(notification.deadlineAt, now);

  return (
    <article className={choice ? "app-notify-card app-notify-card--choice" : "app-notify-card"}>
      <div className="app-notify-card-head">
        <h3 className="app-notify-card-title">
          {choice && (
            <span className="app-notify-card-glyph" aria-hidden="true">
              <ActionIcon name={notificationGlyph(notification.type)} size={18} strokeWidth={2} />
            </span>
          )}
          {notification.title}
        </h3>
        <time className="app-notify-card-time" dateTime={notification.createdAt}>
          {notificationAgo(notification.createdAt, now)}
        </time>
      </div>
      <p className="app-notify-card-body">{notification.body}</p>
      <div className="app-notify-card-actions">
        {notification.actions.map((action, index) => (
          // Счётчик висит на первом действии: он про само предложение («Занять слот · 14:18»), а не про кнопку.
          <ActionPill key={action.id} action={action} countdown={index === 0 ? countdown : null} disabled={busy} onPress={() => onAct(action)} />
        ))}
      </div>
    </article>
  );
}

function HistoryLine({ notification }: { notification: AppNotification }) {
  return (
    <>
      {notification.actor !== null && <b className="app-notify-row-actor">{notificationActorLabel(notification.actor.name)} </b>}
      {notification.title}
      {notification.quote !== null && <span className="app-notify-row-quote"> {notification.quote}</span>}
      {notification.body !== "" && <span className="app-notify-row-body">{notification.body}</span>}
    </>
  );
}

/** A history row: the face of whoever caused it, or the glyph of what did; the design gives it one line and a short stamp. */
function HistoryRow({ notification, now, onOpen }: { notification: AppNotification; now: Date; onOpen: (route: Route) => void }) {
  const route = notificationRoute(notification.link);
  const face =
    notification.actor !== null ? (
      <PersonAvatar id={notification.actor.id} name={notification.actor.name} size={40} />
    ) : (
      <span className="app-notify-row-glyph" aria-hidden="true">
        <ActionIcon name={notificationGlyph(notification.type)} size={20} strokeWidth={2} />
      </span>
    );
  const body = (
    <>
      {face}
      <span className="app-notify-row-text">
        <HistoryLine notification={notification} />
      </span>
      <time className="app-notify-row-time" dateTime={notification.createdAt}>
        {notificationShortAgo(notification.createdAt, now)}
      </time>
    </>
  );

  // Строка без цели никуда не ведёт и кнопкой не притворяется: мёртвая кнопка читается как поломка.
  if (route === null) return <li className="app-notify-row">{body}</li>;
  return (
    <li>
      <button type="button" className="app-notify-row app-notify-row--link" onClick={() => onOpen(route)}>
        {body}
      </button>
    </li>
  );
}

interface NotificationsViewProps {
  state: NotificationsState;
  quietHours: NotificationsQuietHours | null;
  now?: Date;
  busy?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAct: (notification: AppNotification, action: NotificationAction) => void;
  onOpen: (notification: AppNotification, route: Route) => void;
  onToggleQuietHours: () => void;
}

export function NotificationsView({ state, quietHours, now = new Date(), busy = false, onClose, onRetry, onAct, onOpen, onToggleQuietHours }: NotificationsViewProps) {
  const groups = state.status === "ready" ? groupNotifications(state.notifications, now) : null;
  const empty = groups !== null && groups.pending.length === 0 && groups.earlier.length === 0;

  return (
    <section className="app-notify">
      <header className="app-notify-top">
        <span className="app-notify-top-icon" aria-hidden="true">
          <ActionIcon name="bell" size={26} strokeWidth={2} />
        </span>
        <h1 className="app-notify-top-title">Умные уведомления</h1>
        <button type="button" className="app-notify-close" aria-label="Закрыть" onClick={onClose}>
          <ActionIcon name="close" size={16} strokeWidth={2.6} />
        </button>
      </header>
      <div className="app-notify-body">
        {state.status === "loading" && <AppSkeletonList rows={3} />}
        {state.status === "error" && (
          <AppState error action={{ label: "Повторить", onClick: onRetry }}>
            Не удалось загрузить уведомления.
          </AppState>
        )}
        {empty && <AppState>Новых уведомлений нет</AppState>}
        {groups !== null && groups.pending.length > 0 && (
          <h2 className="app-notify-section">
            <span className="app-notify-section-dot" aria-hidden="true" />
            Требует решения
          </h2>
        )}
        {groups?.pending.map((notification) => (
          <DecisionCard key={notification.id} notification={notification} now={now} busy={busy} onAct={(action) => onAct(notification, action)} />
        ))}
        {groups !== null && groups.earlier.length > 0 && <h2 className="app-notify-section app-notify-section--earlier">Раньше</h2>}
        {groups !== null && groups.earlier.length > 0 && (
          <ul className="app-notify-rows">
            {groups.earlier.map((notification) => (
              <HistoryRow key={notification.id} notification={notification} now={now} onOpen={(route) => onOpen(notification, route)} />
            ))}
          </ul>
        )}
        {quietHours !== null && (
          <div className="app-notify-quiet">
            <span className="app-notify-quiet-text">
              <span className="app-notify-quiet-title">
                Тихие часы {quietHours.from}–{quietHours.to}
              </span>
              <span className="app-notify-quiet-hint">Только срочное: брони и отмены</span>
            </span>
            <button type="button" role="switch" aria-checked={quietHours.enabled} aria-label="Тихие часы" className={quietHours.enabled ? "app-notify-switch app-notify-switch--on" : "app-notify-switch"} onClick={onToggleQuietHours}>
              <span className="app-notify-switch-knob" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function NotificationsPage() {
  const auth = useAuth();
  const viewerId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [state, setState] = useState<NotificationsState>({ status: "loading" });
  const [quietHours, setQuietHours] = useState<NotificationsQuietHours | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(() => {
    if (viewerId === null) return;
    setState({ status: "loading" });
    apiClient.listNotifications(viewerId).then(
      (notifications) => {
        // Часы экрана переставляются вместе с ответом: если читать пришедшие метки по времени
        // монтирования, «12 минут назад» округлится вниз до одиннадцати на разнице в доли секунды.
        setNow(new Date());
        setState({ status: "ready", notifications });
      },
      () => setState({ status: "error" }),
    );
  }, [viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Экран 07 не помечает записи по одной — непрочитанных на нём не видно вовсе, поэтому увидеть
  // список и значит прочитать его: счётчик у колокольчика гаснет ровно здесь.
  useEffect(() => {
    if (viewerId === null) return;
    void apiClient.markAllNotificationsRead(viewerId).catch(() => {});
  }, [viewerId]);

  useEffect(() => {
    if (viewerId === null) return;
    let alive = true;
    apiClient.getAppSettings(viewerId).then(
      (settings) => {
        if (alive) setQuietHours({ enabled: settings.quietHours, from: settings.quietHoursFrom, to: settings.quietHoursTo });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [viewerId]);

  // Один тик в секунду и только пока есть куда тикать: счётчик «14:18» на кнопке идёт вниз сам.
  const counting = state.status === "ready" && state.notifications.some((notification) => notification.deadlineAt !== null);
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const onAct = useCallback(
    (notification: AppNotification, action: NotificationAction) => {
      if (viewerId === null) return;
      setBusy(true);
      const answered = apiClient.answerNotification(notification.id, { userId: viewerId, actionId: action.id });
      const route = notificationRoute(action.link);
      if (route !== null) {
        void answered.catch(() => {});
        setBusy(false);
        navigate(route);
        return;
      }
      answered.then(
        () => {
          setBusy(false);
          load();
        },
        () => {
          setBusy(false);
          load();
        },
      );
    },
    [viewerId, navigate, load],
  );

  const onOpen = useCallback(
    (notification: AppNotification, route: Route) => {
      if (viewerId !== null) void apiClient.markNotificationRead(notification.id, viewerId).catch(() => {});
      navigate(route);
    },
    [viewerId, navigate],
  );

  const onToggleQuietHours = useCallback(() => {
    if (viewerId === null || quietHours === null) return;
    const next = !quietHours.enabled;
    setQuietHours({ ...quietHours, enabled: next });
    apiClient.updateAppSettings(viewerId, { quietHours: next }).then(
      (settings) => setQuietHours({ enabled: settings.quietHours, from: settings.quietHoursFrom, to: settings.quietHoursTo }),
      // Настройка не записалась — переключатель возвращается туда, где стоял, а не врёт про сохранение.
      () => setQuietHours({ ...quietHours, enabled: !next }),
    );
  }, [viewerId, quietHours]);

  return <NotificationsView state={state} quietHours={quietHours} now={now} busy={busy} onClose={back} onRetry={load} onAct={onAct} onOpen={onOpen} onToggleQuietHours={onToggleQuietHours} />;
}
