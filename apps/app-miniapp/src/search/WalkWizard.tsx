import { useRef, useState } from "react";
import type { WalkBudgetMode, WalkInterest } from "@max-events/api-contracts";
import { ActionIcon } from "../ui/icons";

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

const TIME_OPTIONS = [
  { minutes: 60, label: "1 час", mood: "кофе и одна точка" },
  { minutes: 120, label: "2 часа", mood: "пара достопримечательностей" },
  { minutes: 180, label: "3 часа", mood: "не спеша, с фото" },
  { minutes: 240, label: "Полдня", mood: "с обедом и закатом" },
] as const;

const BUDGET_OPTIONS = [
  { id: "free", title: "Бесплатно", desc: "Парки, набережные, архитектура" },
  { id: "any", title: "Любой", desc: "С музеями и смотровыми площадками" },
  { id: "custom", title: "Свой лимит", desc: "Задать сумму на одного человека" },
] as const;

const INTEREST_OPTIONS: readonly { readonly id: WalkInterest; readonly label: string }[] = [
  { id: "cultural", label: "Культурные" },
  { id: "iconic", label: "Знаковые" },
  { id: "parks", label: "Парки и набережные" },
  { id: "history", label: "История" },
  { id: "architecture", label: "Архитектура" },
  { id: "unusual", label: "Необычные" },
];

export function walkComposeReady(choice: WalkChoice): boolean {
  if (choice.durationMinutes === null || choice.durationMinutes < 30 || choice.durationMinutes > 480) return false;
  if (choice.budgetMode === null) return false;
  if (choice.budgetMode === "custom" && choice.budgetRub === null) return false;
  return choice.interests.length > 0;
}

export function selectWalkTime(choice: WalkChoice, minutes: number): WalkChoice {
  if (!Number.isInteger(minutes) || minutes < 30 || minutes > 480) return choice;
  return { ...choice, durationMinutes: minutes };
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
  if (step === "time") return choice.durationMinutes !== null && choice.durationMinutes >= 30 && choice.durationMinutes <= 480;
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
      {PROGRESS.map((item) => {
        const isCurrent = item.id === step;
        const isDone = walkStepFilled(choice, item.id);
        const stateClass = isCurrent ? "app-walk-tab--active" : isDone ? "app-walk-tab--done" : "app-walk-tab--empty";
        return (
          <li key={item.id} className="app-walk-progress-item">
            <button type="button" className={`app-walk-tab ${stateClass}`} onClick={() => onSelectStep(item.id)}>
              <span className="app-walk-tab-bar" />
              <span className="app-walk-tab-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function WalkWizard({ city, choice, onChange, onCompose, onSaved, notice }: { readonly city: string; readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onCompose?: () => void; readonly onSaved?: () => void; readonly notice?: string | null }) {
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
  const canAdvanceTime = choice.durationMinutes !== null && choice.durationMinutes >= 30 && choice.durationMinutes <= 480;
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

  const buttonLabel = step === "interests" || isReady ? "Собрать прогулку" : "Далее";

  return (
    <section className="app-walk">
      <div className="app-walk-top">
        <div className="app-walk-city-chip">
          <ActionIcon name="pin" size={12} />
          <span>{city}</span>
        </div>
      </div>

      <header className="app-walk-head">
        <h1 className="app-walk-title">Прогулка: {city}</h1>
      </header>

      <WalkProgress step={step} choice={choice} onSelectStep={(next) => setUserStep(next)} />

      {step === "time" ? <TimeStep choice={choice} onChange={onChange} onSelect={() => setUserStep("budget")} /> : null}
      {step === "budget" ? <BudgetStep choice={choice} onChange={onChange} onSelect={() => setUserStep("interests")} /> : null}
      {step === "interests" ? <InterestStep choice={choice} onChange={onChange} /> : null}

      {notice != null && notice !== "" ? <p className="app-walk-alert">{notice}</p> : null}

      <footer className="app-walk-footer">
        {step !== "time" && <p className="app-walk-summary-text">{walkChoiceSummary(choice)}</p>}
        {!isReady && missingSteps.length > 0 && step === "interests" ? <p className="app-walk-summary-text">Ещё: {missingSteps.join(", ").toLowerCase()}</p> : null}
        <button type="button" className="app-walk-btn-primary" disabled={!canAdvance} onClick={handleNext}>
          <span>{buttonLabel}</span>
        </button>
        {onSaved !== undefined ? (
          <button type="button" className="app-walk-btn-secondary" onClick={onSaved}>
            <span>Мои прогулки</span>
            <ActionIcon name="chevron" size={15} />
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function TimeStep({ choice, onChange, onSelect }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onSelect: () => void }) {
  const custom = choice.durationMinutes !== null && !TIME_OPTIONS.some((option) => option.minutes === choice.durationMinutes);
  const [typed, setTyped] = useState(custom ? String(choice.durationMinutes ?? "") : "");
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
              onClick={() => {
                setTyped("");
                onChange(selectWalkTime(choice, option.minutes));
                onSelect();
              }}
            >
              <div className="app-walk-tile-head">
                <span className="app-walk-tile-val">{option.label}</span>
              </div>
              <span className="app-walk-tile-desc">{option.mood}</span>
            </button>
          );
        })}
      </div>

      <div className={custom ? "app-walk-custom-row app-walk-custom-row--active" : "app-walk-custom-row"}>
        <div className="app-walk-custom-info">
          <span className="app-walk-custom-title">{custom ? "Своё · выбрано" : "Своё время"}</span>
          <span className="app-walk-custom-hint">от 30 до 480 минут</span>
        </div>
        <div className="app-walk-custom-pill">
          <input
            type="text"
            className="app-walk-custom-input"
            placeholder="90"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Своё"
            value={typed}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "").slice(0, 3);
              setTyped(raw);
              if (raw === "") return;
              const minutes = Number(raw);
              if (Number.isInteger(minutes) && minutes >= 30 && minutes <= 480) {
                onChange(selectWalkTime(choice, minutes));
              }
            }}
          />
          <span className="app-walk-custom-unit">мин</span>
        </div>
      </div>
    </div>
  );
}

function BudgetStep({ choice, onChange, onSelect }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onSelect: () => void }) {
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
                } else {
                  onChange(selectWalkBudget(choice, item.id));
                  onSelect();
                }
              }}
            >
              <span className="app-walk-budget-content">
                <span className="app-walk-budget-title">{item.title}</span>
                <span className="app-walk-budget-desc">{item.desc}</span>
              </span>
              <span className="app-walk-budget-mark" aria-hidden="true">
                {isSelected ? <ActionIcon name="check" size={14} strokeWidth={2.8} /> : null}
              </span>
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
