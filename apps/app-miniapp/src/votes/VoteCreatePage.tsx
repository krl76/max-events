// START_MODULE_CONTRACT
// PURPOSE: Экран 32 «Создание голосования»: название, варианты чекбоксами с счётчиком «выбрано 3 из 10», ряд друзей-аватаров, плашка про чат в MAX и кнопка запуска, неактивная пока условия не выполнены.
// SCOPE: VoteCreateView (presentational) + VoteCreateSection (embedded in the whereto wizard) + VoteCreatePage (маршрут vote-new, из группы приходит её id); ограничения 2..10 вариантов и минимум один друг проверяются здесь и повторяются контрактом CreateVoteWriteSchema.
// DEPENDS: ../api/client.js (apiClient, VoteScreen), ../auth/AuthContext.js (useAuth), ./format.js (voteOptionMeta), ../catalog/format.js (pluralRu), ../routing/router.js, @max-events/api-contracts (Event, Friend), ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VOTE_MIN_OPTIONS - two: a vote with one option is not a vote (CreateVoteWriteSchema parity)
// - VOTE_MAX_OPTIONS - ten: the ceiling the design counts up to and the contract enforces
// - voteCreateReady - create form validity: non-empty title, 2..10 events, >=1 friend
// - voteCreateBlockers - ru reasons the launch button is inactive, in the order the form should be filled
// - voteOptionsCounter - «выбрано 3 из 10»
// - voteFriendsCounter - «4 друга»
// - voteInviteNote - the MAX line under the roster: how many invitations the chat card will carry
// - VoteCreateView - presentational form: title, option rows, «Добавить событие», friend roster, MAX note, launch footer
// - VoteCreateSection - container: loads friends, adds catalog events on demand, creates the vote
// - VoteCreatePage - маршрут vote-new: шапка с названием, варианты и участники группы, если экран открыт из неё
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, Friend } from "@max-events/api-contracts";
import { apiClient, type VoteScreen } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { PersonAvatar } from "../friends/avatar";
import { useRoute } from "../routing/router";
import { EventPicker } from "../ui/EventPicker";
import { FriendPicker } from "../ui/FriendPicker";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { voteOptionMeta } from "./format";

export const VOTE_MIN_OPTIONS = 2;
export const VOTE_MAX_OPTIONS = 10;

export function voteCreateReady(title: string, eventIds: string[], friendIds: string[]): boolean {
  return voteCreateBlockers(title, eventIds, friendIds).length === 0;
}

/**
 * Why the launch button is inactive, in the order the form is filled. The design puts the rule in the
 * caption — «От 2 до 10 событий, друзья из списка» — and a button that refuses without saying why is
 * the thing that caption exists to prevent.
 */
export function voteCreateBlockers(title: string, eventIds: string[], friendIds: string[]): string[] {
  const blockers: string[] = [];
  if (title.trim() === "") blockers.push("Задай вопрос голосования");
  if (eventIds.length < VOTE_MIN_OPTIONS) blockers.push(`Выбери хотя бы ${VOTE_MIN_OPTIONS} варианта`);
  if (eventIds.length > VOTE_MAX_OPTIONS) blockers.push(`Вариантов не больше ${VOTE_MAX_OPTIONS}`);
  if (friendIds.length === 0) blockers.push("Позови хотя бы одного друга");
  return blockers;
}

export function voteOptionsCounter(selected: number): string {
  return `выбрано ${selected} из ${VOTE_MAX_OPTIONS}`;
}

export function voteFriendsCounter(count: number): string {
  return `${count} ${pluralRu(count, "друг", "друга", "друзей")}`;
}

/** Collective numerals in the dative, the case «приглашения уйдут всем …» governs. */
const COLLECTIVE_DATIVE_RU: readonly string[] = ["", "", "двоим", "троим", "четверым", "пятерым", "шестерым", "семерым"];

export function voteInviteNote(count: number): string {
  if (count === 0) return "При создании откроется чат в MAX — осталось выбрать, кто голосует.";
  if (count === 1) return "При создании откроется чат в MAX, приглашение уйдёт выбранному другу.";
  return `При создании откроется чат в MAX, приглашения уйдут всем ${COLLECTIVE_DATIVE_RU[count] ?? count}.`;
}

