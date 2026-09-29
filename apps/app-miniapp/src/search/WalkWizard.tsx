import { useRef, useState } from "react";
import type { WalkBudgetMode, WalkInterest } from "@max-events/api-contracts";
import { ActionIcon } from "../ui/icons";
import { AppChip } from "../ui/primitives";

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

export function walkStep(choice: WalkChoice): "time" | "budget" | "interests" {
  if (choice.durationMinutes === null) return "time";
  if (choice.budgetMode === null || (choice.budgetMode === "custom" && choice.budgetRub === null)) return "budget";
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

export function WalkBack({ onBack }: { readonly onBack: () => void }) {
  return (
    <button type="button" className="app-walk-back" onClick={onBack}>
      <ActionIcon name="chevron" size={16} />
      Назад
    </button>
  );
}

function WalkProgress({ step, onSelectStep }: { readonly step: "time" | "budget" | "interests"; readonly onSelectStep: (step: "time" | "budget" | "interests") => void }) {
  const current = PROGRESS.findIndex((item) => item.id === step);
  return (
    <ol className="app-walk-progress" aria-label="Шаги">
      {PROGRESS.map((item, index) => {
        const state = index === current ? "on" : index < current ? "done" : "idle";
        return (
          <li key={item.id} className={`app-walk-progress-item app-walk-progress-item--${state}`}>
            <button type="button" className="app-walk-progress-btn" onClick={() => onSelectStep(item.id)}>
              <span className="app-walk-progress-dot" />
              <span>{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function WalkWizard({ city, choice, onChange, onBack, onCompose, onSaved, notice }: { readonly city: string; readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onBack: () => void; readonly onCompose?: () => void; readonly onSaved?: () => void; readonly notice?: string | null }) {
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

  function handleBack(): void {
    if (step === "interests") {
      setUserStep("budget");
    } else if (step === "budget") {
      setUserStep("time");
    } else {
      onBack();
    }
  }

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
      <WalkBack onBack={handleBack} />
      <header className="app-walk-head">
        <p className="app-walk-kicker">Пеший маршрут</p>
        <h1 className="app-walk-title">Прогулка: {city}</h1>
      </header>
      <WalkProgress step={step} onSelectStep={(next) => setUserStep(next)} />
      {step === "time" ? <TimeStep choice={choice} onChange={onChange} onSelect={() => setUserStep("budget")} /> : null}
      {step === "budget" ? <BudgetStep choice={choice} onChange={onChange} onSelect={() => setUserStep("interests")} /> : null}
      {step === "interests" ? <InterestStep choice={choice} onChange={onChange} /> : null}
      {notice != null && notice !== "" ? <p className="app-walk-alert">{notice}</p> : null}
      <footer className="app-walk-footer">
        {step !== "time" && <p className="app-walk-summary">{walkChoiceSummary(choice)}</p>}
        <button type="button" className="app-walk-compose" disabled={!canAdvance} onClick={handleNext}>
          {buttonLabel}
        </button>
        {onSaved !== undefined ? (
          <button type="button" className="app-walk-saved" onClick={onSaved}>
            <span>Мои прогулки</span>
            <ActionIcon name="chevron" size={18} />
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function TimeStep({ choice, onChange, onSelect }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onSelect: () => void }) {
  const custom = choice.durationMinutes !== null && !TIME_OPTIONS.some((option) => option.minutes === choice.durationMinutes);
  return (
    <fieldset className="app-walk-step app-walk-rise">
      <legend>Сколько времени</legend>
      <p className="app-walk-hint">От часа до полдня — или свои минуты</p>
      <div className="app-walk-choices app-walk-choices--tiles">
        {TIME_OPTIONS.map((option) => (
          <button
            key={option.minutes}
            type="button"
            className={choice.durationMinutes === option.minutes ? "app-walk-tile app-walk-tile--on" : "app-walk-tile"}
            aria-pressed={choice.durationMinutes === option.minutes}
            onClick={() => {
              onChange(selectWalkTime(choice, option.minutes));
              onSelect();
            }}
          >
            <span className="app-walk-tile-label">{option.label}</span>
            <span className="app-walk-tile-mood">{option.mood}</span>
          </button>
        ))}
      </div>
      <div className={custom ? "app-walk-custom app-walk-custom--on" : "app-walk-custom"}>
        <div className="app-walk-custom-copy">
          <span className="app-walk-custom-title">{custom ? "Своё · выбрано" : "Своё"}</span>
          <span className="app-walk-custom-hint">от 30 до 480 минут</span>
        </div>
        <div className="app-walk-custom-input-wrap">
          <input
            type="number"
            min={30}
            max={480}
            inputMode="numeric"
            aria-label="Своё"
            placeholder="мин"
            value={custom ? choice.durationMinutes ?? "" : ""}
            onChange={(event) => {
              const minutes = Number(event.target.value);
              if (Number.isInteger(minutes) && minutes >= 30 && minutes <= 480) {
                onChange(selectWalkTime(choice, minutes));
              }
            }}
          />
          <span className="app-walk-custom-unit">мин</span>
        </div>
      </div>
    </fieldset>
  );
}

function BudgetStep({ choice, onChange, onSelect }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onSelect: () => void }) {
  return (
    <fieldset className="app-walk-step app-walk-rise">
      <legend>Бюджет</legend>
      <p className="app-walk-hint">
        {choice.budgetMode === "free"
          ? "Только открытые локации, без билетов"
          : choice.budgetMode === "any"
            ? "Включая выставки, музеи и смотровые"
            : choice.budgetMode === "custom"
              ? "Ограничить сумму на человека"
              : "Только прогулка, без билетов и кафе"}
      </p>
      <div className="app-walk-choices">
        <AppChip
          pressed={choice.budgetMode === "free"}
          onClick={() => {
            onChange(selectWalkBudget(choice, "free"));
            onSelect();
          }}
        >
          Бесплатно
        </AppChip>
        <AppChip
          pressed={choice.budgetMode === "any"}
          onClick={() => {
            onChange(selectWalkBudget(choice, "any"));
            onSelect();
          }}
        >
          Любой
        </AppChip>
        <AppChip
          pressed={choice.budgetMode === "custom"}
          onClick={() => {
            onChange(selectWalkBudget(choice, "custom", choice.budgetRub));
          }}
        >
          Свой
        </AppChip>
      </div>
      {choice.budgetMode === "custom" ? (
        <div className="app-walk-custom app-walk-custom--budget app-walk-rise">
          <div className="app-walk-custom-copy">
            <span className="app-walk-custom-title">Максимум на прогулку</span>
            <span className="app-walk-custom-hint">рубли на одного человека</span>
          </div>
          <div className="app-walk-custom-input-wrap">
            <input
              type="number"
              min={0}
              max={100000}
              inputMode="numeric"
              aria-label="Свой бюджет"
              placeholder="1000"
              value={choice.budgetRub ?? ""}
              onChange={(event) => {
                const rub = Number(event.target.value);
                if (Number.isInteger(rub) && rub >= 0 && rub <= 100000) {
                  onChange(selectWalkBudget(choice, "custom", rub));
                }
              }}
            />
            <span className="app-walk-custom-unit">₽</span>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

function InterestStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  const count = choice.interests.length;
  return (
    <fieldset className="app-walk-step app-walk-rise">
      <div className="app-walk-step-head">
        <legend>Интересы</legend>
        {count > 0 ? <span className="app-walk-badge">Выбрано: {count}</span> : null}
      </div>
      <p className="app-walk-hint">Можно несколько — соберём маршрут под них</p>
      <div className="app-walk-choices">
        {INTEREST_OPTIONS.map((option) => (
          <AppChip key={option.id} pressed={choice.interests.includes(option.id)} onClick={() => onChange(toggleWalkInterest(choice, option.id))}>
            {option.label}
          </AppChip>
        ))}
      </div>
    </fieldset>
  );
}
