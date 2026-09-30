// START_MODULE_CONTRACT
// PURPOSE: Organizer mailing screens — the list opened from «Рассылка», the «Новая рассылка» form and the results of a sent mailing.
// SCOPE: Presentational list, form and results plus the draft helpers. The event is chosen in the same sheet as a post. Created mailings stay on the active list for the cabinet session. Opening a mailing shows its results.
// DEPENDS: react, @max-events/api-contracts (Event), ../api/client.js (apiClient), ../catalog/format.js (pluralRu), ../ui/EventPicker.js, ../ui/icons.js, ../ui/theme.css, ./organizer-native-back.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useEffect, useRef, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { pluralRu } from "../catalog/format";
import { EventPicker } from "../ui/EventPicker";
import { ActionIcon } from "../ui/icons";
import { useOrganizerNativeBack } from "./organizer-native-back";

export type MailingPhase = "active" | "archived";
export type MailingAudience = "all" | "active" | "segment";

export interface MailingRow {
  id: string;
  phase: MailingPhase;
  title: string;
  detail: string;
  opened: string;
  clicks: string;
}

export const MAILING_ROWS: MailingRow[] = [
  { id: "announce", phase: "active", title: "Анонс новых событий", detail: "25.09.2025 · 2 342 получателя", opened: "42%", clicks: "7%" },
  { id: "offers", phase: "active", title: "Специальное предложение на выходные", detail: "20.09.2025 · 1 502 получателя", opened: "38%", clicks: "8%" },
  { id: "remind", phase: "active", title: "Напоминание о событии", detail: "15.09.2025 · 3 201 получателя", opened: "56%", clicks: "19%" },
];

export interface MailingFigures {
  when: string;
  sent: number;
  opened: number;
  clicked: number;
  delivered: number;
  missed: number;
  unsubscribed: number;
}

/** The reference mailing on the results mock, plus the other two cabinet rows. */
const MAILING_FIGURES: Record<string, MailingFigures> = {
  offers: { when: "20.09.2025 · 14:30", sent: 1502, opened: 570, clicked: 120, delivered: 1482, missed: 20, unsubscribed: 3 },
  announce: { when: "25.09.2025 · 11:15", sent: 2342, opened: 984, clicked: 164, delivered: 2310, missed: 32, unsubscribed: 5 },
  remind: { when: "15.09.2025 · 18:40", sent: 3201, opened: 1793, clicked: 608, delivered: 3160, missed: 41, unsubscribed: 8 },
};

export interface MailingResultView {
  title: string;
  when: string;
  sentLabel: string;
  openedRate: string;
  openedLabel: string;
  clickRate: string;
  clickLabel: string;
  deliveredLabel: string;
  deliveredRate: string;
  missedLabel: string;
  missedRate: string;
  unsubscribedLabel: string;
  unsubscribedRate: string;
}

export function ruCount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value).replace(/[\u00a0\u202f]/g, " ");
}

