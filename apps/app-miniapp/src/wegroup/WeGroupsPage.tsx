// START_MODULE_CONTRACT
// PURPOSE: Экран 30 «Мы»-группы: постоянные компании одним списком — заголовок с кнопкой «Создать», карточка на группу со сводкой и стеком участников, архив с датой, объяснение модели внизу.
// SCOPE: Data via apiClient.listWeGroups/createWeGroup/listFriends; presentational rendering; navigation to the group screen; the summary line is assembled on the client from the screen aggregate.
// DEPENDS: ../api/client.js (apiClient, WeGroupCard), ../catalog/format.js (pluralRu), ../routing/router.js, @max-events/api-contracts (Friend), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEEKDAY_ACCUSATIVE - ru weekday in the accusative, indexed by Date#getDay (backs «в четверг» and «на субботу»)
// - weekdayOn - «на субботу» — the day a dated route or event falls on
// - weekdayIn - «в четверг» / «во вторник» — the day one upcoming event falls on
// - formatRub - «14 200 ₽» with the ru thousands separator
// - weGroupMembersLabel - «5 участников»
// - weGroupArchivedLabel - «Архивирована 3 сентября»
// - weGroupSummary - the one line under a group title: what is ahead, then what the company already owns
// - WeGroupFaces - overlapping member initials; the names live in the label, so the stack is one image
// - WeGroupsState - union of the group list fetch states (loading / error / ready)
// - CreateDraft - create form state (title + checked member ids)
// - EMPTY_CREATE_DRAFT - initial create form state
// - createDraftErrors - inline validation errors (ru), empty list when ready
// - WeGroupCardRow - presentational group card: title with the archive badge, summary, member stack
// - WeGroupCreateForm - presentational create form with friend chips
// - WeGroupsView - presentational: topbar, active groups, archive section, the «Новая группа» explainer
// - WeGroupsPage - route container: loads groups and friends, wires creation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { apiClient, type WeGroupCard } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppSkeletonList, AppState } from "../ui/primitives";

/** Accusative, because both phrases of the design govern it: «Событие в четверг», «маршрут на субботу». */
export const WEEKDAY_ACCUSATIVE: readonly string[] = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];

export function weekdayOn(iso: string): string {
  return `на ${WEEKDAY_ACCUSATIVE[new Date(iso).getDay()]}`;
}

/** «во вторник» is the one form that takes the long preposition; everything else takes «в». */
export function weekdayIn(iso: string): string {
  const day = new Date(iso).getDay();
  return `${day === 2 ? "во" : "в"} ${WEEKDAY_ACCUSATIVE[day]}`;
}

export function formatRub(amountRub: number): string {
  return `${amountRub.toLocaleString("ru-RU")} ₽`;
}

export function weGroupMembersLabel(count: number): string {
  return `${count} ${pluralRu(count, "участник", "участника", "участников")}`;
}

