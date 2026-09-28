// START_MODULE_CONTRACT
// PURPOSE: «Куда пойдём?» (макет, экраны 11 и 12): three questions with a progress header, then at most five suggestions — the first as a hero card, the rest as a numbered list. The evening question also takes a free-text event that MAX AI matches.
// SCOPE: Closed answers via apiClient.getWhereto at useViewerOrigin; a typed event via apiClient.assistQuery. Local wizard state and the ru copy of the closed answer sets; navigation to the event route only.
// DEPENDS: @max-events/api-contracts (Whereto*), ../api/client.js (apiClient, WheretoPick), ../catalog/format.js (pluralRu), ../geo/profile-city.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - COMPANY_LABELS - ru labels for WheretoCompany, in the order the question lists them
// - MOOD_LABELS - ru labels for WheretoMood
// - MOOD_HINTS - the second line under a mood option («спорт, танцы, что-то с движением»)
// - BUDGET_LABELS - ru labels for WheretoBudget
// - WHERETO_QUESTIONS - the three questions in order: heading, the topic the next-question preview names, and the label the answered summary carries
// - WheretoAnswers - what has been answered so far; a null means the question is still open
// - WheretoState - ask(at) while a question is open, result(query) once all three are answered
// - WheretoResult - fetch status of the result screen: loading | error | ready (backend picks)
// - wizardStepIndex - 0-based progress position (drives «N из 3»); the result sits past the last question
// - wheretoQuery - the three answers as a query, null while any of them is open
// - wheretoWish - the typed event once it is long enough for MAX AI, otherwise null
// - answeredRows - the answered questions above the open one, each with its label and value
// - resultTitle - header of экран 12: «Пять вариантов», spelled out as the design does
// - restLabel - «Ещё четыре под те же ответы» under the hero card
// - formatWheretoWhen - «Сегодня 20:00» / «Завтра 21:00» / the full date beyond tomorrow
// - formatWheretoPrice - «800 ₽» / «бесплатно» / «платно» when the price is missing from a paid event
// - WheretoView - presentational: the question screen (экран 11) and the result screen (экран 12)
// - WheretoPage - route container: wizard state, the backend suggestion fetch and navigation to an event
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { WheretoBudget, WheretoCompany, WheretoMood, WheretoQuery } from "@max-events/api-contracts";
import { apiClient, type WheretoPick } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useProfileCityPoint } from "../geo/profile-city";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { eventFillLabel, pictured } from "../ui/photos";
import { AppEmptyState, AppMedia, AppState } from "../ui/primitives";

export const COMPANY_LABELS: Record<WheretoCompany, string> = { alone: "Я один", friends: "С друзьями", partner: "С парой", kids: "С детьми" };

export const MOOD_LABELS: Record<WheretoMood, string> = { active: "Событие", calm: "Прогулка", unusual: "Прогулка и событие" };

/** What the evening is made of. The API still stores it as the mood field. */
export const MOOD_HINTS: Record<WheretoMood, string> = { active: "концерт, спорт, выставка", calm: "парк, набережная, двор", unusual: "сначала пройтись, потом событие" };

export const BUDGET_LABELS: Record<WheretoBudget, string> = { free: "Бесплатно", under_3000: "До 3000 ₽", any: "Любой" };

/** The three questions in order: the heading over the options, the topic the «— следующий вопрос» preview names, and the label of the answered summary. */
export const WHERETO_QUESTIONS = [
  { heading: "С кем идёте?", topic: "Компания", summary: "С кем идёте" },
  { heading: "Что в вечере?", topic: "Вечер", summary: "Вечер" },
  { heading: "Какой бюджет?", topic: "Бюджет", summary: "Бюджет" },
] as const;

const COMPANY_ORDER: readonly WheretoCompany[] = ["alone", "friends", "partner", "kids"];
const MOOD_ORDER: readonly WheretoMood[] = ["active", "calm", "unusual"];
const BUDGET_ORDER: readonly WheretoBudget[] = ["free", "under_3000", "any"];

/** What has been answered so far; null means the question is still open. */
export interface WheretoAnswers {
  company: WheretoCompany | null;
  mood: WheretoMood | null;
  budget: WheretoBudget | null;
  /** Typed rubles. The request still uses the nearest budget band. */
  budgetRub: number | null;
  /** null — свой вариант не выбран. Строка, в том числе пустая — выбран, человек ещё печатает. */
  wish: string | null;
}

