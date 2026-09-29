// START_MODULE_CONTRACT
// PURPOSE: Organizer «Продвижение» tab — tools to launch a campaign, a feed post, a promo code and a mailing, plus the promotion counters from the cabinet mock.
// SCOPE: The tools/analytics switch, the four action forms and the three promotion counters. Numbers follow the mock; a finished form records the action on this screen.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useState } from "react";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { useOrganizerNativeBack } from "./organizer-native-back";

export type PromoPane = "tools" | "analytics";
export type PromoTool = "campaign" | "feed" | "code" | "mail";

interface PromoToolCard {
  id: PromoTool;
  icon: ActionIconName;
  tone: "blue" | "violet";
  title: string;
  text: string;
  action: string;
}

export const PROMO_TOOL_CARDS: PromoToolCard[] = [
  { id: "campaign", icon: "target", tone: "blue", title: "Рекламная кампания", text: "Запустите таргетированную рекламу на вашу аудиторию", action: "Запустить" },
  { id: "feed", icon: "share", tone: "blue", title: "Публикация в ленте", text: "Разместите событие в общей ленте пользователей", action: "Опубликовать" },
  { id: "code", icon: "tag", tone: "violet", title: "Промокоды", text: "Создавайте промокоды для привлечения новых гостей", action: "Создать" },
  { id: "mail", icon: "mail", tone: "violet", title: "Рассылка", text: "Отправьте персональное сообщение вашей аудитории", action: "Создать рассылку" },
];

export const PROMO_COUNTERS = [
  { id: "clicks", icon: "bars" as const, label: "Переходы по ссылкам", value: "1\u00a0248", delta: "+32%" },
  { id: "reach", icon: "eye" as const, label: "Охваты (лента)", value: "45\u00a0732", delta: "+28%" },
  { id: "subs", icon: "users" as const, label: "Подписчики", value: "362", delta: "+12%" },
];

const AUDIENCES = ["Все пользователи", "Были на событиях", "Подписчики"] as const;

export interface PromoDraft {
  name: string;
  audience: string;
  budget: string;
  eventTitle: string;
  code: string;
  discount: string;
  limit: string;
  message: string;
}

export const EMPTY_PROMO_DRAFT: PromoDraft = { name: "", audience: AUDIENCES[0], budget: "", eventTitle: "", code: "", discount: "", limit: "", message: "" };

export function promoToolBlock(tool: PromoTool, draft: PromoDraft): string | null {
  if (tool === "campaign") {
    if (draft.name.trim() === "") return "Укажите название кампании";
    if (!/^\d+$/.test(draft.budget.replace(/\s/g, "")) || Number(draft.budget.replace(/\s/g, "")) <= 0) return "Бюджет — целое число рублей";
  }
  if (tool === "feed" && draft.eventTitle.trim() === "") return "Укажите событие";
  if (tool === "code") {
    if (draft.code.trim() === "") return "Укажите код";
    const discount = Number(draft.discount);
    if (!/^\d+$/.test(draft.discount) || discount < 1 || discount > 100) return "Скидка — от 1 до 100%";
  }
  if (tool === "mail" && draft.message.trim() === "") return "Напишите текст рассылки";
  return null;
}

export function promoToolNotice(tool: PromoTool, draft: PromoDraft): string {
  if (tool === "campaign") return `Кампания «${draft.name.trim()}» запущена`;
  if (tool === "feed") return `«${draft.eventTitle.trim()}» опубликовано в ленте`;
  if (tool === "code") return `Промокод ${draft.code.trim().toUpperCase()} создан`;
  return "Рассылка создана";
}

