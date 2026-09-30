// START_MODULE_CONTRACT
// PURPOSE: Organizer «Продвижение» tab — the cabinet mock: launch rows, campaigns, the promo-code list and the new-code form.
// SCOPE: The home screen, the feed and mailing forms, and the promo-code screens opened from «Промокод». Code rows and the create form follow the cabinet mocks.
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
  discountKind: string;
  period: string;
  limitMode: string;
  allTickets: boolean;
  limit: string;
  message: string;
}

export const EMPTY_PROMO_DRAFT: PromoDraft = {
  name: "",
  audience: AUDIENCES[0],
  budget: "",
  eventTitle: "",
  code: "",
  discount: "",
  discountKind: "Процент",
  period: "",
  limitMode: "Без ограничений",
  allTickets: true,
  limit: "",
  message: "",
};

/** The filled «Новый промокод» screen from the cabinet mock. */
export const CODE_FORM_DRAFT: PromoDraft = {
  ...EMPTY_PROMO_DRAFT,
  code: "SUMMER2025",
  discount: "20",
  discountKind: "Процент",
  period: "01.08.2025 — 31.08.2025",
  limitMode: "Без ограничений",
  allTickets: true,
};

export type PromoCodePhase = "active" | "archived";

export interface PromoCodeRow {
  id: string;
  phase: PromoCodePhase;
  code: string;
  detail: string;
  uses: string;
  delta: string;
}

export const PROMO_CODE_ROWS: PromoCodeRow[] = [
  { id: "summer", phase: "active", code: "SUMMER2025", detail: "Скидка 20% · до 31.08.2025", uses: "90 использований", delta: "+24%" },
  { id: "friends", phase: "active", code: "FRIENDS15", detail: "Скидка 15% · до 15.09.2025", uses: "45 использований", delta: "+12%" },
  { id: "jazz", phase: "active", code: "JAZZ10", detail: "Скидка 10% · до 30.09.2025", uses: "16 использований", delta: "+8%" },
];

const DISCOUNT_KINDS = ["Процент", "Фиксированная сумма"] as const;
const PROMO_EVENTS = ["Вечер джаза", "Органный вечер в соборе", "Стендап в Stand Up Store"] as const;
const LIMIT_MODES = ["Без ограничений", "50", "100", "500"] as const;

