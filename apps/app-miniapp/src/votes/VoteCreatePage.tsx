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
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { voteOptionMeta } from "./format";

export const VOTE_MIN_OPTIONS = 2;
export const VOTE_MAX_OPTIONS = 10;

/** How many friend tiles the roster shows before «Ещё» opens the rest of the list. */
const ROSTER_PREVIEW = 6;

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
  title: string;
  selectedEvents: string[];
  selectedFriends: string[];
  /** Все друзья раскрыты: «Ещё» уже нажали. */
  rosterOpen: boolean;
  catalogOpen: boolean;
  catalogLoading: boolean;
  submitting: boolean;
  failed: boolean;
  cancelLabel: string | null;
  onTitle: (title: string) => void;
  onToggleEvent: (id: string) => void;
  onToggleFriend: (id: string) => void;
  onOpenCatalog: () => void;
  onOpenRoster: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function VoteCreateView({ events, friends, title, selectedEvents, selectedFriends, rosterOpen, catalogOpen, catalogLoading, submitting, failed, cancelLabel, onTitle, onToggleEvent, onToggleFriend, onOpenCatalog, onOpenRoster, onSubmit, onCancel }: VoteCreateViewProps) {
  const blockers = voteCreateBlockers(title, selectedEvents, selectedFriends);
  const roster = rosterOpen ? friends : friends.filter((friend, index) => index < ROSTER_PREVIEW || selectedFriends.includes(friend.id));
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
      {events.map((event) => {
        const picked = selectedEvents.includes(event.id);
        return (
          <button type="button" key={event.id} aria-pressed={picked} className={picked ? "app-poll-option app-poll-option--on" : "app-poll-option"} onClick={() => onToggleEvent(event.id)}>
            <span className="app-poll-check" aria-hidden="true">
              {picked && <ActionIcon name="check" size={12} strokeWidth={3.4} />}
            </span>
            <AppMedia category={event.category} className="app-poll-option-media" />
            <span className="app-poll-option-text">
              <span className="app-poll-option-title">{event.title}</span>
              <span className="app-poll-option-meta">{voteOptionMeta(event)}</span>
            </span>
          </button>
        );
      })}
      {!catalogOpen && (
        <button type="button" className="app-poll-more" disabled={catalogLoading} onClick={onOpenCatalog}>
          <ActionIcon name="plus" size={16} strokeWidth={2.8} />
          {catalogLoading ? "Загружаем афишу…" : "Добавить событие"}
        </button>
      )}

      <div className="app-we-block-head">
        <h2 className="app-we-block-title">Кто голосует</h2>
        <span className="app-we-block-count">{voteFriendsCounter(selectedFriends.length)}</span>
      </div>
      <div className="app-poll-roster" role="group" aria-label="Кто голосует">
        {roster.map((friend) => {
          const picked = selectedFriends.includes(friend.id);
          return (
            <button type="button" key={friend.id} aria-pressed={picked} className={picked ? "app-poll-voter app-poll-voter--on" : "app-poll-voter"} onClick={() => onToggleFriend(friend.id)}>
              <span className="app-poll-voter-face" aria-hidden="true">
                {friend.name.charAt(0)}
              </span>
              <span className="app-poll-voter-name">{friend.name.split(" ")[0]}</span>
            </button>
          );
        })}
        {!rosterOpen && friends.length > roster.length && (
          <button type="button" className="app-poll-voter app-poll-voter--more" onClick={onOpenRoster}>
            <span className="app-poll-voter-face app-poll-voter-face--more" aria-hidden="true">
              <ActionIcon name="plus" size={18} strokeWidth={2.8} />
            </span>
            <span className="app-poll-voter-name">Ещё</span>
          </button>
        )}
      </div>

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
    </section>
  );
}

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
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
  const [options, setOptions] = useState<Event[]>(events);
  const [title, setTitle] = useState("Куда идем в пятницу?");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(events.slice(0, VOTE_MAX_OPTIONS).map((event) => event.id));
  const [selectedFriends, setSelectedFriends] = useState<string[]>(preselectedFriendIds);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
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

  /** «Добавить событие» is the rest of the афиша, appended after what the screen came in with. */
  const openCatalog = () => {
    setCatalogLoading(true);
    apiClient.listEvents().then(
      (list) => {
        const known = new Set(options.map((event) => event.id));
        setOptions((current) => [...current, ...list.filter((event) => !known.has(event.id))]);
        setCatalogOpen(true);
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

  return <VoteCreateView events={options} friends={friends} title={title} selectedEvents={selectedEvents} selectedFriends={selectedFriends} rosterOpen={rosterOpen} catalogOpen={catalogOpen} catalogLoading={catalogLoading} submitting={submitting} failed={failed} cancelLabel={cancelLabel} onTitle={setTitle} onToggleEvent={(eventId) => setSelectedEvents((current) => toggle(current, eventId))} onToggleFriend={(friendId) => setSelectedFriends((current) => toggle(current, friendId))} onOpenCatalog={openCatalog} onOpenRoster={() => setRosterOpen(true)} onSubmit={submit} onCancel={onCancel} />;
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
    const load = groupId === null ? apiClient.listEvents().then((events) => ({ events, friendIds: [] as string[] })) : apiClient.getWeGroup(groupId).then((card) => ({ events: card.events, friendIds: card.members.map((member) => member.id).filter((id) => id !== ownId) }));
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
        <button type="button" className="app-we-round app-we-round--back" aria-label="Назад" onClick={back}>
          <ActionIcon name="chevron" size={20} strokeWidth={2.4} />
        </button>
        <h1 className="app-we-bar-name">Новое голосование</h1>
      </div>
      {seed.status === "loading" && <AppSkeletonList rows={4} />}
      {seed.status === "error" && <AppState error>Не удалось открыть создание голосования.</AppState>}
      {seed.status === "ready" && <VoteCreateSection events={seed.events} preselectedFriendIds={seed.friendIds} cancelLabel={null} onCreated={(vote) => navigate({ name: "vote", id: vote.id })} onCancel={back} />}
    </section>
  );
}
