// START_MODULE_CONTRACT
// PURPOSE: «Управление событием» (макет, экран 44): the counters of the day, the participants, the waitlist, the venue slots and the check-in by entry code.
// SCOPE: Pure helpers plus OrganizerEventManageView (presentational) and OrganizerEventManage (container over apiClient.getOrganizerAttendance / checkInOrganizerGuest / inviteFromOrganizerWaitlist). The freed-seats card is itself the confirmation: it asks the question out loud and only its dark-filled verb sends the invitation, which cannot be recalled.
// DEPENDS: react, ../api/client.js (apiClient, OrganizerAttendance, OrganizerEvent, OrganizerParticipant, OrganizerSlot, OrganizerWaitlistEntry), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ManageTab - participants | waitlist | chat, the three tabs of the screen
// - splitParticipants - the roster in the two groups the design names: «Отметились» and «Ждём»
// - fillPercent - booked against capacity, 0..100; 0 without a capacity, because an uncapped event has no fill
// - formatArrival - «на месте с 13:52» — neutral wording: the roster carries no gender
// - formatBookedAgo - «запись 2 дня назад», «запись сегодня»
// - formatSlot - «14:00–17:00 · занят»
// - participantInitial - the letter of the round avatar
// - guestsNote - «+1 гость» / «+2 гостя», empty string without companions
// - OrganizerEventManageView - presentational: hero, tabs, scan row, slots, the two groups and the freed-seats offer
// - OrganizerEventManage - container: loads the event day, checks a guest in by code, offers freed seats to the waitlist
// END_MODULE_MAP

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiClient, organizerEntryCode, type OrganizerAttendance, type OrganizerEvent, type OrganizerParticipant, type OrganizerSlot, type OrganizerWaitlistEntry } from "../api/client";
import { pluralRu } from "../catalog/format";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppSkeletonList, AppState } from "../ui/primitives";

export type ManageTab = "participants" | "waitlist" | "chat";

export function splitParticipants(participants: OrganizerParticipant[]): { arrived: OrganizerParticipant[]; expected: OrganizerParticipant[] } {
  return { arrived: participants.filter((row) => row.checkedInAt !== null), expected: participants.filter((row) => row.checkedInAt === null) };
}

/** An event without a capacity has no fill to show: the bar would claim a limit the organizer never set. */
export function fillPercent(booked: number, capacity: number | null): number {
  if (capacity === null || capacity <= 0) return 0;
  return Math.min(Math.round((booked / capacity) * 100), 100);
}