export function weGroupArchivedLabel(archivedAt: string): string {
  return `Архивирована ${new Date(archivedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

/**
 * The line the design writes under every title: «3 события впереди · бюджет 14 200 ₽»,
 * «Событие в четверг · 62 фотографии», «2 места сохранено · маршрут на субботу».
 *
 * It is two facts, not a fixed pair of fields: first what the company is heading to (events, or the
 * places it saved when nothing is booked yet), then what it already owns (the agreed budget, the
 * photo album, the route). An archived group says only when it was archived — the rest is history.
 */
export function weGroupSummary(card: WeGroupCard, now: Date): string {
  const { group } = card;
  if (group.status === "archived") return weGroupArchivedLabel(group.archivedAt ?? group.updatedAt);
  const ahead = card.events.filter((event) => Date.parse(event.startsAt) >= now.getTime()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const facts: string[] = [];
  if (ahead.length > 1) facts.push(`${ahead.length} ${pluralRu(ahead.length, "событие", "события", "событий")} впереди`);
  else if (ahead.length === 1) facts.push(`Событие ${weekdayIn(ahead[0].startsAt)}`);
  else if (card.places.length > 0) facts.push(`${card.places.length} ${pluralRu(card.places.length, "место", "места", "мест")} сохранено`);
  if (card.budgetLimitRub !== null) facts.push(`бюджет ${formatRub(card.budgetLimitRub)}`);
  else if (card.photosTotal > 0) facts.push(`${card.photosTotal} ${pluralRu(card.photosTotal, "фотография", "фотографии", "фотографий")}`);
  else if (card.route !== null) facts.push(`маршрут ${card.route.points[0].at !== null ? weekdayOn(card.route.points[0].at) : "дня"}`);
  return facts.length > 0 ? facts.join(" · ") : "Пока пусто — добавьте событие или место";
}

/** Faces are decoration: the names are in the label, so assistive tech reads the stack as one image. */
export function WeGroupFaces({ members }: { members: Friend[] }) {
  return (
    <span className="app-we-faces" role="img" aria-label={members.map((member) => member.name).join(", ")}>
      {members.map((member) => (
        <span key={member.id} className="app-we-face">
          {member.name.charAt(0)}
        </span>
      ))}
    </span>
  );
}

export type WeGroupsState = { status: "loading" } | { status: "error" } | { status: "ready"; groups: WeGroupCard[] };

export interface CreateDraft {
  title: string;
  memberIds: string[];
}

export const EMPTY_CREATE_DRAFT: CreateDraft = { title: "", memberIds: [] };

export function createDraftErrors(draft: CreateDraft): string[] {
  return draft.title.trim() === "" ? ["Укажите название группы"] : [];
}

export function WeGroupCardRow({ card, now, onOpen }: { card: WeGroupCard; now: Date; onOpen: (id: string) => void }) {
  const { group } = card;
  return (
    <button type="button" className="app-we-card" onClick={() => onOpen(group.id)}>
      <span className="app-we-card-head">
        <span className="app-we-card-text">
          <span className="app-we-card-title">
            {group.title}
            {group.status === "archived" && <span className="app-we-card-badge">В архиве</span>}
          </span>
          <span className="app-we-card-summary">{weGroupSummary(card, now)}</span>
        </span>
        <span className="app-we-card-chevron" aria-hidden="true">
          <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
        </span>
      </span>
      {card.members.length > 0 && (
        <span className="app-we-card-foot">
          <WeGroupFaces members={card.members} />
          <span className="app-we-card-members">{weGroupMembersLabel(card.members.length)}</span>
        </span>
      )}
    </button>
  );
}

interface WeGroupCreateFormProps {
  draft: CreateDraft;
  friends: Friend[];
  saving: boolean;
  failed: boolean;
  onChange: (draft: CreateDraft) => void;
  onSubmit: () => void;
}

export function WeGroupCreateForm({ draft, friends, saving, failed, onChange, onSubmit }: WeGroupCreateFormProps) {
  const errors = createDraftErrors(draft);
  const toggle = (id: string) => onChange({ ...draft, memberIds: draft.memberIds.includes(id) ? draft.memberIds.filter((item) => item !== id) : [...draft.memberIds, id] });
  return (
    <form
      className="app-we-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.length === 0 && !saving) onSubmit();
      }}
    >
      <span className="app-we-form-label">Название</span>
      <input className="app-we-form-input" type="text" aria-label="Название группы" placeholder="Двор на Чистых" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
      <span className="app-we-form-label">Кто в компании</span>
      <div className="app-we-form-chips" role="group" aria-label="Участники">
        {friends.map((friend) => (
          <AppChip key={friend.id} pressed={draft.memberIds.includes(friend.id)} onClick={() => toggle(friend.id)}>
            {friend.name}
          </AppChip>
        ))}
      </div>
      {failed && <AppState error>Не удалось создать группу.</AppState>}
      <button type="submit" className="app-we-form-submit" disabled={saving || errors.length > 0}>
        {saving ? "Создаём…" : "Создать группу"}
      </button>
      {errors.length > 0 && <span className="app-we-form-why">{errors[0]}</span>}
    </form>
  );
}

interface WeGroupsViewProps {
  state: WeGroupsState;
  friends: Friend[];
  creating: boolean;
  draft: CreateDraft;
  saving: boolean;
  failed: boolean;
  /** Injected so the «что впереди» half of a summary is testable without freezing the clock. */
  now?: Date;
  onToggleCreate: () => void;
  onDraftChange: (draft: CreateDraft) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
}

export function WeGroupsView({ state, friends, creating, draft, saving, failed, now = new Date(), onToggleCreate, onDraftChange, onCreate, onOpen }: WeGroupsViewProps) {
  const groups = state.status === "ready" ? state.groups : [];
  const active = groups.filter((card) => card.group.status === "active");
  const archived = groups.filter((card) => card.group.status === "archived");
  return (
    <section className="app-we" aria-label="Группы «Мы»">
      <div className="app-we-bar">
        <h1 className="app-we-bar-title">Мы</h1>
        <button type="button" className="app-we-create" onClick={onToggleCreate} aria-expanded={creating}>
          <ActionIcon name={creating ? "close" : "plus"} size={16} strokeWidth={2.8} />
          {creating ? "Скрыть" : "Создать"}
        </button>
      </div>
      <p className="app-we-lead">Группа живёт дольше одного вечера: двор, коллеги, родительский чат. Для одного вечера есть план.</p>
      {creating && <WeGroupCreateForm draft={draft} friends={friends} saving={saving} failed={failed} onChange={onDraftChange} onSubmit={onCreate} />}
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && <AppState error>Не удалось загрузить группы.</AppState>}
      {state.status === "ready" && groups.length === 0 && <AppState>Пока нет групп. Создайте первую.</AppState>}
      {active.map((card) => (
        <WeGroupCardRow key={card.group.id} card={card} now={now} onOpen={onOpen} />
      ))}
      {archived.length > 0 && (
        <>
          <p className="app-we-section">Архив</p>
          {archived.map((card) => (
            <WeGroupCardRow key={card.group.id} card={card} now={now} onOpen={onOpen} />
          ))}
        </>
      )}
      <div className="app-we-note">
        <p className="app-we-note-title">Новая группа</p>
        <p className="app-we-note-text">Нужны только название и участники. Всё остальное — события, места, брони, бюджет, фотографии — появляется внутри.</p>
      </div>
    </section>
  );
}

export function WeGroupsPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<WeGroupsState>({ status: "loading" });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    Promise.all([apiClient.listWeGroups(), apiClient.listFriends()]).then(
      ([groups, friendList]) => {
        if (!alive) return;
        setState({ status: "ready", groups });
        setFriends(friendList);
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const create = () => {
    if (createDraftErrors(draft).length > 0) return;
    setSaving(true);
    setFailed(false);
    apiClient.createWeGroup({ title: draft.title.trim(), memberIds: draft.memberIds }).then(
      (card) => navigate({ name: "we-group", id: card.group.id }),
      () => {
        setSaving(false);
        setFailed(true);
      },
    );
  };

  return <WeGroupsView state={state} friends={friends} creating={creating} draft={draft} saving={saving} failed={failed} onToggleCreate={() => setCreating((value) => !value)} onDraftChange={setDraft} onCreate={create} onOpen={(id) => navigate({ name: "we-group", id })} />;
}