function ToolForm({ tool, draft, block, onChange, onSubmit, onBack }: { tool: PromoTool; draft: PromoDraft; block: string | null; onChange: (patch: Partial<PromoDraft>) => void; onSubmit: () => void; onBack: () => void }) {
  const card = PROMO_TOOL_CARDS.find((item) => item.id === tool);
  useOrganizerNativeBack(true, onBack);
  return (
    <section className="app-cab" aria-label={card?.title}>
      <h1 className="app-cab-title">{card?.title}</h1>
      <p className="app-cab-lead">{card?.text}</p>
      {tool === "campaign" && (
        <>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Название</span>
            <input className="app-fin-field-input" value={draft.name} placeholder="Осенняя кампания" onChange={(change) => onChange({ name: change.target.value })} />
          </label>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Аудитория</span>
            <select className="app-fin-field-input" aria-label="Аудитория" value={draft.audience} onChange={(change) => onChange({ audience: change.target.value })}>
              {AUDIENCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Бюджет, ₽</span>
            <input className="app-fin-field-input" inputMode="numeric" value={draft.budget} placeholder="15000" onChange={(change) => onChange({ budget: change.target.value })} />
          </label>
        </>
      )}
      {tool === "feed" && (
        <label className="app-fin-field">
          <span className="app-fin-field-label">Событие</span>
          <input className="app-fin-field-input" value={draft.eventTitle} placeholder="Вечер джаза на Патриарших" onChange={(change) => onChange({ eventTitle: change.target.value })} />
        </label>
      )}
      {tool === "code" && (
        <>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Код</span>
            <input className="app-fin-field-input" value={draft.code} placeholder="ОСЕНЬ2027" onChange={(change) => onChange({ code: change.target.value })} />
          </label>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Скидка, %</span>
            <input className="app-fin-field-input" inputMode="numeric" value={draft.discount} placeholder="20" onChange={(change) => onChange({ discount: change.target.value })} />
          </label>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Лимит использований</span>
            <input className="app-fin-field-input" inputMode="numeric" value={draft.limit} placeholder="100" onChange={(change) => onChange({ limit: change.target.value })} />
          </label>
        </>
      )}
      {tool === "mail" && (
        <>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Кому</span>
            <select className="app-fin-field-input" aria-label="Кому" value={draft.audience} onChange={(change) => onChange({ audience: change.target.value })}>
              {AUDIENCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="app-fin-field">
            <span className="app-fin-field-label">Сообщение</span>
            <textarea className="app-fin-field-input app-cab-area" rows={4} value={draft.message} placeholder="Завтра в 19:00 — вечер джаза" onChange={(change) => onChange({ message: change.target.value })} />
          </label>
        </>
      )}
      {block !== null && <p className="app-fin-block">{block}</p>}
      <button type="button" className="app-fin-withdraw" onClick={onSubmit}>
        {card?.action}
      </button>
    </section>
  );
}

export function OrganizerPromotion() {
  const [pane, setPane] = useState<PromoPane>("tools");
  const [tool, setTool] = useState<PromoTool | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(EMPTY_PROMO_DRAFT);
  const [block, setBlock] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () => {
    if (tool === null) return;
    const reason = promoToolBlock(tool, draft);
    if (reason !== null) {
      setBlock(reason);
      return;
    }
    setNotice(promoToolNotice(tool, draft));
    setDraft(EMPTY_PROMO_DRAFT);
    setBlock(null);
    setTool(null);
  };

  if (tool !== null) {
    return (
      <ToolForm
        tool={tool}
        draft={draft}
        block={block}
        onChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
          setBlock(null);
        }}
        onSubmit={submit}
        onBack={() => {
          setTool(null);
          setBlock(null);
        }}
      />
    );
  }

  return (
    <section className="app-cab" aria-label="Продвижение">
      <header className="app-cab-head">
        <div>
          <h1 className="app-cab-title">Продвижение</h1>
          <p className="app-cab-lead">Продвигайте свои события и привлекайте больше гостей</p>
        </div>
      </header>
      <div className="app-cab-panes" role="tablist" aria-label="Раздел продвижения">
        <button type="button" role="tab" aria-selected={pane === "tools"} className={pane === "tools" ? "app-cab-pane app-cab-pane--on" : "app-cab-pane"} onClick={() => setPane("tools")}>
          Инструменты
        </button>
        <button type="button" role="tab" aria-selected={pane === "analytics"} className={pane === "analytics" ? "app-cab-pane app-cab-pane--on" : "app-cab-pane"} onClick={() => setPane("analytics")}>
          Аналитика
        </button>
      </div>
      {notice !== null && <p className="app-fin-notice">{notice}</p>}
      {pane === "tools" && (
        <>
          <h2 className="app-cab-section">Реклама и охваты</h2>
          {PROMO_TOOL_CARDS.map((card) => (
            <article key={card.id} className="app-cab-tool">
              <span className={`app-cab-tool-icon app-cab-tool-icon--${card.tone}`} aria-hidden="true">
                <ActionIcon name={card.icon} size={20} strokeWidth={2} />
              </span>
              <h3 className="app-cab-tool-title">{card.title}</h3>
              <p className="app-cab-tool-text">{card.text}</p>
              <button
                type="button"
                className="app-cab-tool-action"
                onClick={() => {
                  setBlock(null);
                  setTool(card.id);
                }}
              >
                {card.action}
              </button>
            </article>
          ))}
        </>
      )}
      <h2 className="app-cab-section">{pane === "tools" ? "Статистика продвижения" : "Аналитика продвижения"}</h2>
      <ul className={pane === "analytics" ? "app-cab-stats app-cab-stats--stack" : "app-cab-stats"}>
        {PROMO_COUNTERS.map((row) => (
          <li key={row.id}>
            <span>
              <span className="app-cab-stat-label">{row.label}</span>
              <span className="app-cab-stat-value">
                {row.value} <em>{row.delta}</em>
              </span>
            </span>
            <span className="app-cab-stat-icon" aria-hidden="true">
              <ActionIcon name={row.icon} size={18} strokeWidth={2} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