/** A typed sum becomes the nearest band the catalog understands. */
export function budgetFromRub(raw: string): { budget: WheretoBudget; rub: number } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  const rub = Number(digits);
  if (!Number.isFinite(rub)) return null;
  if (rub <= 0) return { budget: "free", rub: 0 };
  if (rub <= 3000) return { budget: "under_3000", rub };
  return { budget: "any", rub };
}

/** Where the wizard stands. The answers live beside it, not inside it: «Изменить» reopens one question without losing the other two. */
export type WheretoState = { step: "ask"; at: number } | { step: "result"; query: WheretoQuery };

/** Fetch status of the result screen: the backend suggestion is loading, failed, or ready with its picks. */
export type WheretoResult = { status: "loading" } | { status: "error" } | { status: "ready"; items: WheretoPick[] };

export function wizardStepIndex(state: WheretoState): number {
  return state.step === "ask" ? state.at : WHERETO_QUESTIONS.length;
}

/** The three answers as a query; null while any of them is still open, so the result can never be asked for half a context. */
export function wheretoQuery(answers: WheretoAnswers): WheretoQuery | null {
  if (answers.company === null || answers.mood === null || answers.budget === null) return null;
  return { company: answers.company, mood: answers.mood, budget: answers.budget };
}

/** Текст своего события, когда его уже можно отдать MAX AI. Пустой и короткий ввод — ещё не запрос. */
export function wheretoWish(answers: WheretoAnswers): string | null {
  if (answers.wish === null) return null;
  const text = answers.wish.trim();
  return text.length >= 2 ? text : null;
}

/** The questions already answered above the open one: what was asked and what was chosen. */
export function answeredRows(answers: WheretoAnswers, at: number): Array<{ at: number; label: string; value: string }> {
  const rows: Array<{ at: number; label: string; value: string }> = [];
  if (at > 0 && answers.company !== null) rows.push({ at: 0, label: WHERETO_QUESTIONS[0].summary, value: COMPANY_LABELS[answers.company] });
  if (at > 1 && answers.mood !== null) rows.push({ at: 1, label: WHERETO_QUESTIONS[1].summary, value: wheretoWish(answers) ?? MOOD_LABELS[answers.mood] });
  if (at > 2 && answers.budget !== null) rows.push({ at: 2, label: WHERETO_QUESTIONS[2].summary, value: answers.budgetRub !== null && answers.budgetRub > 0 ? `${answers.budgetRub.toLocaleString("ru-RU")} ₽` : BUDGET_LABELS[answers.budget] });
  return rows;
}

// Макет пишет число словом («Пять вариантов»), а не цифрой; больше пяти подбор не отдаёт по контракту.
const SPELLED = ["ноль", "один", "два", "три", "четыре", "пять"] as const;

function spelled(count: number): string {
  return SPELLED[count] ?? String(count);
}

