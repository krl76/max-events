// START_MODULE_CONTRACT
// PURPOSE: «Мы» group screen: members, bound events/places with CTAs, group chat link, route/budget/photos blocks when present, event/place pickers and owner archive.
// SCOPE: Data via apiClient.getWeGroup/addWeGroupEvent/addWeGroupPlace/archiveWeGroup plus listEvents/listPlaces for the pickers; writes replace the screen with the returned aggregate; presentational rendering; money values come from the API budget aggregate only.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js (useAuth), ../routing/router.js, ../route/DayRoutePage.js (RouteTimeline), @max-events/api-contracts (PlanBudget, WeGroupScreen), ../max/bridge.js (openExternalLink), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupState - union of the screen fetch states (loading / error / forbidden / ready)
// - nameOf - member id -> display name («Ты» for the demo/owner id fallback, «Участник» for unknown)
// - WeGroupBudgetSummary - presentational compact budget: total, per-person shares, who owes whom
// - WeGroupPicker - presentational catalog picker for binding an event/place
// - WeGroupView - presentational screen: header, members, events, places, chat link, route, budget, photos, archive
// - WeGroupPage - route container: loads the screen, wires pickers and archive
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, Place, PlanBudget, WeGroupScreen } from "@max-events/api-contracts";
import { apiClient, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RouteTimeline } from "../route/DayRoutePage";
import { useRoute } from "../routing/router";
import { openExternalLink } from "../max/bridge";
import { AppButton, AppTitle } from "../ui/primitives";

export type WeGroupState = { status: "loading" } | { status: "error" } | { status: "forbidden" } | { status: "ready"; screen: WeGroupScreen };

export function nameOf(members: WeGroupScreen["members"], userId: string, ownId: string | null): string {
  if (ownId !== null && userId === ownId) return "Ты";
  return members.find((member) => member.id === userId)?.name ?? "Участник";
}

