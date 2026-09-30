import { useEffect, useRef, useState } from "react";
import type { WalkBudgetMode, WalkInterest } from "@max-events/api-contracts";
import { ONBOARDING_CITIES } from "../onboarding/onboarding";
import { ActionIcon, type ActionIconName } from "../ui/icons";

export type WalkChoice = {
  readonly durationMinutes: number | null;
  readonly budgetMode: WalkBudgetMode | null;
  readonly budgetRub: number | null;
  readonly interests: readonly WalkInterest[];
};

export const EMPTY_WALK_CHOICE: WalkChoice = {
  durationMinutes: null,
  budgetMode: null,
  budgetRub: null,
  interests: [],
};

export const CUSTOM_WALK_MINUTES = 90;
export const CUSTOM_WALK_STEP = 30;
export const WALK_DURATION_MIN = 30;
export const WALK_DURATION_MAX = 480;

const TIME_OPTIONS = [
  { minutes: 60, label: "1 час", mood: "кофе и одна точка", icon: "clock" },
  { minutes: 120, label: "2 часа", mood: "пара достопримечательностей", icon: "users" },
  { minutes: 180, label: "3 часа", mood: "не спеша, с фото", icon: "footprints" },
  { minutes: 240, label: "Полдня", mood: "с обедом и закатом", icon: "sun" },
] as const satisfies readonly { readonly minutes: number; readonly label: string; readonly mood: string; readonly icon: ActionIconName }[];

const BUDGET_OPTIONS = [
  { id: "free", title: "Бесплатно", desc: "Парки, набережные, архитектура", icon: "ticket", tone: "free" },
  { id: "any", title: "Любой", desc: "С музеями и смотровыми площадками", icon: "landmark", tone: "any" },
  { id: "custom", title: "Свой лимит", desc: "Задать сумму на одного человека", icon: "wallet", tone: "limit" },
] as const satisfies readonly { readonly id: WalkBudgetMode; readonly title: string; readonly desc: string; readonly icon: ActionIconName; readonly tone: "free" | "any" | "limit" }[];

const INTEREST_OPTIONS: readonly { readonly id: WalkInterest; readonly label: string }[] = [
  { id: "cultural", label: "Культурные" },
  { id: "iconic", label: "Знаковые" },
  { id: "parks", label: "Парки и набережные" },
  { id: "history", label: "История" },
  { id: "architecture", label: "Архитектура" },
  { id: "unusual", label: "Необычные" },
];

export function walkComposeReady(choice: WalkChoice): boolean {
  if (choice.durationMinutes === null || choice.durationMinutes < WALK_DURATION_MIN || choice.durationMinutes > WALK_DURATION_MAX) return false;
  if (choice.budgetMode === null) return false;
  if (choice.budgetMode === "custom" && choice.budgetRub === null) return false;
  return choice.interests.length > 0;
}

export function isWalkPresetDuration(minutes: number | null): boolean {
  return TIME_OPTIONS.some((option) => option.minutes === minutes);
}

export function walkCityList(current: string): readonly string[] {
  const names = ONBOARDING_CITIES.map((item) => item.name);
  return names.includes(current) ? names : [current, ...names];
}

export function selectWalkTime(choice: WalkChoice, minutes: number): WalkChoice {
  if (!Number.isInteger(minutes) || minutes < WALK_DURATION_MIN || minutes > WALK_DURATION_MAX) return choice;
  return { ...choice, durationMinutes: minutes };
}

export function stepWalkCustomTime(choice: WalkChoice, delta: -1 | 1): WalkChoice {
  const base = choice.durationMinutes ?? CUSTOM_WALK_MINUTES;
  const next = Math.min(WALK_DURATION_MAX, Math.max(WALK_DURATION_MIN, base + delta * CUSTOM_WALK_STEP));
  return selectWalkTime(choice, next);
}

export function selectWalkBudget(choice: WalkChoice, mode: WalkBudgetMode, budgetRub: number | null = null): WalkChoice {
  if (mode === "custom") return { ...choice, budgetMode: mode, budgetRub };
  return { ...choice, budgetMode: mode, budgetRub: null };
}