function hhmm(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Neutral by design: the roster knows a name, never a gender, and «пришла/пришёл» would have to guess. */
export function formatArrival(checkedInAt: string): string {
  return `на месте с ${hhmm(checkedInAt)}`;
}

export function formatBookedAgo(bookedAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(bookedAt).getTime()) / 86_400_000);
  if (days <= 0) return "запись сегодня";
  if (days === 1) return "запись вчера";
  if (days < 7) return `запись ${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  return `запись ${new Date(bookedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

export function formatSlot(slot: OrganizerSlot): string {
  return `${hhmm(slot.startsAt)}–${hhmm(slot.endsAt)} · ${slot.busy ? "занят" : "свободен"}`;
}

export function participantInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function guestsNote(guests: number): string {
  return guests === 0 ? "" : `+${guests} ${pluralRu(guests, "гость", "гостя", "гостей")}`;
}

function PersonRow({ name, note, action }: { name: string; note: string; action: ReactNode }) {
  return (
    <div className="app-org-person">
      <span className="app-org-person-avatar" aria-hidden="true">
        {participantInitial(name)}
      </span>
      <span className="app-org-person-body">
        <span className="app-org-person-name">{name}</span>
        {note !== "" && <span className="app-org-person-note">{note}</span>}
      </span>
      {action}
    </div>
  );
}

interface OrganizerEventManageViewProps {
  event: OrganizerEvent;
  attendance: OrganizerAttendance | null;
  tab: ManageTab;
  scanning: boolean;
  code: string;
  busy: boolean;
  notice: string | null;
  failed: string | null;
  onTab: (tab: ManageTab) => void;
  onScan: () => void;
  onCode: (code: string) => void;
  onSubmitCode: () => void;
  onCheckIn: (row: OrganizerParticipant) => void;
  onInvite: () => void;
  onRefresh: () => void;
  onBack: () => void;
  onPromo: () => void;
}

export function OrganizerEventManageView({ event, attendance, tab, scanning, code, busy, notice, failed, onTab, onScan, onCode, onSubmitCode, onCheckIn, onInvite, onRefresh, onBack, onPromo }: OrganizerEventManageViewProps) {
  const groups = splitParticipants(attendance?.participants ?? []);
  const waitlist: OrganizerWaitlistEntry[] = attendance?.waitlist ?? [];
  const when = `${new Date(event.startsAt).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · ${hhmm(event.startsAt)}`;
  return (
    <section className="app-org-screen" aria-label="Управление событием">
      <div className="app-org-day-hero">
        <span className="app-org-hero-blob" aria-hidden="true" />
        <div className="app-org-day-head">
          <button type="button" className="app-org-round app-org-round--on-media app-org-round--back" aria-label="Назад" onClick={onBack}>
            <ActionIcon name="chevron" size={18} strokeWidth={2.6} />
          </button>
          <span className="app-org-day-text">
            <span className="app-org-day-when">{when}</span>
            <span className="app-org-day-title">{event.title}</span>
          </span>
          <button type="button" className="app-org-round app-org-round--on-media" aria-label="Промо и отчёты" onClick={onPromo}>
            <ActionIcon name="trend" size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="app-org-hero-stats">
          <span className="app-org-hero-stat">
            <b>{attendance?.bookedCount ?? 0}</b>
            {event.capacity === null ? " записались" : `/${event.capacity} записались`}
          </span>
          <span className="app-org-hero-stat">
            <b>{attendance?.waitlistCount ?? 0}</b> в листе
          </span>
          <span className="app-org-hero-stat">
            <b>{attendance?.checkedInCount ?? 0}</b> отметились
          </span>
        </div>
        <span className="app-org-day-bar" aria-hidden="true">
          <span className="app-org-day-bar-fill" style={{ width: `${fillPercent(attendance?.bookedCount ?? 0, event.capacity)}%` }} />
        </span>
      </div>
      <div className="app-org-tabs" role="tablist" aria-label="Разделы события">
        {(
          [
            { id: "participants" as const, label: "Участники" },
            { id: "waitlist" as const, label: "Лист ожидания" },
            { id: "chat" as const, label: attendance?.chatMessages == null ? "Чат" : `Чат · ${attendance.chatMessages}` },
          ] satisfies Array<{ id: ManageTab; label: string }>
        ).map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "app-org-tab app-org-tab--on" : "app-org-tab"} onClick={() => onTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="app-org-day-body">
        {attendance === null && <AppSkeletonList rows={3} />}
        {attendance !== null && tab === "participants" && (
          <>
            <div className="app-org-scan-row">
              <AppButton stretched onClick={onScan}>
                <ActionIcon name="qr" size={18} strokeWidth={2.4} /> Сканировать код
              </AppButton>
              <button type="button" className="app-org-icon-btn" aria-label="Обновить список" onClick={onRefresh}>
                <ActionIcon name="undo" size={20} strokeWidth={2.2} />
              </button>
              <button type="button" className="app-org-icon-btn" aria-label="Лист ожидания" onClick={() => onTab("waitlist")}>
                <ActionIcon name="users" size={20} strokeWidth={2.2} />
              </button>
            </div>
            {scanning && (
              <form
                className="app-org-scan-form"
                onSubmit={(submit) => {
                  submit.preventDefault();
                  onSubmitCode();
                }}
              >
                {/* Камеры у мини-аппа нет: код с билета вводится или вставляется, проверка одна и та же. */}
                <input className="app-org-field-input" aria-label="Код входа" placeholder="Код с билета" value={code} onChange={(change) => onCode(change.target.value)} />
                <AppButton size="small" type="submit" disabled={busy || code.trim() === ""}>
                  Отметить
                </AppButton>
              </form>
            )}
            {notice !== null && <p className="app-org-notice">{notice}</p>}
            {failed !== null && <AppState error>{failed}</AppState>}
            <div className="app-org-slots-card">
              <div className="app-org-slots-head">
                <span className="app-org-slots-title">Слоты площадки</span>
                <span className="app-org-slots-note">С площадки события</span>
              </div>
              <div className="app-org-slots">
                {attendance.slots.map((item) => (
                  <span key={item.id} className={item.busy ? "app-org-slot" : "app-org-slot app-org-slot--free"}>
                    {formatSlot(item)}
                  </span>
                ))}
              </div>
            </div>
            <p className="app-org-group-title">Отметились · {groups.arrived.length}</p>
            {groups.arrived.length === 0 && <p className="app-org-empty">Пока никто не отметился.</p>}
            {groups.arrived.map((row) => (
              <PersonRow key={row.bookingId} name={row.name} note={[guestsNote(row.guests), formatArrival(row.checkedInAt!)].filter((part) => part !== "").join(" · ")} action={<span className="app-org-person-state">НА МЕСТЕ</span>} />
            ))}
            <p className="app-org-group-title">Ждём · {groups.expected.length}</p>
            {groups.expected.length === 0 && <p className="app-org-empty">Все, кто записался, уже на месте.</p>}
            {groups.expected.map((row) => (
              <PersonRow
                key={row.bookingId}
                name={row.name}
                note={[guestsNote(row.guests), formatBookedAgo(row.bookedAt)].filter((part) => part !== "").join(" · ")}
                action={
                  <button type="button" className="app-org-person-action" disabled={busy} onClick={() => onCheckIn(row)}>
                    Отметить
                  </button>
                }
              />
            ))}
            {attendance.freedSeats > 0 && waitlist.length > 0 && (
              /* Карточка сама и есть подтверждение: вопрос назван вслух, а делает дело только тёмная заливка. */
              <div className="app-org-offer">
                <span className="app-org-offer-title">
                  Освободилось {attendance.freedSeats} {pluralRu(attendance.freedSeats, "место", "места", "мест")}
                </span>
                <span className="app-org-offer-note">Позвать первых из листа ожидания?</span>
                <div className="app-org-offer-actions">
                  <AppButton tone="confirm" disabled={busy} onClick={onInvite}>
                    Позвать {Math.min(attendance.freedSeats, waitlist.length)}
                  </AppButton>
                  <AppButton tone="secondary" disabled={busy} onClick={onRefresh}>
                    Оставить
                  </AppButton>
                </div>
              </div>
            )}
          </>
        )}
        {attendance !== null && tab === "waitlist" && (
          <>
            <p className="app-org-group-title">В листе · {waitlist.length}</p>
            {waitlist.length === 0 && <p className="app-org-empty">Лист ожидания пуст.</p>}
            {waitlist.map((row) => (
              <PersonRow key={row.entryId} name={row.name} note={[guestsNote(row.guests), formatBookedAgo(row.joinedAt)].filter((part) => part !== "").join(" · ")} action={<span className="app-org-person-note">ждёт места</span>} />
            ))}
          </>
        )}
        {attendance !== null && tab === "chat" && (
          <AppState hint={event.chatLink === null ? "Чат появится, когда событие уйдёт в чаты MAX" : undefined} action={event.chatLink === null ? undefined : { label: "Открыть чат", onClick: () => window.open(event.chatLink!, "_blank", "noopener") }}>
            {event.chatLink === null ? "У события ещё нет чата" : `Чат события · ${attendance.chatMessages ?? 0} сообщений`}
          </AppState>
        )}
      </div>
    </section>
  );
}

export function OrganizerEventManage({ event, onBack, onPromo }: { event: OrganizerEvent; onBack: () => void; onPromo: () => void }) {
  const [attendance, setAttendance] = useState<OrganizerAttendance | null>(null);
  const [tab, setTab] = useState<ManageTab>("participants");
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerAttendance(event.id).then(
      (payload) => {
        if (alive) setAttendance(payload);
      },
      () => {
        if (alive) setFailed("Не удалось загрузить участников.");
      },
    );
    return () => {
      alive = false;
    };
  }, [event.id, reloads]);

  const reload = useCallback(() => {
    setReloads((value) => value + 1);
  }, []);

  const checkIn = (entryCode: string) => {
    setBusy(true);
    setFailed(null);
    apiClient.checkInOrganizerGuest(event.id, entryCode).then(
      (row) => {
        setBusy(false);
        setCode("");
        setNotice(`${row.name} — на месте`);
        reload();
      },
      () => {
        setBusy(false);
        setNotice(null);
        setFailed("Код не подошёл: такой брони на этом событии нет.");
      },
    );
  };

  return (
    <OrganizerEventManageView
      event={event}
      attendance={attendance}
      tab={tab}
      scanning={scanning}
      code={code}
      busy={busy}
      notice={notice}
      failed={failed}
      onTab={setTab}
      onScan={() => setScanning((value) => !value)}
      onCode={setCode}
      onSubmitCode={() => checkIn(code)}
      onCheckIn={(row) => checkIn(organizerEntryCode(row.bookingId))}
      onInvite={() => {
        if (attendance === null) return;
        setBusy(true);
        apiClient.inviteFromOrganizerWaitlist(event.id, Math.min(attendance.freedSeats, attendance.waitlist.length)).then(
          (result) => {
            setBusy(false);
            setNotice(`Приглашение ушло: ${result.invited}`);
            reload();
          },
          () => {
            setBusy(false);
            setFailed("Не удалось позвать из листа ожидания.");
          },
        );
      }}
      onRefresh={reload}
      onBack={onBack}
      onPromo={onPromo}
    />
  );
}
