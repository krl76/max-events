import type { WalkBudgetMode, WalkInterest } from "@max-events/api-contracts";
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
  { minutes: 60, label: "1 час" },
  { minutes: 120, label: "2 часа" },
  { minutes: 180, label: "3 часа" },
  { minutes: 240, label: "Полдня" },
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

function walkStep(choice: WalkChoice): "time" | "budget" | "interests" {
  if (choice.durationMinutes === null) return "time";
  if (choice.budgetMode === null || (choice.budgetMode === "custom" && choice.budgetRub === null)) return "budget";
  return "interests";
}

export function WalkWizard({
  city,
  choice,
  onChange,
  onBack,
  onCompose,
  onSaved,
  notice,
}: {
  readonly city: string;
  readonly choice: WalkChoice;
  readonly onChange: (choice: WalkChoice) => void;
  readonly onBack: () => void;
  readonly onCompose?: () => void;
  readonly onSaved?: () => void;
  readonly notice?: string | null;
}) {
  const step = walkStep(choice);
  return (
    <section className="app-walk">
      <button type="button" className="app-walk-back" onClick={onBack}>
        Назад
      </button>
      <h1 className="app-walk-title">Прогулка: {city}</h1>
      {step === "time" ? <TimeStep choice={choice} onChange={onChange} /> : null}
      {step === "budget" ? <BudgetStep choice={choice} onChange={onChange} /> : null}
      {step === "interests" ? <InterestStep choice={choice} onChange={onChange} /> : null}
      {notice != null && notice !== "" ? <p className="app-walk-note">{notice}</p> : null}
      <button type="button" className="app-walk-compose" disabled={!walkComposeReady(choice)} onClick={onCompose}>
        Собрать прогулку
      </button>
      {onSaved !== undefined ? (
        <button type="button" className="app-walk-saved" onClick={onSaved}>
          Мои прогулки
        </button>
      ) : null}
    </section>
  );
}

function TimeStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  return (
    <fieldset className="app-walk-step">
      <legend>Сколько времени</legend>
      <div className="app-walk-choices">
        {TIME_OPTIONS.map((option) => (
          <AppChip key={option.minutes} pressed={choice.durationMinutes === option.minutes} onClick={() => onChange(selectWalkTime(choice, option.minutes))}>
            {option.label}
          </AppChip>
        ))}
      </div>
      <label className="app-walk-custom">
        Своё
        <input
          type="number"
          min={30}
          max={480}
          inputMode="numeric"
          aria-label="Своё"
          placeholder="мин"
          onChange={(event) => {
            const minutes = Number(event.target.value);
            if (Number.isInteger(minutes)) onChange(selectWalkTime(choice, minutes));
          }}
        />
      </label>
    </fieldset>
  );
}

function BudgetStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  return (
    <fieldset className="app-walk-step">
      <legend>Бюджет</legend>
      <div className="app-walk-choices">
        <AppChip pressed={choice.budgetMode === "free"} onClick={() => onChange(selectWalkBudget(choice, "free"))}>
          Бесплатно
        </AppChip>
        <AppChip pressed={choice.budgetMode === "any"} onClick={() => onChange(selectWalkBudget(choice, "any"))}>
          Любой
        </AppChip>
        <AppChip pressed={choice.budgetMode === "custom"} onClick={() => onChange(selectWalkBudget(choice, "custom", choice.budgetRub))}>
          Свой
        </AppChip>
      </div>
      {choice.budgetMode === "custom" ? (
        <label className="app-walk-custom">
          Рубли
          <input
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            aria-label="Свой бюджет"
            onChange={(event) => {
              const rub = Number(event.target.value);
              if (Number.isInteger(rub) && rub >= 0 && rub <= 100000) onChange(selectWalkBudget(choice, "custom", rub));
            }}
          />
        </label>
      ) : null}
    </fieldset>
  );
}

function InterestStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  return (
    <fieldset className="app-walk-step">
      <legend>Интересы</legend>
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