export function toggleWalkInterest(choice: WalkChoice, id: WalkInterest): WalkChoice {
  const has = choice.interests.includes(id);
  return { ...choice, interests: has ? choice.interests.filter((item) => item !== id) : [...choice.interests, id] };
}

export function walkStepFilled(choice: WalkChoice, step: "time" | "budget" | "interests"): boolean {
  if (step === "time") return choice.durationMinutes !== null && choice.durationMinutes >= WALK_DURATION_MIN && choice.durationMinutes <= WALK_DURATION_MAX;
  if (step === "budget") return choice.budgetMode !== null && (choice.budgetMode !== "custom" || choice.budgetRub !== null);
  return choice.interests.length > 0;
}

export function walkStep(choice: WalkChoice): "time" | "budget" | "interests" {
  if (!walkStepFilled(choice, "time")) return "time";
  if (!walkStepFilled(choice, "budget")) return "budget";
  return "interests";
}

export function walkChoiceSummary(choice: WalkChoice): string {
  const parts: string[] = [];
  if (choice.durationMinutes !== null) {
    const hours = Math.floor(choice.durationMinutes / 60);
    const rest = choice.durationMinutes % 60;
    if (hours > 0 && rest > 0) parts.push(`${hours} ч ${rest} мин`);
    else if (hours > 0) parts.push(`${hours} ч`);
    else parts.push(`${rest} мин`);
  }
  if (choice.budgetMode === "free") parts.push("Бесплатно");
  else if (choice.budgetMode === "any") parts.push("Любой бюджет");
  else if (choice.budgetMode === "custom" && choice.budgetRub !== null) parts.push(`до ${choice.budgetRub.toLocaleString("ru-RU")} ₽`);
  if (choice.interests.length > 0) parts.push(`тем: ${choice.interests.length}`);
  return parts.join(" · ");
}

const PROGRESS: readonly { readonly id: "time" | "budget" | "interests"; readonly label: string }[] = [
  { id: "time", label: "Время" },
  { id: "budget", label: "Бюджет" },
  { id: "interests", label: "Интересы" },
];