export function promoToolBlock(tool: PromoTool, draft: PromoDraft): string | null {
  if (tool === "campaign") {
    if (draft.name.trim() === "") return "Укажите название кампании";
    if (!/^\d+$/.test(draft.budget.replace(/\s/g, "")) || Number(draft.budget.replace(/\s/g, "")) <= 0) return "Бюджет — целое число рублей";
  }
  if (tool === "feed" && draft.eventTitle.trim() === "") return "Укажите событие";
  if (tool === "code") {
    if (draft.code.trim() === "") return "Укажите код";
    const discount = Number(draft.discount);
    if (draft.discountKind === "Процент") {
      if (!/^\d+$/.test(draft.discount) || discount < 1 || discount > 100) return "Скидка — от 1 до 100%";
    } else if (!/^\d+$/.test(draft.discount) || discount <= 0) return "Укажите размер скидки";
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

export function PromoCodesScreen({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  const [phase, setPhase] = useState<PromoCodePhase>("active");
  const rows = PROMO_CODE_ROWS.filter((row) => row.phase === phase);
  useOrganizerNativeBack(true, onBack);
  return (
    <section className="app-cab app-promo app-pcodes" aria-label="Промокоды">
      <header className="app-pcodes-bar">
        <button type="button" className="app-pcodes-iconbtn" aria-label="Назад" onClick={onBack}>
          <span className="app-pcodes-back-icon">
            <ActionIcon name="chevron" size={22} strokeWidth={2.1} />
          </span>
        </button>
        <h1 className="app-pcodes-title">Промокоды</h1>
        <button type="button" className="app-pcodes-iconbtn" aria-label="Создать промокод" onClick={onCreate}>
          <ActionIcon name="plus" size={22} strokeWidth={2.1} />
        </button>
      </header>
      <div className="app-pcodes-tabs" role="tablist" aria-label="Промокоды">
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
            <ActionIcon name="percent" size={22} strokeWidth={2.2} />
          </span>
          <p>Создавайте промокоды и привлекайте больше гостей на ваши события!</p>
        </div>
        <button type="button" className="app-pcodes-hero-btn" onClick={onCreate}>
          Создать промокод
        </button>
      </div>
      <h2 className="app-pcodes-list-title">Список промокодов</h2>
      {rows.length === 0 ? (
        <p className="app-promo-empty">Нет архивных промокодов</p>
      ) : (
        <div className="app-promo-list">
          {rows.map((row) => (
            <article key={row.id} className="app-pcodes-card">
              <span className="app-pcodes-mark" aria-hidden="true">
                <ActionIcon name="percent" size={22} strokeWidth={2.2} />
              </span>
              <span className="app-promo-row-copy">
                <span className="app-pcodes-code">{row.code}</span>
                <span className="app-pcodes-detail">{row.detail}</span>
                <span className="app-pcodes-uses">
                  {row.uses} <em>↑ {row.delta}</em>
                </span>
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PromoCodeCreate({ draft, block, onChange, onSubmit, onBack }: { draft: PromoDraft; block: string | null; onChange: (patch: Partial<PromoDraft>) => void; onSubmit: () => void; onBack: () => void }) {
  useOrganizerNativeBack(true, onBack);
  const amountLabel = draft.discountKind === "Процент" ? "Размер скидки, %" : "Размер скидки, ₽";
  return (
    <section className="app-cab app-promo app-pcodes" aria-label="Новый промокод">
      <header className="app-pcodes-bar">
        <button type="button" className="app-pcodes-iconbtn" aria-label="Назад" onClick={onBack}>
          <span className="app-pcodes-back-icon">
            <ActionIcon name="chevron" size={22} strokeWidth={2.1} />
          </span>
        </button>
        <h1 className="app-pcodes-title">Новый промокод</h1>
        <span className="app-pcodes-iconbtn" aria-hidden="true" />
      </header>
      <label className="app-pcodes-field">
        <span>Название промокода</span>
        <input className="app-pcodes-input" value={draft.code} onChange={(change) => onChange({ code: change.target.value })} />
      </label>
      <div className="app-pcodes-pair">
        <label className="app-pcodes-field">
          <span>Тип скидки</span>
          <span className="app-pcodes-control">
            <select aria-label="Тип скидки" value={draft.discountKind} onChange={(change) => onChange({ discountKind: change.target.value })}>
              {DISCOUNT_KINDS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ActionIcon name="chevron" size={16} strokeWidth={2.2} />
          </span>
        </label>
        <label className="app-pcodes-field">
          <span>{amountLabel}</span>
          <input className="app-pcodes-input" inputMode="numeric" value={draft.discount} onChange={(change) => onChange({ discount: change.target.value })} />
        </label>
      </div>
      <label className="app-pcodes-field">
        <span>События</span>
        <span className={draft.eventTitle === "" ? "app-pcodes-control app-pcodes-control--placeholder" : "app-pcodes-control"}>
          <select aria-label="События" value={draft.eventTitle} onChange={(change) => onChange({ eventTitle: change.target.value })}>
            <option value="">Выберите событие</option>
            {PROMO_EVENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ActionIcon name="chevron" size={16} strokeWidth={2.2} />
        </span>
      </label>
      <label className="app-pcodes-field">
        <span>Период действия</span>
        <span className="app-pcodes-control app-pcodes-control--icon">
          <ActionIcon name="calendar" size={18} strokeWidth={1.9} />
          <input aria-label="Период действия" value={draft.period} onChange={(change) => onChange({ period: change.target.value })} />
        </span>
      </label>
      <label className="app-pcodes-field">
        <span>Лимит использований</span>
        <span className="app-pcodes-control">
          <select aria-label="Лимит использований" value={draft.limitMode} onChange={(change) => onChange({ limitMode: change.target.value })}>
            {LIMIT_MODES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ActionIcon name="chevron" size={16} strokeWidth={2.2} />
        </span>
      </label>
      <div className="app-pcodes-toggle-row">
        <span>Применять ко всем билетам</span>
        <button type="button" role="switch" aria-checked={draft.allTickets} aria-label="Применять ко всем билетам" className={draft.allTickets ? "app-pcodes-switch app-pcodes-switch--on" : "app-pcodes-switch"} onClick={() => onChange({ allTickets: !draft.allTickets })}>
          <i />
        </button>
      </div>
      {block !== null && <p className="app-fin-block">{block}</p>}
      <button type="button" className="app-pcodes-submit" onClick={onSubmit}>
        Создать промокод
      </button>
    </section>
  );
}

export function OrganizerPromotion() {
  const [pane, setPane] = useState<PromoPane>("active");
  const [codes, setCodes] = useState<null | "list" | "form">(null);
  const [tool, setTool] = useState<PromoTool | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(EMPTY_PROMO_DRAFT);
  const [block, setBlock] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = PROMO_CAMPAIGNS.filter((card) => card.phase === pane);

  const openTool = (next: PromoTool, patch: Partial<PromoDraft> = {}) => {
    setBlock(null);
    if (next === "code") {
      setCodes("list");
      return;
    }
    setDraft({ ...EMPTY_PROMO_DRAFT, ...patch });
    setTool(next);
  };

  const openCodeForm = () => {
    setBlock(null);
    setDraft(CODE_FORM_DRAFT);
    setCodes("form");
  };

  const submit = () => {
    const active = codes === "form" ? "code" : tool;
    if (active === null) return;
    const reason = promoToolBlock(active, draft);
    if (reason !== null) {
      setBlock(reason);
      return;
    }
    setDraft(EMPTY_PROMO_DRAFT);
    setBlock(null);
    if (codes === "form") {
      setCodes("list");
      return;
    }
    setNotice(promoToolNotice(active, draft));
    setTool(null);
  };

  if (codes === "form") {
    return (
      <PromoCodeCreate
        draft={draft}
        block={block}
        onChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
          setBlock(null);
        }}
        onSubmit={submit}
        onBack={() => {
          setCodes("list");
          setBlock(null);
        }}
      />
    );
  }

  if (codes === "list") {
    return <PromoCodesScreen onBack={() => setCodes(null)} onCreate={openCodeForm} />;
  }

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