/** Header of экран 12. Zero is not «ноль вариантов»: an empty answer is a state of its own, not a count. */
export function resultTitle(count: number): string {
  if (count === 0) return "Подборка пуста";
  const word = spelled(count);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${pluralRu(count, "вариант", "варианта", "вариантов")}`;
}

/** «Ещё четыре под те же ответы» — the line between the hero card and the rest of the list. */
export function restLabel(count: number): string {
  return `Ещё ${spelled(count)} под те же ответы`;
}

const MOSCOW_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
const MOSCOW_TIME = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
const MOSCOW_DATE = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** «Сегодня 20:00» / «Завтра 21:00» / «26 сентября, 14:00» — the Moscow calendar the whole screen counts in. */
export function formatWheretoWhen(startsAt: string, now: Date = new Date()): string {
  const day = MOSCOW_DAY.format(new Date(startsAt));
  const today = MOSCOW_DAY.format(now);
  const tomorrow = MOSCOW_DAY.format(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (day === today) return `Сегодня ${MOSCOW_TIME.format(new Date(startsAt))}`;
  if (day === tomorrow) return `Завтра ${MOSCOW_TIME.format(new Date(startsAt))}`;
  return MOSCOW_DATE.format(new Date(startsAt));
}

/** «800 ₽» / «бесплатно». A paid event without a price reads «платно» rather than free, which would be a lie. */
export function formatWheretoPrice(pick: { isPaid: boolean; priceRub: number | null }): string {
  if (pick.priceRub !== null) return `${pick.priceRub.toLocaleString("ru-RU")} ₽`;
  return pick.isPaid ? "платно" : "бесплатно";
}
/** A positive price is a charge even when isPaid was left false: the card would still print «2 900 ₽». */
export function eventFitsBudget(event: { isPaid: boolean; priceRub: number | null }, budget: WheretoBudget): boolean {
  const charged = event.isPaid || (event.priceRub !== null && event.priceRub > 0);
  if (budget === "any") return true;
  if (budget === "free") return !charged;
  return !charged || (event.priceRub !== null && event.priceRub <= 3000);
}

/** The wish replaces the mood, not the budget the person already answered. */
export function picksForBudget<T extends { isPaid: boolean; priceRub: number | null }>(items: readonly T[], budget: WheretoBudget): T[] {
  return items.filter((item) => eventFitsBudget(item, budget)).slice(0, 5);
}


function formatKm(distanceKm: number | null): string | null {
  return distanceKm === null ? null : `${distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
}

function metaLine(pick: WheretoPick, now: Date, withPrice: boolean): string {
  return [formatWheretoWhen(pick.startsAt, now), formatKm(pick.distanceKm), withPrice ? formatWheretoPrice(pick) : null].filter((part) => part !== null).join(" · ");
}

interface WheretoViewProps {
  state: WheretoState;
  answers: WheretoAnswers;
  result: WheretoResult;
  now?: Date;
  onPick: (answers: WheretoAnswers) => void;
  onStep: (at: number) => void;
  onNext: () => void;
  onBack: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onOpenEvent: (id: string) => void;
}

function Progress({ at }: { at: number }) {
  return (
    <div className="app-wizard-progress">
      <div className="app-wizard-progress-bar" aria-hidden="true">
        {WHERETO_QUESTIONS.map((question, index) => (
          <span key={question.topic} className={index <= at ? "app-wizard-progress-seg app-wizard-progress-seg--on" : "app-wizard-progress-seg"} />
        ))}
      </div>
      <span className="app-wizard-progress-label">
        {at + 1} из {WHERETO_QUESTIONS.length}
      </span>
    </div>
  );
}

function QuestionScreen({ at, answers, onPick, onStep, onNext }: { at: number; answers: WheretoAnswers } & Pick<WheretoViewProps, "onPick" | "onStep" | "onNext">) {
  const question = WHERETO_QUESTIONS[at];
  const next = WHERETO_QUESTIONS[at + 1];
  const wishOpen = at === 1 && answers.wish !== null;
  const options = at === 0 ? COMPANY_ORDER.map((value) => ({ value, label: COMPANY_LABELS[value], hint: null, on: answers.company === value, pick: () => onPick({ ...answers, company: value }) })) : at === 1 ? [
    ...MOOD_ORDER.map((value) => ({ value, label: MOOD_LABELS[value], hint: MOOD_HINTS[value], on: answers.mood === value && answers.wish === null, pick: () => onPick({ ...answers, mood: value, wish: null }) })),
    { value: "wish", label: "Своё событие", hint: "напишите, MAX AI подберёт", on: answers.wish !== null, pick: () => onPick({ ...answers, mood: "active", wish: answers.wish ?? "" }) },
  ] : [
    { value: "free", label: "Бесплатно", hint: null, on: answers.budget === "free" && answers.budgetRub === null, pick: () => onPick({ ...answers, budget: "free", budgetRub: null }) },
    { value: "any", label: "Любой", hint: null, on: answers.budget === "any" && answers.budgetRub === null, pick: () => onPick({ ...answers, budget: "any", budgetRub: null }) },
    { value: "own", label: "Своя сумма", hint: null, on: answers.budgetRub !== null, pick: () => onPick({ ...answers, budget: answers.budget ?? "under_3000", budgetRub: answers.budgetRub ?? 0 }) },
  ];
  const chosen = wishOpen ? (answers.wish ?? "").trim().length >= 2 : options.some((option) => option.on) && (at !== 2 || answers.budgetRub === null || answers.budgetRub > 0);

  return (
    <>
      <Progress at={at} />
      {answeredRows(answers, at).map((row) => (
        <div key={row.at} className="app-wt-answer">
          <ActionIcon name="check" size={18} strokeWidth={2.4} />
          <span className="app-wt-answer-text">
            <span className="app-wt-answer-label">{row.label}</span>
            <span className="app-wt-answer-value">{row.value}</span>
          </span>
          <button type="button" className="app-wt-answer-edit" onClick={() => onStep(row.at)}>
            Изменить
          </button>
        </div>
      ))}
      <h2 className="app-wt-question">{question.heading}</h2>
      <div key={at} className="app-whereto-options" role="radiogroup" aria-label={question.summary}>
        {options.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={option.on} className={option.on ? "app-whereto-option app-whereto-option--on" : "app-whereto-option"} onClick={option.pick}>
            <span className="app-wt-radio" aria-hidden="true">
              {option.on && <span className="app-wt-radio-dot" />}
            </span>
            <span className="app-wt-option-text">
              <span className="app-wt-option-title">{option.label}</span>
              {option.hint !== null && <span className="app-wt-option-hint">{option.hint}</span>}
            </span>
          </button>
        ))}
      </div>
      {wishOpen && (
        <label className="app-wt-budget">
          <span>Своё событие</span>
          <input aria-label="Своё событие" placeholder="Например джаз в центре" maxLength={200} value={answers.wish ?? ""} onChange={(change) => onPick({ ...answers, mood: "active", wish: change.target.value })} />
        </label>
      )}
      {next !== undefined && (
        <div className="app-wt-next" aria-hidden="true">
          <span className="app-wt-radio" />
          <span className="app-wt-next-text">{next.topic} — следующий вопрос</span>
        </div>
      )}
      {at === 2 && answers.budgetRub !== null && (
        <label className="app-wt-budget">
          <span>Сумма, ₽</span>
          <input
            inputMode="numeric"
            aria-label="Свой бюджет"
            placeholder="Например 1500"
            value={answers.budgetRub === 0 ? "" : answers.budgetRub}
            onChange={(change) => {
              const parsed = budgetFromRub(change.target.value);
              onPick(parsed === null ? { ...answers, budget: "under_3000", budgetRub: 0 } : { ...answers, budget: parsed.budget, budgetRub: parsed.rub });
            }}
          />
        </label>
      )}
      <div className="app-wt-bar">
        <button type="button" className="app-wt-bar-cta" disabled={!chosen} onClick={onNext}>
          {next === undefined ? "Показать варианты" : "Дальше"}
          <ActionIcon name="arrow" size={18} strokeWidth={2.6} />
        </button>
      </div>
    </>
  );
}