function WalkProgress({ step, choice, onSelectStep }: { readonly step: "time" | "budget" | "interests"; readonly choice: WalkChoice; readonly onSelectStep: (step: "time" | "budget" | "interests") => void }) {
  return (
    <ol className="app-walk-progress" aria-label="Шаги">
      {PROGRESS.map((item, index) => {
        const isCurrent = item.id === step;
        const isDone = walkStepFilled(choice, item.id);
        const stateClass = isCurrent ? "app-walk-tab--active" : isDone ? "app-walk-tab--done" : "app-walk-tab--empty";
        return (
          <li
            key={item.id}
            className={`app-walk-progress-item${isCurrent ? " app-walk-progress-item--current" : ""}${isDone ? " app-walk-progress-item--done" : ""}`}
          >
            <button type="button" className={`app-walk-tab ${stateClass}`} onClick={() => onSelectStep(item.id)}>
              <span className="app-walk-tab-dot" aria-hidden="true">
                {isDone && !isCurrent ? <ActionIcon name="check" size={14} strokeWidth={2.8} /> : index + 1}
              </span>
              <span className="app-walk-tab-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function WalkCityChip({ city, onCity }: { readonly city: string; readonly onCity?: (city: string) => void }) {
  const [menu, setMenu] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cities = walkCityList(city);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      setMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  return (
    <div className="app-walk-city-wrap" ref={wrapRef}>
      <button type="button" className="app-walk-city-chip" aria-label="Город" aria-expanded={menu} aria-haspopup="listbox" onClick={() => setMenu((open) => !open)}>
        <ActionIcon name="pin" size={14} />
        <span>{city}</span>
      </button>
      {menu ? (
        <div className="app-walk-city-menu" role="listbox" aria-label="Город">
          {cities.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === city}
              className={option === city ? "app-walk-city-option app-walk-city-option--on" : "app-walk-city-option"}
              onClick={() => {
                onCity?.(option);
                setMenu(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WalkWizard({ city, choice, onChange, onCompose, onCity, notice }: { readonly city: string; readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onCompose?: () => void; readonly onCity?: (city: string) => void; readonly notice?: string | null }) {
  const defaultStep = walkStep(choice);
  const [userStep, setUserStep] = useState<"time" | "budget" | "interests" | null>(null);

  const prevChoiceRef = useRef(choice);
  if (prevChoiceRef.current !== choice) {
    if (choice.durationMinutes === null && choice.budgetMode === null && choice.interests.length === 0) {
      if (userStep !== null) setUserStep(null);
    }
    prevChoiceRef.current = choice;
  }

  const step = userStep ?? defaultStep;
  const isReady = walkComposeReady(choice);
  const canAdvanceTime = choice.durationMinutes !== null && choice.durationMinutes >= WALK_DURATION_MIN && choice.durationMinutes <= WALK_DURATION_MAX;
  const canAdvanceBudget = choice.budgetMode !== null && (choice.budgetMode !== "custom" || choice.budgetRub !== null);

  const canAdvance = step === "time" ? canAdvanceTime : step === "budget" ? canAdvanceBudget : isReady;
  const missingSteps = PROGRESS.filter((item) => !walkStepFilled(choice, item.id)).map((item) => item.label);

  function handleNext(): void {
    if (step === "time") {
      setUserStep("budget");
    } else if (step === "budget") {
      setUserStep("interests");
    } else if (onCompose) {
      onCompose();
    }
  }

  const buttonLabel = step === "interests" ? "Собрать прогулку" : "Далее";

  return (
    <section className="app-walk">
      <div className="app-walk-top">
        <WalkCityChip city={city} onCity={onCity} />
      </div>

      <header className="app-walk-head">
        <h1 className="app-walk-title">Прогулка: {city}</h1>
      </header>

      <WalkProgress step={step} choice={choice} onSelectStep={(next) => setUserStep(next)} />

      {step === "time" ? <TimeStep choice={choice} onChange={(next) => { onChange(next); setUserStep("time"); }} /> : null}
      {step === "budget" ? <BudgetStep choice={choice} onChange={(next) => { onChange(next); setUserStep("budget"); }} /> : null}
      {step === "interests" ? <InterestStep choice={choice} onChange={(next) => { onChange(next); setUserStep("interests"); }} /> : null}

      {notice != null && notice !== "" ? <p className="app-walk-alert">{notice}</p> : null}

      <footer className="app-walk-footer">
        {!isReady && missingSteps.length > 0 && step === "interests" ? <p className="app-walk-summary-text">Ещё: {missingSteps.join(", ").toLowerCase()}</p> : null}
        <button type="button" className="app-walk-btn-primary" disabled={!canAdvance} onClick={handleNext}>
          <span>{buttonLabel}</span>
        </button>
      </footer>
    </section>
  );
}

function TimeStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  const custom = choice.durationMinutes !== null && !isWalkPresetDuration(choice.durationMinutes);
  const customMinutes = custom ? choice.durationMinutes! : CUSTOM_WALK_MINUTES;
  return (
    <div className="app-walk-step-card app-walk-rise">
      <div className="app-walk-step-header">
        <h2 className="app-walk-step-title">Сколько времени</h2>
        <p className="app-walk-step-hint">От часа до полдня или точное время</p>
      </div>

      <div className="app-walk-time-grid">
        {TIME_OPTIONS.map((option) => {
          const isSelected = choice.durationMinutes === option.minutes;
          return (
            <button
              key={option.minutes}
              type="button"
              className={isSelected ? "app-walk-tile app-walk-tile--selected" : "app-walk-tile"}
              aria-pressed={isSelected}
              onClick={() => onChange(selectWalkTime(choice, option.minutes))}
            >
              <span className="app-walk-tile-icon" aria-hidden="true">
                <ActionIcon name={option.icon} size={22} strokeWidth={1.8} />
              </span>
              <span className="app-walk-tile-val">{option.label}</span>
              <span className="app-walk-tile-desc">{option.mood}</span>
            </button>
          );
        })}
      </div>

      <div className={custom ? "app-walk-custom-row app-walk-custom-row--active" : "app-walk-custom-row"}>
        <button
          type="button"
          className="app-walk-custom-info"
          aria-label="Своё"
          aria-pressed={custom}
          onClick={() => onChange(selectWalkTime(choice, customMinutes))}
        >
          <span className="app-walk-custom-icon" aria-hidden="true">
            <ActionIcon name="calendar" size={18} strokeWidth={1.8} />
          </span>
          <span className="app-walk-custom-copy">
            <span className="app-walk-custom-title">Своё время</span>
            <span className="app-walk-custom-hint">от {WALK_DURATION_MIN} до {WALK_DURATION_MAX} минут</span>
          </span>
        </button>
        <div className="app-walk-stepper">
          <button type="button" className="app-walk-stepper-btn" aria-label="Меньше" onClick={() => onChange(stepWalkCustomTime(choice, -1))}>
            <ActionIcon name="minus" size={16} strokeWidth={2.2} />
          </button>
          <span className="app-walk-stepper-val">{customMinutes} мин</span>
          <button type="button" className="app-walk-stepper-btn" aria-label="Больше" onClick={() => onChange(stepWalkCustomTime(choice, 1))}>
            <ActionIcon name="plus" size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  const [rubText, setRubText] = useState(choice.budgetRub !== null ? String(choice.budgetRub) : "");
  return (
    <div className="app-walk-step-card app-walk-rise">
      <div className="app-walk-step-header">
        <h2 className="app-walk-step-title">Бюджет маршрута</h2>
        <p className="app-walk-step-hint">Билеты в музеи и платные места</p>
      </div>

      <div className="app-walk-budget-stack">
        {BUDGET_OPTIONS.map((item) => {
          const isSelected = choice.budgetMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={isSelected ? "app-walk-budget-card app-walk-budget-card--selected" : "app-walk-budget-card"}
              aria-pressed={isSelected}
              onClick={() => {
                if (item.id === "custom") {
                  onChange(selectWalkBudget(choice, "custom", choice.budgetRub));
                  return;
                }
                onChange(selectWalkBudget(choice, item.id));
              }}
            >
              <span className={`app-walk-budget-icon app-walk-budget-icon--${item.tone}`} aria-hidden="true">
                <ActionIcon name={item.icon} size={18} strokeWidth={1.8} />
              </span>
              <span className="app-walk-budget-content">
                <span className="app-walk-budget-title">{item.title}</span>
                <span className="app-walk-budget-desc">{item.desc}</span>
              </span>
              <span className={isSelected ? "app-walk-budget-radio app-walk-budget-radio--on" : "app-walk-budget-radio"} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {choice.budgetMode === "custom" ? (
        <div className="app-walk-budget-custom app-walk-rise">
          <input
            type="text"
            placeholder="1000"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Свой бюджет"
            value={rubText}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "").slice(0, 6);
              setRubText(raw);
              if (raw === "") {
                onChange(selectWalkBudget(choice, "custom", null));
                return;
              }
              const rub = Number(raw);
              if (Number.isInteger(rub) && rub >= 0 && rub <= 100000) {
                onChange(selectWalkBudget(choice, "custom", rub));
              }
            }}
          />
          <span className="app-walk-custom-unit">₽ на человека</span>
        </div>
      ) : null}
    </div>
  );
}

function InterestStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  const count = choice.interests.length;
  return (
    <div className="app-walk-step-card app-walk-rise">
      <div className="app-walk-step-header">
        <div className="app-walk-step-title">
          <span>Интересы</span>
          {count > 0 ? <span className="app-walk-badge">Выбрано: {count}</span> : null}
        </div>
        <p className="app-walk-step-hint">Выберите темы для персонализации точек маршрута</p>
      </div>

      <div className="app-walk-interests-grid">
        {INTEREST_OPTIONS.map((option) => {
          const isSelected = choice.interests.includes(option.id);
          return (
            <button key={option.id} type="button" className={isSelected ? "app-walk-interest-chip app-walk-interest-chip--selected" : "app-walk-interest-chip"} aria-pressed={isSelected} onClick={() => onChange(toggleWalkInterest(choice, option.id))}>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