function rateLabel(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const value = (part / whole) * 100;
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

function figuresOf(row: MailingRow): MailingFigures {
  const known = MAILING_FIGURES[row.id];
  if (known !== undefined) return known;
  const sentMatch = row.detail.match(/(\d[\d\s]*)\s+получател/);
  const sent = sentMatch === null ? 0 : Number(sentMatch[1].replace(/\s/g, ""));
  const openedRate = Number(row.opened.replace("%", "").replace(",", ".")) / 100;
  const clickRate = Number(row.clicks.replace("%", "").replace(",", ".")) / 100;
  const opened = Number.isFinite(openedRate) ? Math.round(sent * openedRate) : 0;
  const clicked = Number.isFinite(clickRate) ? Math.round(sent * clickRate) : 0;
  const date = row.detail.split("·")[0]?.trim() ?? "";
  const quiet = opened === 0 && clicked === 0;
  return {
    when: date === "" ? row.detail : `${date} · 12:00`,
    sent,
    opened,
    clicked,
    delivered: quiet ? sent : Math.max(0, sent - Math.round(sent * 0.013)),
    missed: quiet ? 0 : Math.max(0, Math.round(sent * 0.013)),
    unsubscribed: quiet ? 0 : Math.max(0, Math.round(sent * 0.002)),
  };
}

export function mailingResult(row: MailingRow): MailingResultView {
  const figures = figuresOf(row);
  return {
    title: row.title,
    when: figures.when,
    sentLabel: ruCount(figures.sent),
    openedRate: rateLabel(figures.opened, figures.sent),
    openedLabel: ruCount(figures.opened),
    clickRate: rateLabel(figures.clicked, figures.sent),
    clickLabel: ruCount(figures.clicked),
    deliveredLabel: ruCount(figures.delivered),
    deliveredRate: rateLabel(figures.delivered, figures.sent),
    missedLabel: ruCount(figures.missed),
    missedRate: rateLabel(figures.missed, figures.sent),
    unsubscribedLabel: ruCount(figures.unsubscribed),
    unsubscribedRate: rateLabel(figures.unsubscribed, figures.sent),
  };
}

const OPEN_CURVE = [18, 34, 54, 56, 38, 34, 50, 66, 52, 40];
const CLICK_CURVE = [8, 14, 22, 24, 14, 12, 18, 28, 22, 12];

function curvePath(series: number[]): string {
  const points = series.map((value, index) => [(index / (series.length - 1)) * 100, 100 - value] as const);
  const first = points[0];
  if (first === undefined) return "";
  let path = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const point = points[index];
    if (prev === undefined || point === undefined) continue;
    const mid = (prev[0] + point[0]) / 2;
    path += ` C ${mid.toFixed(2)} ${prev[1].toFixed(2)}, ${mid.toFixed(2)} ${point[1].toFixed(2)}, ${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
  }
  return path;
}

export const MAIL_AUDIENCES: ReadonlyArray<{ id: MailingAudience; label: string; count: number | null }> = [
  { id: "all", label: "Вся база подписчиков (2 842)", count: 2842 },
  { id: "active", label: "Только активные (1 960)", count: 1960 },
  { id: "segment", label: "Сегмент аудитории", count: null },
];

export const MAIL_MESSAGE_LIMIT = 2000;

export interface MailingDraft {
  subject: string;
  message: string;
  audience: MailingAudience;
  eventId: string | null;
  eventTitle: string;
}

export const EMPTY_MAILING_DRAFT: MailingDraft = {
  subject: "",
  message: "",
  audience: "all",
  eventId: null,
  eventTitle: "",
};

const sessionMailings: MailingRow[] = [];
let mailSeq = 0;

export function resetMailSession(): void {
  sessionMailings.splice(0, sessionMailings.length);
  mailSeq = 0;
}

export function mailingRows(): MailingRow[] {
  return [...sessionMailings, ...MAILING_ROWS];
}

export function mailingBlock(draft: MailingDraft): string | null {
  if (draft.subject.trim() === "") return "Введите тему";
  if (draft.message.trim() === "") return "Введите текст";
  if (draft.eventId === null || draft.eventTitle.trim() === "") return "Выберите событие";
  return null;
}

function peopleLine(audience: MailingAudience): string {
  const count = MAIL_AUDIENCES.find((item) => item.id === audience)?.count ?? null;
  if (count === null) return "сегмент аудитории";
  const formatted = count.toLocaleString("ru-RU").replace(/\s/g, " ");
  return `${formatted} ${pluralRu(count, "получатель", "получателя", "получателей")}`;
}

/** A just-sent mailing, shaped like the cabinet rows: active, not yet opened. */
export function createdMailing(draft: MailingDraft, id: string, now = new Date()): MailingRow {
  const day = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  return {
    id,
    phase: "active",
    title: draft.subject.trim(),
    detail: `${day} · ${peopleLine(draft.audience)}`,
    opened: "0%",
    clicks: "0%",
  };
}

export function saveMailing(draft: MailingDraft, now = new Date()): MailingRow {
  mailSeq += 1;
  const row = createdMailing(draft, `mail-${mailSeq}`, now);
  sessionMailings.unshift(row);
  return row;
}

export function MailingListScreen({ rows = MAILING_ROWS, onBack, onCreate, onOpen }: { rows?: MailingRow[]; onBack: () => void; onCreate: () => void; onOpen?: (row: MailingRow) => void }) {
  const [phase, setPhase] = useState<MailingPhase>("active");
  const visible = rows.filter((row) => row.phase === phase);
  useOrganizerNativeBack(true, onBack);
  return (
    <section className="app-cab app-promo app-pcodes app-mail" aria-label="Рассылка">
      <header className="app-pcodes-bar">
        <button type="button" className="app-pcodes-iconbtn" aria-label="Назад" onClick={onBack}>
          <span className="app-pcodes-back-icon">
            <ActionIcon name="chevron" size={22} strokeWidth={2.1} />
          </span>
        </button>
        <h1 className="app-pcodes-title">Рассылка</h1>
        <button type="button" className="app-pcodes-iconbtn" aria-label="Создать рассылку" onClick={onCreate}>
          <ActionIcon name="plus" size={22} strokeWidth={2.1} />
        </button>
      </header>
      <div className="app-pcodes-tabs" role="tablist" aria-label="Рассылки">
        <button type="button" role="tab" aria-selected={phase === "active"} onClick={() => setPhase("active")}>
          Активные
        </button>
        <button type="button" role="tab" aria-selected={phase === "archived"} onClick={() => setPhase("archived")}>
          Архивные
        </button>
      </div>
      <div className="app-pcodes-hero">
        <div className="app-pcodes-hero-row">
          <span className="app-pcodes-hero-mark" aria-hidden="true">
            <ActionIcon name="mail" size={22} strokeWidth={2} />
          </span>
          <p>Отправьте персональное сообщение вашей аудитории</p>
        </div>
        <button type="button" className="app-pcodes-hero-btn" onClick={onCreate}>
          Создать рассылку
        </button>
      </div>
      <h2 className="app-pcodes-list-title">Список рассылок</h2>
      {visible.length === 0 ? (
        <p className="app-promo-empty">Нет архивных рассылок</p>
      ) : (
        <div className="app-promo-list">
          {visible.map((row) => (
            <button key={row.id} type="button" className="app-pcodes-card app-mail-card" onClick={() => onOpen?.(row)}>
              <span className="app-mail-mark" aria-hidden="true">
                <ActionIcon name="mail" size={22} strokeWidth={2} />
              </span>
              <span className="app-promo-row-copy">
                <span className="app-mail-name">{row.title}</span>
                <span className="app-mail-detail">{row.detail}</span>
                <span className="app-mail-stats">
                  <span className="app-mail-open">Открыто {row.opened}</span>
                  <span className="app-mail-click">Переходы {row.clicks}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function MailingResults({ row, onBack }: { row: MailingRow; onBack: () => void }) {
  const result = mailingResult(row);
  const [chartOpen, setChartOpen] = useState(true);
  useOrganizerNativeBack(true, onBack);
  return (
    <section className="app-cab app-promo app-mail-result" aria-label="Результаты рассылки">
      <header className="app-pcodes-bar">
        <button type="button" className="app-pcodes-iconbtn" aria-label="Назад" onClick={onBack}>
          <span className="app-pcodes-back-icon">
            <ActionIcon name="chevron" size={22} strokeWidth={2.1} />
          </span>
        </button>
        <h1 className="app-pcodes-title">Результаты рассылки</h1>
        <span className="app-pcodes-iconbtn" aria-hidden="true" />
      </header>
      <article className="app-mail-result-card">
        <div className="app-mail-result-head">
          <span className="app-mail-mark" aria-hidden="true">
            <ActionIcon name="mail" size={22} strokeWidth={2} />
          </span>
          <span className="app-mail-result-copy">
            <strong>{result.title}</strong>
            <em>{result.when}</em>
          </span>
        </div>
        <div className="app-mail-result-stats">
          <span>
            <small>Отправлено</small>
            <b>{result.sentLabel}</b>
            <em>{result.sentLabel}</em>
          </span>
          <span>
            <small>Открыто</small>
            <b>{result.openedRate}</b>
            <em>{result.openedLabel}</em>
          </span>
          <span>
            <small>Перешли</small>
            <b>{result.clickRate}</b>
            <em>{result.clickLabel}</em>
          </span>
        </div>
      </article>
      <article className="app-mail-result-card">
        <button type="button" className="app-mail-chart-toggle" aria-expanded={chartOpen} onClick={() => setChartOpen((current) => !current)}>
          График активности
          <ActionIcon name="chevron" size={16} strokeWidth={2.2} />
        </button>
        {chartOpen && (
          <div className="app-mail-chart">
            <div className="app-mail-plot">
              <div className="app-mail-y" aria-hidden="true">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0</span>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="График открытий и переходов">
                {[0, 25, 50, 75, 100].map((line) => (
                  <line key={line} x1="0" x2="100" y1={line} y2={line} />
                ))}
                <path className="app-mail-line app-mail-line--click" d={curvePath(CLICK_CURVE)} />
                <path className="app-mail-line app-mail-line--open" d={curvePath(OPEN_CURVE)} />
              </svg>
            </div>
            <div className="app-mail-x" aria-hidden="true">
              <span>0:00</span>
              <span>6:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div className="app-mail-legend">
              <span>
                <i className="app-mail-dot app-mail-dot--open" />
                Открытия
              </span>
              <span>
                <i className="app-mail-dot app-mail-dot--click" />
                Переходы
              </span>
            </div>
          </div>
        )}
      </article>
      <article className="app-mail-result-card">
        <h2>Детализация</h2>
        <ul className="app-mail-breakdown">
          <li>
            <i className="app-mail-detail-icon app-mail-detail-icon--ok" aria-hidden="true">
              <ActionIcon name="check" size={14} strokeWidth={2.8} />
            </i>
            <span>Успешно доставлено</span>
            <b>{result.deliveredLabel}</b>
            <em>{result.deliveredRate}</em>
          </li>
          <li>
            <i className="app-mail-detail-icon app-mail-detail-icon--bad" aria-hidden="true">
              <ActionIcon name="close" size={14} strokeWidth={2.6} />
            </i>
            <span>Не доставлено</span>
            <b>{result.missedLabel}</b>
            <em>{result.missedRate}</em>
          </li>
          <li>
            <i className="app-mail-detail-icon app-mail-detail-icon--mute" aria-hidden="true">
              <ActionIcon name="userMinus" size={14} strokeWidth={2.2} />
            </i>
            <span>Отписались</span>
            <b>{result.unsubscribedLabel}</b>
            <em>{result.unsubscribedRate}</em>
          </li>
        </ul>
      </article>
    </section>
  );
}

function plainText(node: HTMLElement): string {
  return node.innerText.replace(/\n$/, "");
}

function MailMessage({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (plainText(node) !== value) node.innerText = value;
  }, [value]);

  const publish = () => {
    const node = ref.current;
    if (node === null) return;
    const text = plainText(node);
    if (text.length > MAIL_MESSAGE_LIMIT) {
      node.innerText = text.slice(0, MAIL_MESSAGE_LIMIT);
      onChange(text.slice(0, MAIL_MESSAGE_LIMIT));
      return;
    }
    onChange(text);
  };

  const command = (name: string, argument?: string) => {
    ref.current?.focus();
    if (typeof document.execCommand === "function") document.execCommand(name, false, argument);
    publish();
  };

  return (
    <div className="app-mail-editor">
      <div className="app-mail-body-wrap">
        {value === "" && (
          <span className="app-mail-placeholder" aria-hidden="true">
            Введите текст
          </span>
        )}
        <div ref={ref} className="app-mail-body" contentEditable role="textbox" aria-multiline="true" aria-label="Текст сообщения" data-placeholder="Введите текст" onInput={publish} />
      </div>
      <div className="app-mail-tools">
        <button type="button" aria-label="Жирный" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}>
          <b>B</b>
        </button>
        <button type="button" aria-label="Курсив" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}>
          <i>I</i>
        </button>
        <button type="button" aria-label="Список" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}>
          <ActionIcon name="list" size={18} strokeWidth={2} />
        </button>
        <button type="button" aria-label="Ссылка" onMouseDown={(event) => event.preventDefault()} onClick={() => command("createLink", "https://")}>
          <ActionIcon name="link" size={18} strokeWidth={2} />
        </button>
        <span className="app-mail-count">
          {value.length}/{MAIL_MESSAGE_LIMIT}
        </span>
      </div>
    </div>
  );
}

export function MailingCreate({ draft, block, events, onChange, onSubmit, onBack }: { draft: MailingDraft; block: string | null; events?: Event[]; onChange: (patch: Partial<MailingDraft>) => void; onSubmit: () => void; onBack: () => void }) {
  const [fetched, setFetched] = useState<Event[]>([]);
  const loaded = events ?? fetched;
  const [picking, setPicking] = useState(false);
  useOrganizerNativeBack(true, picking ? () => setPicking(false) : onBack);

  useEffect(() => {
    if (events !== undefined) return;
    let alive = true;
    apiClient.listEvents().then(
      (next) => {
        if (alive) setFetched(next);
      },
      () => {
        if (alive) setFetched([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [events]);

  return (
    <section className="app-cab app-promo app-pcodes app-mail" aria-label="Новая рассылка">
      <header className="app-pcodes-bar">
        <button type="button" className="app-pcodes-iconbtn" aria-label="Назад" onClick={onBack}>
          <span className="app-pcodes-back-icon">
            <ActionIcon name="chevron" size={22} strokeWidth={2.1} />
          </span>
        </button>
        <h1 className="app-pcodes-title">Новая рассылка</h1>
        <span className="app-pcodes-iconbtn" aria-hidden="true" />
      </header>
      <label className="app-pcodes-field">
        <span className="app-mail-label">
          Тема письма <em>*</em>
        </span>
        <input className="app-pcodes-input" autoComplete="off" placeholder="Введите тему" value={draft.subject} onChange={(change) => onChange({ subject: change.target.value })} />
      </label>
      <div className="app-pcodes-field">
        <span className="app-mail-label">
          Текст сообщения <em>*</em>
        </span>
        <MailMessage value={draft.message} onChange={(message) => onChange({ message })} />
      </div>
      <div className="app-pcodes-field">
        <span className="app-mail-label">
          Событие <em>*</em>
        </span>
        <button type="button" className={draft.eventTitle === "" ? "app-pcodes-select-btn app-pcodes-select-btn--placeholder" : "app-pcodes-select-btn"} aria-label="Событие" aria-haspopup="dialog" onClick={() => setPicking(true)}>
          <span>{draft.eventTitle === "" ? "Выберите событие" : draft.eventTitle}</span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.2} />
        </button>
      </div>
      <div className="app-mail-people">
        <h2>Получатели</h2>
        <div role="radiogroup" aria-label="Получатели">
          {MAIL_AUDIENCES.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={draft.audience === item.id} className="app-mail-radio" onClick={() => onChange({ audience: item.id })}>
              <i />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      {block !== null && <p className="app-fin-block">{block}</p>}
      <button type="button" className="app-pcodes-submit" onClick={onSubmit}>
        Отправить рассылку
      </button>
      {picking && (
        <EventPicker
          title="Событие"
          events={loaded}
          selectedId={draft.eventId}
          onPick={(event) => {
            onChange({ eventId: event.id, eventTitle: event.title });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}
