// START_MODULE_CONTRACT
// PURPOSE: Organizer «Продвижение» tab — the cabinet mock: three launch rows, the campaign switch, and the running campaigns.
// SCOPE: The home screen from the mock, plus the feed, mailing and promo-code forms opened from those rows. Campaign cards on the home screen are the mock's own examples.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useState } from "react";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { useOrganizerNativeBack } from "./organizer-native-back";

export type PromoPane = "active" | "scheduled";
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
  { id: "feed", icon: "megaphone", tone: "blue", title: "Публикация в ленте", text: "Рассказать о событии", action: "Опубликовать" },
  { id: "mail", icon: "mail", tone: "blue", title: "Рассылка", text: "Сообщение участникам", action: "Создать рассылку" },
  { id: "code", icon: "percent", tone: "violet", title: "Промокод", text: "Скидка на билеты", action: "Создать" },
  { id: "campaign", icon: "target", tone: "blue", title: "Рекламная кампания", text: "Запустите таргетированную рекламу на вашу аудиторию", action: "Запустить" },
];

/** Rows on the promotion home screen, in the order the mock draws them. */
export const PROMO_HOME_TOOLS: PromoTool[] = ["feed", "mail", "code"];

export interface PromoCampaignCard {
  id: string;
  phase: PromoPane;
  tool: "feed" | "code";
  title: string;
  note: string | null;
  status: string | null;
  meta: string;
  cover: string | null;
  eventTitle: string;
  code: string;
  discount: string;
}

export const PROMO_CAMPAIGNS: PromoCampaignCard[] = [
  {
    id: "jazz-post",
    phase: "active",
    tool: "feed",
    title: "Публикация о вечере джаза",
    note: null,
    status: "Опубликована",
    meta: "124 перехода",
    cover: "/covers/promo-jazz.jpg",
    eventTitle: "Вечер джаза",
    code: "",
    discount: "",
  },
  {
    id: "jazz20",
    phase: "active",
    tool: "code",
    title: "JAZZ20",
    note: "Скидка 20%",
    status: null,
    meta: "12 оплаченных заказов",
    cover: null,
    eventTitle: "",
    code: "JAZZ20",
    discount: "20",
  },
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
    <section className="app-cab app-promo" aria-label={card?.title}>
      <button type="button" className="app-promo-back" onClick={onBack}>
        <ActionIcon name="undo" size={18} strokeWidth={2} />
        Назад
      </button>
      <h1 className="app-promo-title">{card?.title}</h1>
      <p className="app-promo-lead">{card?.text}</p>
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
      <button type="button" className="app-promo-submit" onClick={onSubmit}>
        {card?.action}
      </button>
    </section>
  );
}

export function OrganizerPromotion() {
  const [pane, setPane] = useState<PromoPane>("active");
  const [tool, setTool] = useState<PromoTool | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(EMPTY_PROMO_DRAFT);
  const [block, setBlock] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = PROMO_CAMPAIGNS.filter((card) => card.phase === pane);

  const openTool = (next: PromoTool, patch: Partial<PromoDraft> = {}) => {
    setBlock(null);
    setDraft({ ...EMPTY_PROMO_DRAFT, ...patch });
    setTool(next);
  };

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
    <section className="app-cab app-promo" aria-label="Продвижение">
      <h1 className="app-promo-title">Продвижение</h1>
      <div className="app-promo-list">
        {PROMO_HOME_TOOLS.map((id) => {
          const card = PROMO_TOOL_CARDS.find((item) => item.id === id);
          if (card === undefined) return null;
          return (
            <button key={card.id} type="button" className="app-promo-row" onClick={() => openTool(card.id)}>
              <span className={`app-promo-row-icon app-promo-row-icon--${card.tone}`} aria-hidden="true">
                <ActionIcon name={card.icon} size={22} strokeWidth={1.9} />
              </span>
              <span className="app-promo-row-copy">
                <span className="app-promo-row-title">{card.title}</span>
                <span className="app-promo-row-text">{card.text}</span>
              </span>
              <ActionIcon name="chevron" size={18} strokeWidth={2} />
            </button>
          );
        })}
      </div>
      <h2 className="app-promo-section">Мои кампании</h2>
      <div className="app-promo-switch" role="tablist" aria-label="Кампании">
        <button type="button" role="tab" aria-selected={pane === "active"} onClick={() => setPane("active")}>
          Активные
        </button>
        <button type="button" role="tab" aria-selected={pane === "scheduled"} onClick={() => setPane("scheduled")}>
          Запланированные
        </button>
      </div>
      {notice !== null && <p className="app-fin-notice">{notice}</p>}
      {visible.length === 0 ? (
        <p className="app-promo-empty">Нет запланированных кампаний</p>
      ) : (
        <div className="app-promo-list">
          {visible.map((card) => (
            <button
              key={card.id}
              type="button"
              className="app-promo-camp"
              onClick={() => openTool(card.tool, { eventTitle: card.eventTitle, code: card.code, discount: card.discount })}
            >
              {card.cover !== null ? (
                <img className="app-promo-camp-cover" src={card.cover} alt="" />
              ) : (
                <span className="app-promo-camp-mark" aria-hidden="true">
                  <ActionIcon name="percent" size={28} strokeWidth={2.2} />
                </span>
              )}
              <span className="app-promo-row-copy">
                <span className="app-promo-row-title">{card.title}</span>
                {card.status !== null && (
                  <span className="app-promo-badge">
                    <i aria-hidden="true">
                      <ActionIcon name="check" size={11} strokeWidth={3} />
                    </i>
                    {card.status}
                  </span>
                )}
                {card.note !== null && <span className="app-promo-note">{card.note}</span>}
                <span className="app-promo-meta">
                  <ActionIcon name="bars" size={14} strokeWidth={2} />
                  {card.meta}
                </span>
              </span>
              <ActionIcon name="chevron" size={18} strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