export function WeGroupBudgetSummary({ budget, members, ownId }: { budget: PlanBudget; members: WeGroupScreen["members"]; ownId: string | null }) {
  return (
    <section className="app-plan" aria-label="Бюджет группы">
      <p className="app-card-title">Бюджет</p>
      <p className="app-card-subtitle">Итого {budget.totalRub} ₽</p>
      <ul className="app-plan-participants">
        {budget.perPerson.map((person) => (
          <li key={person.userId} className="app-plan-participant">
            <span className="app-plan-friend-name">{nameOf(members, person.userId, ownId)}</span>
            <span className="app-card-subtitle">доля {person.shareRub} ₽</span>
          </li>
        ))}
      </ul>
      {budget.debts.length > 0 && (
        <ul className="app-plan-participants" aria-label="Долги">
          {budget.debts.map((debt) => (
            <li key={`${debt.fromUserId}-${debt.toUserId}`} className="app-plan-participant">
              {nameOf(members, debt.fromUserId, ownId)} → {nameOf(members, debt.toUserId, ownId)} {debt.amountRub} ₽
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface WeGroupPickerProps {
  title: string;
  options: { id: string; label: string }[];
  loading: boolean;
  failed: boolean;
  onPick: (id: string) => void;
}

export function WeGroupPicker({ title, options, loading, failed, onPick }: WeGroupPickerProps) {
  return (
    <section aria-label={title}>
      {loading && <p className="app-state">Загружаем каталог…</p>}
      {failed && <p className="app-state app-state--error">Не удалось добавить.</p>}
      {!loading && options.length === 0 && <p className="app-state">Нечего добавить.</p>}
      <ul className="app-plan-participants">
        {options.map((option) => (
          <li key={option.id} className="app-plan-participant">
            <button type="button" className="app-card-subtitle" onClick={() => onPick(option.id)}>
              + {option.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type PickerKind = "event" | "place" | null;

interface WeGroupViewProps {
  state: WeGroupState;
  ownId: string | null;
  picker: PickerKind;
  pickerOptions: { id: string; label: string }[];
  pickerLoading: boolean;
  actionFailed: boolean;
  onTogglePicker: (kind: Exclude<PickerKind, null>) => void;
  onPick: (id: string) => void;
  onArchive: () => void;
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
}

export function WeGroupView({ state, ownId, picker, pickerOptions, pickerLoading, actionFailed, onTogglePicker, onPick, onArchive, onOpenEvent, onOpenPlace }: WeGroupViewProps) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "forbidden") return <p className="app-state app-state--error">Нет доступа к группе.</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить группу.</p>;
  const { screen } = state;
  const { group } = screen;
  const isOwner = ownId !== null && group.ownerUserId === ownId;
  const isActive = group.status === "active";
  return (
    <>
      <AppTitle asChild>
        <h2 className="app-section-title">{group.title}</h2>
      </AppTitle>
      {group.status === "archived" && <p className="app-state">Группа в архиве.</p>}
      <ul className="app-plan-participants" aria-label="Участники">
        {screen.members.map((member) => (
          <li key={member.id} className="app-plan-participant">
            <span className="app-plan-friend-name">{nameOf(screen.members, member.id, ownId)}</span>
          </li>
        ))}
      </ul>
      {group.chatLink !== null && (
        <p>
          <button type="button" className="app-card-subtitle" onClick={() => openExternalLink(group.chatLink!)}>
            Чат группы
          </button>
        </p>
      )}
      {screen.events.length > 0 && (
        <ul className="app-plan-participants" aria-label="События группы">
          {screen.events.map((event) => (
            <li key={event.id} className="app-plan-participant">
              <button type="button" className="app-plan-event" onClick={() => onOpenEvent(event.id)}>
                {event.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {screen.places.length > 0 && (
        <ul className="app-plan-participants" aria-label="Места группы">
          {screen.places.map((place) => (
            <li key={place.id} className="app-plan-participant">
              <button type="button" className="app-plan-event" onClick={() => onOpenPlace(place.id)}>
                {place.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {screen.route !== null && (
        <section aria-label="Маршрут группы">
          <p className="app-card-title">Маршрут</p>
          <RouteTimeline route={screen.route} />
        </section>
      )}
      {screen.budget !== null && <WeGroupBudgetSummary budget={screen.budget} members={screen.members} ownId={ownId} />}
      {screen.photos.length > 0 && (
        <ul className="app-plan-participants" aria-label="Фото группы">
          {screen.photos.map((photo) => (
            <li key={photo.url} className="app-plan-participant">
              <img src={photo.url} alt="Фото группы" />
            </li>
          ))}
        </ul>
      )}
      {isActive && (
        <>
          <AppButton onClick={() => onTogglePicker("event")} stretched tone="secondary">
            Добавить событие
          </AppButton>
          <AppButton onClick={() => onTogglePicker("place")} stretched tone="secondary">
            Добавить место
          </AppButton>
          {picker !== null && <WeGroupPicker title={picker === "event" ? "События" : "Места"} options={pickerOptions} loading={pickerLoading} failed={actionFailed} onPick={onPick} />}
        </>
      )}
      {isOwner && isActive && (
        <AppButton onClick={onArchive} stretched tone="ghost">
          Архивировать
        </AppButton>
      )}
      {actionFailed && picker === null && <p className="app-state app-state--error">Действие не удалось.</p>}
    </>
  );
}

export function WeGroupPage({ id }: { id: string }) {
  const { navigate } = useRoute();
  const auth = useAuth();
  const ownId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<WeGroupState>({ status: "loading" });
  const [picker, setPicker] = useState<PickerKind>(null);
  const [catalog, setCatalog] = useState<{ events: Event[]; places: Place[] } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getWeGroup(id).then(
      (screen) => {
        if (alive) setState({ status: "ready", screen });
      },
      (error) => {
        if (!alive) return;
        setState(error instanceof ApiError && error.status === 403 ? { status: "forbidden" } : { status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const apply = (screen: WeGroupScreen) => {
    setState({ status: "ready", screen });
    setPicker(null);
    setActionFailed(false);
  };

  const fail = () => setActionFailed(true);

  const togglePicker = (kind: Exclude<PickerKind, null>) => {
    setActionFailed(false);
    if (picker === kind) {
      setPicker(null);
      return;
    }
    setPicker(kind);
    if (catalog !== null) return;
    setPickerLoading(true);
    Promise.all([apiClient.listEvents(), apiClient.listPlaces()]).then(
      ([events, places]) => {
        setCatalog({ events, places });
        setPickerLoading(false);
      },
      () => {
        setPickerLoading(false);
        setActionFailed(true);
      },
    );
  };

  const boundIds = (): { events: Set<string>; places: Set<string> } => {
    if (state.status !== "ready") return { events: new Set(), places: new Set() };
    return { events: new Set(state.screen.events.map((item) => item.id)), places: new Set(state.screen.places.map((item) => item.id)) };
  };

  const pickerOptions = (): { id: string; label: string }[] => {
    if (catalog === null || picker === null) return [];
    const bound = boundIds();
    if (picker === "event") return catalog.events.filter((item) => !bound.events.has(item.id)).map((item) => ({ id: item.id, label: item.title }));
    return catalog.places.filter((item) => !bound.places.has(item.id)).map((item) => ({ id: item.id, label: item.title }));
  };

  const pick = (itemId: string) => {
    if (picker === null) return;
    const request = picker === "event" ? apiClient.addWeGroupEvent(id, itemId) : apiClient.addWeGroupPlace(id, itemId);
    request.then(apply, fail);
  };

  const archive = () => {
    apiClient.archiveWeGroup(id).then(apply, fail);
  };

  return <WeGroupView state={state} ownId={ownId} picker={picker} pickerOptions={pickerOptions()} pickerLoading={pickerLoading} actionFailed={actionFailed} onTogglePicker={togglePicker} onPick={pick} onArchive={archive} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} />;
}