interface VoteCreateViewProps {
  events: Event[];
  friends: Friend[];
  catalog: Event[];
  title: string;
  selectedEvents: string[];
  selectedFriends: string[];
  pickingEvents: boolean;
  pickingFriends: boolean;
  catalogLoading: boolean;
  submitting: boolean;
  failed: boolean;
  cancelLabel: string | null;
  onTitle: (title: string) => void;
  onRemoveEvent: (id: string) => void;
  onOpenCatalog: () => void;
  onCloseCatalog: () => void;
  onConfirmEvents: (ids: string[]) => void;
  onOpenFriends: () => void;
  onCloseFriends: () => void;
  onConfirmFriends: (ids: string[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function VoteCreateView({
  events,
  friends,
  catalog,
  title,
  selectedEvents,
  selectedFriends,
  pickingEvents,
  pickingFriends,
  catalogLoading,
  submitting,
  failed,
  cancelLabel,
  onTitle,
  onRemoveEvent,
  onOpenCatalog,
  onCloseCatalog,
  onConfirmEvents,
  onOpenFriends,
  onCloseFriends,
  onConfirmFriends,
  onSubmit,
  onCancel,
}: VoteCreateViewProps) {
  const blockers = voteCreateBlockers(title, selectedEvents, selectedFriends);
  const pickedEvents = events.filter((event) => selectedEvents.includes(event.id));
  const pickedFriends = friends.filter((friend) => selectedFriends.includes(friend.id));
  return (
    <section className="app-poll-new" aria-label="Новое голосование">
      <label className="app-poll-new-label" htmlFor="app-poll-new-title">
        Название
      </label>
      <input id="app-poll-new-title" className="app-poll-new-title" value={title} placeholder="Куда идем в пятницу?" onChange={(change) => onTitle(change.target.value)} />

      <div className="app-we-block-head">
        <h2 className="app-we-block-title">Варианты</h2>
        <span className="app-we-block-count">{voteOptionsCounter(selectedEvents.length)}</span>
      </div>
      <p className="app-poll-hint">Можно выбрать от {VOTE_MIN_OPTIONS} до {VOTE_MAX_OPTIONS} событий.</p>
      {pickedEvents.map((event) => (
        <button type="button" key={event.id} className="app-poll-option app-poll-option--on" onClick={() => onRemoveEvent(event.id)}>
          <span className="app-poll-check" aria-hidden="true">
            <ActionIcon name="check" size={12} strokeWidth={3.4} />
          </span>
          <AppMedia category={event.category} src={pictured(event.id, event.coverUrl)} className="app-poll-option-media" />
          <span className="app-poll-option-text">
            <span className="app-poll-option-title">{event.title}</span>
            <span className="app-poll-option-meta">{voteOptionMeta(event)}</span>
          </span>
        </button>
      ))}
      <button type="button" className="app-poll-more" disabled={catalogLoading} onClick={onOpenCatalog}>
        <ActionIcon name="plus" size={16} strokeWidth={2.8} />
        {catalogLoading ? "Загружаем афишу…" : selectedEvents.length === 0 ? "Выбрать события" : "Изменить события"}
      </button>

      <div className="app-we-block-head">
        <h2 className="app-we-block-title">Кто голосует</h2>
        <span className="app-we-block-count">{voteFriendsCounter(selectedFriends.length)}</span>
      </div>
      <ul className="app-we-form-people" aria-label="Кто голосует">
        {pickedFriends.map((friend) => (
          <li key={friend.id} className="app-we-form-person">
            {friend.avatarUrl ? <img className="app-fpick-avatar" src={friend.avatarUrl} alt="" /> : <PersonAvatar id={friend.id} name={friend.name} size={36} />}
            <span className="app-fpick-name">{friend.name}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="app-poll-more" onClick={onOpenFriends}>
        <ActionIcon name="plus" size={16} strokeWidth={2.8} />
        {selectedFriends.length === 0 ? "Выбрать друзей" : "Изменить участников"}
      </button>

      <p className="app-poll-max">
        <span className="app-poll-max-mark" aria-hidden="true">
          M
        </span>
        <span className="app-poll-max-text">{voteInviteNote(selectedFriends.length)}</span>
      </p>

      {failed && <AppState error>Не удалось создать голосование.</AppState>}

      <div className="app-poll-foot">
        {blockers.length > 0 && <p className="app-poll-foot-why">{blockers[0]}</p>}
        <button type="button" className="app-poll-launch" disabled={blockers.length > 0 || submitting} onClick={onSubmit}>
          {submitting ? "Создаём…" : "Запустить голосование"}
        </button>
        {cancelLabel !== null && (
          <button type="button" className="app-poll-back" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
      </div>

      {pickingEvents && (
        <EventPicker
          title="События голосования"
          hint={`Можно выбрать от ${VOTE_MIN_OPTIONS} до ${VOTE_MAX_OPTIONS} событий`}
          events={catalog}
          selectedIds={selectedEvents}
          multiple
          max={VOTE_MAX_OPTIONS}
          confirmLabel="Выбрать"
          onConfirm={(chosen) => onConfirmEvents(chosen.map((event) => event.id))}
          onClose={onCloseCatalog}
        />
      )}
      {pickingFriends && (
        <FriendPicker
          title="Кто голосует"
          hint="Позови друзей, которым уйдёт приглашение в MAX."
          friends={friends}
          selectedIds={selectedFriends}
          multiple
          confirmLabel="Готово"
          onConfirm={onConfirmFriends}
          onClose={onCloseFriends}
        />
      )}
    </section>
  );
}

interface VoteCreateSectionProps {
  events: Event[];
  onCreated: (vote: VoteScreen) => void;
  onCancel: () => void;
  /** Участники группы, когда экран открыт из неё; иначе никого не отмечаем заранее. */
  preselectedFriendIds?: string[];
  /** null прячет кнопку: на своём маршруте назад уводит стрелка шапки. */
  cancelLabel?: string | null;
}

export function VoteCreateSection({ events, onCreated, onCancel, preselectedFriendIds = [], cancelLabel = "Назад к подборке" }: VoteCreateSectionProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [catalog, setCatalog] = useState<Event[]>(events);
  const [title, setTitle] = useState("Куда идем в пятницу?");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(events.slice(0, VOTE_MAX_OPTIONS).map((event) => event.id));
  const [selectedFriends, setSelectedFriends] = useState<string[]>(preselectedFriendIds);
  const [pickingEvents, setPickingEvents] = useState(false);
  const [pickingFriends, setPickingFriends] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const openCatalog = () => {
    if (catalog.length > events.length) {
      setPickingEvents(true);
      return;
    }
    setCatalogLoading(true);
    apiClient.listEvents().then(
      (list) => {
        const known = new Set(catalog.map((event) => event.id));
        setCatalog((current) => [...current, ...list.filter((event) => !known.has(event.id))]);
        setPickingEvents(true);
        setCatalogLoading(false);
      },
      () => {
        setCatalogLoading(false);
        setFailed(true);
      },
    );
  };

  const submit = () => {
    if (!voteCreateReady(title, selectedEvents, selectedFriends) || submitting) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createVote({ title: title.trim(), eventIds: selectedEvents, participantIds: selectedFriends }).then(
      (created) => onCreated(created),
      () => {
        setFailed(true);
        setSubmitting(false);
      },
    );
  };

  return (
    <VoteCreateView
      events={catalog}
      friends={friends}
      catalog={catalog}
      title={title}
      selectedEvents={selectedEvents}
      selectedFriends={selectedFriends}
      pickingEvents={pickingEvents}
      pickingFriends={pickingFriends}
      catalogLoading={catalogLoading}
      submitting={submitting}
      failed={failed}
      cancelLabel={cancelLabel}
      onTitle={setTitle}
      onRemoveEvent={(eventId) => setSelectedEvents((current) => current.filter((id) => id !== eventId))}
      onOpenCatalog={openCatalog}
      onCloseCatalog={() => setPickingEvents(false)}
      onConfirmEvents={(ids) => {
        setSelectedEvents(ids.slice(0, VOTE_MAX_OPTIONS));
        setPickingEvents(false);
      }}
      onOpenFriends={() => setPickingFriends(true)}
      onCloseFriends={() => setPickingFriends(false)}
      onConfirmFriends={(ids) => {
        setSelectedFriends(ids);
        setPickingFriends(false);
      }}
      onSubmit={submit}
      onCancel={onCancel}
    />
  );
}

type SeedState = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[]; friendIds: string[] };

export function VoteCreatePage({ groupId }: { groupId: string | null }) {
  const { navigate, back } = useRoute();
  const auth = useAuth();
  const ownId = auth.status === "authenticated" ? auth.user.id : null;
  const [seed, setSeed] = useState<SeedState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setSeed({ status: "loading" });
    // Из группы голосование наследует её события и её людей; без группы — обычная афиша и пустой список.
    const load = groupId === null ? Promise.resolve({ events: [] as Event[], friendIds: [] as string[] }) : apiClient.getWeGroup(groupId).then((card) => ({ events: card.events, friendIds: card.members.map((member) => member.id).filter((id) => id !== ownId) }));
    load.then(
      ({ events, friendIds }) => {
        if (alive) setSeed({ status: "ready", events, friendIds });
      },
      () => {
        if (alive) setSeed({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [groupId, ownId]);

  return (
    <section className="app-poll-screen" aria-label="Создание голосования">
      <div className="app-we-bar">
        <h1 className="app-we-bar-name">Новое голосование</h1>
      </div>
      {seed.status === "loading" && <AppSkeletonList rows={4} />}
      {seed.status === "error" && <AppState error>Не удалось открыть создание голосования.</AppState>}
      {seed.status === "ready" && <VoteCreateSection events={seed.events} preselectedFriendIds={seed.friendIds} cancelLabel={null} onCreated={(vote) => navigate({ name: "vote", id: vote.id })} onCancel={back} />}
    </section>
  );
}