function ResultScreen({ query, wish, result, now, onStep, onRestart, onRetry, onOpenEvent }: { query: WheretoQuery; wish: string | null; result: WheretoResult; now: Date } & Pick<WheretoViewProps, "onStep" | "onRestart" | "onRetry" | "onOpenEvent">) {
  const items = result.status === "ready" ? result.items : [];
  const [hero, ...rest] = items;
  const loadingLabel = wish === null ? "Собираем вечер" : "MAX AI подбирает";

  return (
    <>
      <div className="app-whereto-chips">
        <span className="app-wt-chip">{COMPANY_LABELS[query.company]}</span>
        <span className="app-wt-chip">{wish ?? MOOD_LABELS[query.mood]}</span>
        <span className="app-wt-chip">{BUDGET_LABELS[query.budget]}</span>
        <button type="button" className="app-whereto-restart" onClick={onRestart}>
          Ответить заново
        </button>
      </div>
      {result.status === "loading" && (
        <div className="app-wt-assemble" role="status" aria-label={loadingLabel}>
          <p className="app-ai-seek">
            <span className="app-ai-seek-word">{loadingLabel}</span>
          </p>
          <ol className="app-wt-path">
            <li>Прогулка по городу</li>
            <li>Точка, где остановиться</li>
            <li>Событие на вечер</li>
          </ol>
        </div>
      )}
      {result.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось собрать подборку.
        </AppState>
      )}
      {result.status === "ready" && items.length === 0 && <AppEmptyState kind="empty-match" onAction={() => onStep(2)} onSecondaryAction={onRestart} />}
      {(query.mood === "calm" || query.mood === "unusual") && items.length > 0 && <p className="app-wt-walk">Сначала прогулка по городу, потом событие.</p>}
      {hero !== undefined && (
        <button type="button" className="app-wt-hero" onClick={() => onOpenEvent(hero.id)}>
          <AppMedia category={hero.category} src={pictured(hero.id, hero.coverUrl)} />
          <span className="app-wt-hero-blob" aria-hidden="true" />
          <span className="app-wt-hero-veil">
            <span className="app-wt-hero-title">{hero.title}</span>
            <span className="app-wt-hero-meta">{metaLine(hero, now, true)}</span>
          </span>
        </button>
      )}
      {rest.length > 0 && (
        <>
          <p className="app-wt-rest">{restLabel(rest.length)}</p>
          <div className="app-wt-list">
            {rest.map((pick, index) => (
              <button key={pick.id} type="button" className="app-wt-row" onClick={() => onOpenEvent(pick.id)}>
                <span className="app-wt-row-index">{index + 2}</span>
                <AppMedia category={pick.category} src={pictured(pick.id, pick.coverUrl)} />
                <span className="app-wt-row-text">
                  <span className="app-wt-row-title">{pick.title}</span>
                  <span className="app-wt-row-meta">{metaLine(pick, now, false)}</span>
                </span>
                <span className="app-wt-row-price">{formatWheretoPrice(pick)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function WheretoView({ state, answers, result, now = new Date(), onPick, onStep, onNext, onRestart, onRetry, onOpenEvent }: WheretoViewProps) {
  const title = state.step === "ask" ? "Куда пойдём?" : resultTitle(result.status === "ready" ? result.items.length : 0);

  return (
    <section className="app-wt">
      <div className="app-wt-topbar">
        <h1 className="app-wt-title">{title}</h1>
      </div>
      {state.step === "ask" ? <QuestionScreen at={state.at} answers={answers} onPick={onPick} onStep={onStep} onNext={onNext} /> : <ResultScreen query={state.query} wish={wheretoWish(answers)} result={result} now={now} onStep={onStep} onRestart={onRestart} onRetry={onRetry} onOpenEvent={onOpenEvent} />}
    </section>
  );
}

const NO_ANSWERS: WheretoAnswers = { company: null, mood: null, budget: null, budgetRub: null, wish: null };

export function WheretoPage() {
  const { navigate, back } = useRoute();
  const point = useProfileCityPoint();
  const [state, setState] = useState<WheretoState>({ step: "ask", at: 0 });
  const [answers, setAnswers] = useState<WheretoAnswers>(NO_ANSWERS);
  const [result, setResult] = useState<WheretoResult>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const query = state.step === "result" ? state.query : null;
  const wish = wheretoWish(answers);

  useEffect(() => {
    if (query === null || !point.settled) return;
    let alive = true;
    setResult({ status: "loading" });
    const ready = (items: WheretoPick[]) => {
      if (alive) setResult({ status: "ready", items });
    };
    const failed = () => {
      if (alive) setResult({ status: "error" });
    };
    if (wish === null) {
      apiClient.getWhereto(query, { latitude: point.latitude, longitude: point.longitude }).then((response) => ready(picksForBudget(response.items, query.budget)), failed);
    } else {
      const capped = query.budget === "free" ? `${wish}. Только бесплатные.` : query.budget === "under_3000" ? `${wish}. Не дороже 3000 рублей.` : wish;
      apiClient.assistQuery(capped).then((response) => ready(picksForBudget(response.items.map((item) => ({ ...item.event, distanceKm: null })), query.budget)), failed);
    }
    return () => {
      alive = false;
    };
    // attempt re-runs the same query after a failure; the origin may sharpen while the screen is open
  }, [query, wish, point.settled, point.latitude, point.longitude, attempt]);

  const at = wizardStepIndex(state);
  // Один вход во все переходы: шаг за пределами последнего вопроса означает выдачу, но только когда
  // все три ответа на месте — иначе экран показал бы подборку по половине контекста.
  const show = (next: WheretoAnswers, to: number) => {
    setAnswers(next);
    const asked = wheretoQuery(next);
    setState(to >= WHERETO_QUESTIONS.length && asked !== null ? { step: "result", query: asked } : { step: "ask", at: Math.min(to, WHERETO_QUESTIONS.length - 1) });
  };

  return (
    <WheretoView
      state={state}
      answers={answers}
      result={result}
      onPick={(next) => show(next, at)}
      onStep={(to) => show(answers, to)}
      onNext={() => show(answers, at + 1)}
      onBack={() => {
        if (at > 0) return show(answers, at - 1);
        back();
      }}
      onRestart={() => show(NO_ANSWERS, 0)}
      onRetry={() => setAttempt((value) => value + 1)}
      onOpenEvent={(id) => navigate({ name: "event", id })}
    />
  );
}
