// START_MODULE_CONTRACT
// PURPOSE: Organizer setup (макет, экран 44): three steps to the first event — Площадка → Реквизиты → Событие — on the same step rail the user onboarding carries.
// SCOPE: The screen, its draft state and the writes through apiClient.updateOrganizerSetup/completeOrganizerSetup; the step order, the chips and the labels live in ./organizer-onboarding.ts, the finger comes from ../ui/gestures.js. The gate that mounts this screen is in ./OrganizerSpace.tsx.
// DEPENDS: react, ./organizer-onboarding.js, ../api/client.js (apiClient.getOrganizerSetup/updateOrganizerSetup/completeOrganizerSetup), ../ui/gestures.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - organizerPayoutBlock - why the «Реквизиты» step does not let the organizer forward yet, worded for a human; null when it does
// - OrganizerSetupViewProps - everything the presentational screen needs: the draft, the current step, load/save status, the refused-forward wording and one handler per action
// - OrganizerSetupView - the presentational three steps under one horizontal swipe, the rail outliving them while the step body is keyed and slides in
// - OrganizerSetup - container: the setup fetch, the per-step write, the completion stamp and the two exits (создание события or дашборд)
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import type { OrganizerActivity, OrganizerSetup as OrganizerSetupState, OrganizerSetupStep } from "../api/client";
import { apiClient } from "../api/client";
import { useSwipeDrag } from "../ui/gestures";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { ORGANIZER_ACTIVITY_OPTIONS, ORGANIZER_NEXT_UP, ORGANIZER_SETUP_RAIL, nextOrganizerSetupStep, organizerSetupCtaLabel, organizerSetupRailIndex, organizerVenueInitials, previousOrganizerSetupStep } from "./organizer-onboarding";

const ORGANIZER_SETUP_LEAN_PX = 40;

/**
 * Отказ шага «Реквизиты» словами: кнопку на незаполненном шаге можно запереть, а жест — нечем, и
 * молча проглоченный свайп читается как поломка. Ссылка обязательна ровно там же, где её требует
 * контракт события: платное событие без `paymentUrl` сервер не примет.
 */
export function organizerPayoutBlock(mode: string, paymentUrl: string): string | null {
  if (mode !== "external") return null;
  if (paymentUrl.trim() === "") return "Добавьте ссылку на оплату — без неё платное событие не опубликуется";
  try {
    new URL(paymentUrl.trim());
    return null;
  } catch {
    return "Ссылка должна начинаться с https:// — по ней покупатель уйдёт платить";
  }
}

export interface OrganizerSetupViewProps {
  setup: OrganizerSetupState;
  step: OrganizerSetupStep;
  status: "loading" | "error" | "ready";
  saveFailed: boolean;
  /** Почему шаг не выпустил вперёд, или null. */
  blocked: string | null;
  onToggleActivity: (activity: OrganizerActivity) => void;
  onPayoutMode: (mode: "external" | "none") => void;
  onPaymentUrl: (value: string) => void;
  onContacts: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onCreateEvent: () => void;
  onDashboard: () => void;
}

