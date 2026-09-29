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
  { minutes: 60, label: "1 час", glyph: "☕", mood: "кофе и одна точка" },
  { minutes: 120, label: "2 часа", glyph: "🏛", mood: "пара достопримечательностей" },
  { minutes: 180, label: "3 часа", glyph: "📸", mood: "не спеша, с фото" },
  { minutes: 240, label: "Полдня", glyph: "🌇", mood: "с обедом и закатом" },
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

function WalkProgress({ step }: { readonly step: "time" | "budget" | "interests" }) {
  const current = PROGRESS.findIndex((item) => item.id === step);
  return (
    <ol className="app-walk-progress" aria-label="Шаги">
      {PROGRESS.map((item, index) => {
        const state = index === current ? "on" : index < current ? "done" : "idle";
        return (
          <li key={item.id} className={`app-walk-progress-item app-walk-progress-item--${state}`}>
            <span className="app-walk-progress-dot" />
            <span>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function WalkWizard({ city, choice, onChange, onBack, onCompose, onSaved, notice }: { readonly city: string; readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void; readonly onBack: () => void; readonly onCompose?: () => void; readonly onSaved?: () => void; readonly notice?: string | null }) {
  const step = walkStep(choice);
  return (
    <section className="app-walk">
      <WalkBack onBack={onBack} />
      <header className="app-walk-head">
        <p className="app-walk-kicker">Пеший маршрут</p>
        <h1 className="app-walk-title">Прогулка: {city}</h1>
      </header>
      <WalkProgress step={step} />
      {step === "time" ? <TimeStep choice={choice} onChange={onChange} /> : null}
      {step === "budget" ? <BudgetStep choice={choice} onChange={onChange} /> : null}
      {step === "interests" ? <InterestStep choice={choice} onChange={onChange} /> : null}
      {notice != null && notice !== "" ? <p className="app-walk-alert">{notice}</p> : null}
      <button type="button" className="app-walk-compose" disabled={!walkComposeReady(choice)} onClick={onCompose}>
        Собрать прогулку
      </button>
      {onSaved !== undefined ? (
        <button type="button" className="app-walk-saved" onClick={onSaved}>
          <span>Мои прогулки</span>
          <ActionIcon name="chevron" size={18} />
        </button>
      ) : null}
    </section>
  );
}

function TimeStep({ choice, onChange }: { readonly choice: WalkChoice; readonly onChange: (choice: WalkChoice) => void }) {
  const custom = choice.durationMinutes !== null && !TIME_OPTIONS.some((option) => option.minutes === choice.durationMinutes);
  return (
    <fieldset className="app-walk-step app-walk-rise">
      <legend>Сколько времени</legend>
      <p className="app-walk-hint">От часа до полдня — или свои минуты</p>
      <div className="app-walk-choices app-walk-choices--tiles">
        {TIME_OPTIONS.map((option) => (
          <button key={option.minutes} type="button" className={choice.durationMinutes === option.minutes ? "app-walk-tile app-walk-tile--on" : "app-walk-tile"} aria-pressed={choice.durationMinutes === option.minutes} onClick={() => onChange(selectWalkTime(choice, option.minutes))}>
            <span className="app-walk-tile-glyph" aria-hidden="true">
              {option.glyph}
            </span>
            <span className="app-walk-tile-label">{option.label}</span>
            <span className="app-walk-tile-mood">{option.mood}</span>
          </button>
        ))}
      </div>
      <label className="app-walk-custom">
        <span>{custom ? "Своё · выбрано" : "Своё"}</span>
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
    <fieldset className="app-walk-step app-walk-rise">
      <legend>Бюджет</legend>
      <p className="app-walk-hint">Только прогулка, без билетов и кафе</p>
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
          <span>Рубли</span>
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
    <fieldset className="app-walk-step app-walk-rise">
      <legend>Интересы</legend>
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
