// START_MODULE_CONTRACT
// PURPOSE: «Мы» groups list screen: active groups first, archived in a separate section, plus the create form (title + member checkboxes from the friend list).
// SCOPE: Data via apiClient.listWeGroups/createWeGroup/listFriends; presentational rendering; navigation to the group screen; inline validation error for an empty title.
// DEPENDS: ../api/client.js (apiClient), ../catalog/format.js (pluralRu), ../routing/router.js, @max-events/api-contracts (Friend, WeGroupScreen), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsState - union of the group list fetch states (loading / error / ready)
// - CreateDraft - create form state (title + checked member ids)
// - EMPTY_CREATE_DRAFT - initial create form state
// - createDraftErrors - inline validation errors (ru), empty list when ready
// - WeGroupCard - presentational group card with member count and status
// - WeGroupCreateForm - presentational create form with friend checkboxes
// - WeGroupsView - presentational: active list, archived section, create form toggle
// - WeGroupsPage - route container: loads groups and friends, wires creation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend, WeGroupSummary } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";

export type WeGroupsState = { status: "loading" } | { status: "error" } | { status: "ready"; groups: WeGroupSummary[] };

export interface CreateDraft {
  title: string;
  memberIds: string[];
}

export const EMPTY_CREATE_DRAFT: CreateDraft = { title: "", memberIds: [] };

export function createDraftErrors(draft: CreateDraft): string[] {
  return draft.title.trim() === "" ? ["Укажите название группы"] : [];
}

export function WeGroupCard({ screen, onOpen }: { screen: WeGroupSummary; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="app-card app-card--link" onClick={() => onOpen(screen.group.id)}>
      <div className="app-card-body">
        <span className="app-card-title">
          {screen.group.status === "archived" && <span className="app-micro-badge">Архив</span>} {screen.group.title}
        </span>
        <span className="app-card-subtitle">
          {screen.membersCount} {pluralRu(screen.membersCount, "участник", "участника", "участников")}
        </span>
        {screen.nextEventTitle !== null && <span className="app-card-subtitle">{screen.nextEventTitle}</span>}
        {screen.photosTotal > 0 && (
          <span className="app-card-subtitle">
            {screen.photosTotal} {pluralRu(screen.photosTotal, "фотография", "фотографии", "фотографий")}
          </span>
        )}
      </div>
      <span className="app-row-chevron" aria-hidden="true">
        <ActionIcon name="chevron" size={16} strokeWidth={2} />
      </span>
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
      className="app-profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.length === 0) onSubmit();
      }}
    >
      <input className="app-profile-input" type="text" aria-label="Название группы" placeholder="Название группы" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
      <ul className="app-plan-participants" aria-label="Участники">
        {friends.map((friend) => (
          <li key={friend.id} className="app-plan-participant">
            <label>
              <input type="checkbox" checked={draft.memberIds.includes(friend.id)} onChange={() => toggle(friend.id)} /> {friend.name}
            </label>
          </li>
        ))}
      </ul>
      {failed && <AppState error>Не удалось создать группу.</AppState>}
      <AppButton stretched disabled={saving} type="submit">
        Создать группу
      </AppButton>
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
  onToggleCreate: () => void;
  onDraftChange: (draft: CreateDraft) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
}

export function WeGroupsView({ state, friends, creating, draft, saving, failed, onToggleCreate, onDraftChange, onCreate, onOpen }: WeGroupsViewProps) {
  const groups = state.status === "ready" ? state.groups : [];
  const active = groups.filter((screen) => screen.group.status === "active");
  const archived = groups.filter((screen) => screen.group.status === "archived");
  return (
    <>
      {state.status === "loading" && <AppState>Загрузка…</AppState>}
      {state.status === "error" && <AppState error>Не удалось загрузить группы.</AppState>}
      {state.status === "ready" && groups.length === 0 && <AppState>Пока нет групп. Создайте первую.</AppState>}
      {active.map((screen) => (
        <WeGroupCard key={screen.group.id} screen={screen} onOpen={onOpen} />
      ))}
      {archived.length > 0 && (
        <>
          <p className="app-whereto-hint">Архив</p>
          {archived.map((screen) => (
            <WeGroupCard key={screen.group.id} screen={screen} onOpen={onOpen} />
          ))}
        </>
      )}
      <AppButton onClick={onToggleCreate} stretched tone="secondary">
        {creating ? "Скрыть" : "Создать"}
      </AppButton>
      {creating && <WeGroupCreateForm draft={draft} friends={friends} saving={saving} failed={failed} onChange={onDraftChange} onSubmit={onCreate} />}
    </>
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
      (screen) => navigate({ name: "we-group", id: screen.group.id }),
      () => {
        setSaving(false);
        setFailed(true);
      },
    );
  };

  return <WeGroupsView state={state} friends={friends} creating={creating} draft={draft} saving={saving} failed={failed} onToggleCreate={() => setCreating((value) => !value)} onDraftChange={setDraft} onCreate={create} onOpen={(id) => navigate({ name: "we-group", id })} />;
}