function SetupRail({ step, onBack }: { step: OrganizerSetupStep; onBack: () => void }) {
  const index = organizerSetupRailIndex(step);
  return (
    <div className="app-onboarding-nav">
      {/* Назад по шагам даёт смахивание вправо — и ровно то же обязано быть доступно тапом */}
      <button type="button" className="app-onboarding-back" aria-label="Назад" onClick={onBack}>
        <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
        Назад
      </button>
      <ol className={`app-onboarding-rail app-onboarding-rail--${index}`} aria-label="Шаги настройки">
        {ORGANIZER_SETUP_RAIL.map((item, position) => (
          <li key={item.step} className={position <= index ? "app-onboarding-rail-step app-onboarding-rail-step--on" : "app-onboarding-rail-step"} aria-current={position === index ? "step" : undefined}>
            <span className="app-onboarding-rail-dot" aria-hidden="true" />
            <span className="app-onboarding-rail-label">{item.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VenueStep({ setup, onToggleActivity }: Pick<OrganizerSetupViewProps, "setup" | "onToggleActivity">) {
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Ваша площадка</h1>
        <p className="app-onboarding-lead">Это увидят в карточке каждого события. Заполнить можно за минуту.</p>
      </header>
      <div className="app-onboarding-body">
        <div className="app-org-setup-venue">
          {/* Place.logoUrl exists; file upload waits on object storage (#477), so the tile still draws initials. */}
          <span className="app-org-setup-logo" aria-hidden="true">
            {organizerVenueInitials(setup.venue.title)}
          </span>
          <div className="app-org-setup-venue-text">
            <span className="app-org-setup-venue-name">{setup.venue.title}</span>
            <span className="app-org-setup-venue-meta">
              {setup.venue.address} · {setup.venue.city}
            </span>
            <span className="app-org-setup-logo-row">
              <button type="button" className="app-org-setup-logo-btn" disabled>
                Заменить логотип
              </button>
              <span className="app-org-setup-logo-note">Пока рисуем инициалы: загрузка файла ещё не подключена</span>
            </span>
          </div>
        </div>
        <p className="app-org-setup-group">Чем занимаетесь</p>
        <div className="app-org-setup-chips" role="group" aria-label="Чем занимаетесь">
          {ORGANIZER_ACTIVITY_OPTIONS.map((option) => {
            const on = setup.activities.includes(option.activity);
            return (
              <button key={option.activity} type="button" aria-pressed={on} className={on ? "app-org-setup-chip app-org-setup-chip--on" : "app-org-setup-chip"} onClick={() => onToggleActivity(option.activity)}>
                {on && <ActionIcon name="check" size={16} strokeWidth={3} />}
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="app-org-setup-group">Дальше понадобится</p>
        <ul className="app-org-setup-next">
          {ORGANIZER_NEXT_UP.map((item) => (
            <li key={item.text} className="app-org-setup-next-row">
              <ActionIcon name={item.icon} size={20} />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function PayoutsStep({ setup, onPayoutMode, onPaymentUrl, onContacts }: Pick<OrganizerSetupViewProps, "setup" | "onPayoutMode" | "onPaymentUrl" | "onContacts">) {
  const external = setup.payouts.mode === "external";
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Как берёте оплату</h1>
        <p className="app-onboarding-lead">Афиша не проводит платежи и не хранит банковских реквизитов. Билеты продаются у вас — событие ведёт на вашу страницу оплаты.</p>
      </header>
      <div className="app-onboarding-body">
        <div className="app-org-setup-modes" role="group" aria-label="Приём оплаты">
          <button type="button" aria-pressed={external} className={external ? "app-org-setup-mode app-org-setup-mode--on" : "app-org-setup-mode"} onClick={() => onPayoutMode("external")}>
            <span className="app-org-setup-mode-name">Платные события</span>
            <span className="app-org-setup-mode-hint">Кнопка в карточке уводит на вашу оплату</span>
          </button>
          <button type="button" aria-pressed={!external} className={external ? "app-org-setup-mode" : "app-org-setup-mode app-org-setup-mode--on"} onClick={() => onPayoutMode("none")}>
            <span className="app-org-setup-mode-name">Пока только бесплатные</span>
            <span className="app-org-setup-mode-hint">Запись без оплаты — ссылку добавите позже</span>
          </button>
        </div>
        {external && (
          <label className="app-org-setup-field">
            <span className="app-org-setup-group">Ссылка на оплату</span>
            <input className="app-profile-input" type="url" inputMode="url" placeholder="https://" autoComplete="off" value={setup.payouts.paymentUrl ?? ""} onChange={(change) => onPaymentUrl(change.target.value)} />
            <span className="app-org-setup-field-hint">Её увидит покупатель в карточке платного события</span>
          </label>
        )}
        <label className="app-org-setup-field">
          <span className="app-org-setup-group">Контакт для покупателя</span>
          <input className="app-profile-input" type="text" placeholder="Почта или телефон" autoComplete="off" value={setup.payouts.contacts ?? ""} onChange={(change) => onContacts(change.target.value)} />
          <span className="app-org-setup-field-hint">Сохраняется в карточке организации — по нему напишут о возврате</span>
        </label>
        {/* Прямая речь вместо выдуманной формы: платёжных полей в продукте нет ни одного */}
        <p className="app-org-setup-notice">
          <ActionIcon name="alert" size={20} />
          <span>ИНН, расчётного счёта и получателя платежа Афиша не спрашивает: приём оплаты внутри приложения ещё не подключён. Появится — попросим реквизиты отдельно.</span>
        </p>
      </div>
    </>
  );
}

function EventStep({ setup, onCreateEvent, onDashboard }: Pick<OrganizerSetupViewProps, "setup" | "onCreateEvent" | "onDashboard">) {
  const paid = setup.payouts.mode === "external";
  const activities = ORGANIZER_ACTIVITY_OPTIONS.filter((option) => setup.activities.includes(option.activity)).map((option) => option.label);
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Первое событие</h1>
        <p className="app-onboarding-lead">Черновик сохранится — опубликуете, когда будете готовы. Чек-ин на входе включится сам.</p>
      </header>
      <div className="app-onboarding-body">
        <dl className="app-org-setup-summary">
          <div className="app-org-setup-summary-row">
            <dt>Площадка</dt>
            <dd>{setup.venue.title}</dd>
          </div>
          <div className="app-org-setup-summary-row">
            <dt>Занимаетесь</dt>
            <dd>{activities.length === 0 ? "Не выбрано" : activities.join(", ")}</dd>
          </div>
          <div className="app-org-setup-summary-row">
            <dt>Оплата</dt>
            <dd>{paid ? "По вашей ссылке" : "Пока без оплаты"}</dd>
          </div>
        </dl>
      </div>
      <div className="app-onboarding-footer app-onboarding-footer--divided">
        <AppButton stretched onClick={onCreateEvent}>
          Создать событие
        </AppButton>
        <AppButton stretched onClick={onDashboard}>
          Позже · в дашборд
        </AppButton>
      </div>
    </>
  );
}

export function OrganizerSetupView(props: OrganizerSetupViewProps) {
  // Жест один на всю настройку, как в онбординге пользователя: влево — вперёд, вправо — назад.
  const drag = useSwipeDrag({ axis: "x", dampPx: ORGANIZER_SETUP_LEAN_PX, onSwipe: (direction) => (direction === "right" ? props.onBack() : props.onNext()) });
  if (props.status === "loading") return <AppState>Загрузка…</AppState>;
  if (props.status === "error") return <AppState error>Не удалось загрузить настройку площадки.</AppState>;
  const last = nextOrganizerSetupStep(props.step) === null;

  const body: ReactNode = props.step === "venue" ? <VenueStep setup={props.setup} onToggleActivity={props.onToggleActivity} /> : props.step === "payouts" ? <PayoutsStep setup={props.setup} onPayoutMode={props.onPayoutMode} onPaymentUrl={props.onPaymentUrl} onContacts={props.onContacts} /> : <EventStep setup={props.setup} onCreateEvent={props.onCreateEvent} onDashboard={props.onDashboard} />;

  return (
    <div className={drag.settling ? "app-onboarding-slide app-onboarding-slide--settling" : "app-onboarding-slide"} {...drag.gesture} style={{ ...drag.gesture.style, transform: drag.offset === 0 ? undefined : `translateX(${drag.offset}px)` }}>
      <section className="app-onboarding">
        <SetupRail step={props.step} onBack={props.onBack} />
        <div key={props.step} className="app-onboarding-step">
          {body}
          {/* Последний шаг несёт собственные две кнопки — общий подвал был бы третьей */}
          {!last && (
            <div className="app-onboarding-footer app-onboarding-footer--divided">
              {props.saveFailed && <p className="app-onboarding-error">Не удалось сохранить шаг. Попробуйте ещё раз.</p>}
              {props.blocked !== null && (
                <p className="app-onboarding-nudge" role="status">
                  {props.blocked}
                </p>
              )}
              <AppButton className="app-org-setup-cta" stretched onClick={props.onNext}>
                {organizerSetupCtaLabel(props.step)}
              </AppButton>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function OrganizerSetup({ onCreateEvent, onDashboard }: { onCreateEvent: () => void; onDashboard: () => void }) {
  const [loaded, setLoaded] = useState<OrganizerSetupState | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSetup().then(
      (setup) => {
        if (alive) setLoaded(setup);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Черновик правится локально, а на сервер уезжает на переходе шага: иначе каждая буква в поле
  // ссылки была бы отдельным запросом, а половина набранного URL — отказом валидации.
  function patch(change: Partial<OrganizerSetupState>): void {
    setBlocked(null);
    setLoaded((current) => (current === null ? current : { ...current, ...change }));
  }

  function finish(exit: () => void): void {
    setSaveFailed(false);
    apiClient.completeOrganizerSetup().then(exit, () => {
      // Настройка — не ворота: сорванная отметка не повод запереть организатора на этом экране.
      setSaveFailed(true);
      exit();
    });
  }

  function onNext(): void {
    if (loaded === null) return;
    if (loaded.step === "payouts") {
      const block = organizerPayoutBlock(loaded.payouts.mode, loaded.payouts.paymentUrl ?? "");
      if (block !== null) {
        setBlocked(block);
        return;
      }
    }
    const next = nextOrganizerSetupStep(loaded.step);
    if (next === null) return;
    setBlocked(null);
    setSaveFailed(false);
    const draft = { ...loaded, step: next };
    apiClient.updateOrganizerSetup({ step: next, venue: draft.venue, activities: draft.activities, payouts: draft.payouts }).then(setLoaded, () => {
      // Шаг всё равно листается: настройка ведёт к первому событию, а не стережёт его.
      setSaveFailed(true);
      setLoaded(draft);
    });
  }

  function onBack(): void {
    if (loaded === null) return;
    const previous = previousOrganizerSetupStep(loaded.step);
    setBlocked(null);
    if (previous !== null) setLoaded({ ...loaded, step: previous });
  }

  const setup = loaded ?? EMPTY_SETUP;
  return <OrganizerSetupView setup={setup} step={setup.step} status={failed ? "error" : loaded === null ? "loading" : "ready"} saveFailed={saveFailed} blocked={blocked} onToggleActivity={(activity) => patch({ activities: setup.activities.includes(activity) ? setup.activities.filter((item) => item !== activity) : [...setup.activities, activity] })} onPayoutMode={(mode) => patch({ payouts: { ...setup.payouts, mode, paymentUrl: mode === "none" ? null : setup.payouts.paymentUrl } })} onPaymentUrl={(value) => patch({ payouts: { ...setup.payouts, paymentUrl: value } })} onContacts={(value) => patch({ payouts: { ...setup.payouts, contacts: value === "" ? null : value } })} onNext={onNext} onBack={onBack} onCreateEvent={() => finish(onCreateEvent)} onDashboard={() => finish(onDashboard)} />;
}

/** Пока настройка не загрузилась, экран рисует состояние загрузки — но props должны быть полными. */
const EMPTY_SETUP: OrganizerSetupState = { organizationId: "", step: "venue", completedAt: null, venue: { placeId: null, title: "", address: "", city: "" }, activities: [], payouts: { mode: "none", paymentUrl: null, contacts: null } };
