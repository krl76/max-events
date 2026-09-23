// START_MODULE_CONTRACT
// PURPOSE: Публикация истории (макет, экран 05): холст истории, подпись поверх него, стикер места, опрос, выбор аудитории и кнопка «В историю».
// SCOPE: Экран целиком. Стикер и опрос собираются из события, которое история рекламирует; ни стикера, ни опроса, ни аудитории у бэкенда нет (#502) — они уезжают в теле POST /stories под именами будущего эндпоинта. Фото едет data-URL, объектного хранилища нет (#477).
// DEPENDS: ../api/client.js (apiClient, EventDetails, StoryAudience, StoryComposition, StoryPlaceSticker, StoryPoll, STORY_AUDIENCES), ../auth/AuthContext.js, ../routing/router.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoryPublishState - idle | publishing | error
// - StoryCanvas - подложка истории: один из трёх фирменных градиентов или своё фото
// - STORY_CANVASES - три градиента рельса в порядке макета
// - StoryDraft - черновик экрана: подложка, фото, подпись, событие стикера, ответ опроса, аудитория
// - storyTimeLabel - «14:00» из ISO-времени события
// - storySticker - стикер места из карточки события: заголовок, «место · время», остаток мест
// - storyPoll - опрос истории: вопрос макета и два времени — старт события и +3 часа
// - nextStoryAudience - следующая аудитория по кругу (кнопка «Близкие друзья» — переключатель)
// - storyAudienceLabel - подпись аудитории на кнопке
// - storyCanvasImage - data-URL фирменного градиента: у истории на градиентной подложке тоже должна быть картинка
// - storyComposition - черновик -> тело публикации (подпись, стикер, опрос, аудитория)
// - StoryCreateView - презентационный экран 05
// - StoryCreatePage - контейнер: события, карточка выбранного события, выбор фото, публикация
// END_MODULE_MAP

import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient, STORY_AUDIENCES, type EventDetails, type StoryAudience, type StoryComposition, type StoryPlaceSticker, type StoryPoll } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";

export type StoryPublishState = "idle" | "publishing" | "error";

export type StoryCanvas = "gradient-1" | "gradient-2" | "gradient-3" | "photo";

/** Рельс подложек макета: фирменный триколор, комета, ночь. Четвёртая плитка рельса — пунктирная, она открывает выбор фото. */
export const STORY_CANVASES: readonly StoryCanvas[] = ["gradient-1", "gradient-2", "gradient-3"];

export interface StoryDraft {
  canvas: StoryCanvas;
  photoUrl: string | null;
  text: string;
  /** Событие, которое рекламирует история; null, пока каталог не ответил. */
  eventId: string | null;
  /** Индекс подсвеченного варианта опроса: экран открывается на первом, как его подсвечивает макет; null — автор снял выбор. */
  answer: number | null;
  audience: StoryAudience;
}

export function storyTimeLabel(startsAt: string): string {
  const at = new Date(startsAt);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/** «Мангальная зона» / «Парк Горького · 14:00» / «осталось мест 4» — всё из карточки события, кроме самого факта стикера (#502). */
export function storySticker(details: EventDetails): StoryPlaceSticker {
  const time = storyTimeLabel(details.event.startsAt);
  return {
    eventId: details.event.id,
    title: details.event.title,
    subtitle: details.place === null ? time : `${details.place.title} · ${time}`,
    seatsLeft: details.remainingSeats,
  };
}

const POLL_SECOND_OPTION_HOURS = 3;

/**
 * Опрос истории (макет, экран 05). Домена опросов на истории нет вовсе (#502): голосование в
 * продукте — это выбор события внутри группы «Мы», а не время внутри истории. Вопрос берётся из
 * макета, варианты — время старта события и оно же через три часа, ровно как 14:00 / 17:00 макета.
 */
export function storyPoll(startsAt: string): StoryPoll {
  const later = new Date(new Date(startsAt).getTime() + POLL_SECOND_OPTION_HOURS * 60 * 60 * 1000);
  return { question: "Во сколько удобнее?", options: [storyTimeLabel(startsAt), storyTimeLabel(later.toISOString())], answer: null };
}

export function nextStoryAudience(current: StoryAudience): StoryAudience {
  const index = STORY_AUDIENCES.findIndex((audience) => audience.id === current);
  return STORY_AUDIENCES[(index + 1) % STORY_AUDIENCES.length].id;
}

export function storyAudienceLabel(audience: StoryAudience): string {
  return STORY_AUDIENCES.find((item) => item.id === audience)?.label ?? STORY_AUDIENCES[0].label;
}

/** Остановки фирменных градиентов рельса; ни одного цвета вне шести брендбука. */
const CANVAS_STOPS: Record<Exclude<StoryCanvas, "photo">, readonly (readonly [string, string])[]> = {
  "gradient-1": [
    ["0", "#471aff"],
    ["0.6", "#9500ff"],
    ["1", "#00bfff"],
  ],
  "gradient-2": [
    ["0", "#6e1aff"],
    ["1", "#00bfff"],
  ],
  "gradient-3": [
    ["0", "#0d001a"],
    ["1", "#471aff"],
  ],
};

/**
 * История на градиенте всё равно обязана нести картинку: POST /stories принимает imageUrl и ничего
 * кроме него, а лента показывает истории как изображения. Градиент кодируется в SVG data-URL — тот
 * же приём, которым сделаны фикстуры рельса историй, и та же причина: в брифе людей на фото нет.
 */
export function storyCanvasImage(canvas: StoryCanvas): string {
  const stops = CANVAS_STOPS[canvas === "photo" ? "gradient-1" : canvas];
  const marks = stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${marks}</linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function storyComposition(draft: StoryDraft, sticker: StoryPlaceSticker | null, poll: StoryPoll | null): StoryComposition {
  return { text: draft.text.trim(), sticker, poll: poll === null ? null : { ...poll, answer: draft.answer }, audience: draft.audience };
}

interface StoryCreateViewProps {
  draft: StoryDraft;
  sticker: StoryPlaceSticker | null;
  poll: StoryPoll | null;
  events: Event[];
  state: StoryPublishState;
  onDraft: (next: StoryDraft) => void;
  onPickPhoto: () => void;
  onPublish: () => void;
  onClose: () => void;
}

export function StoryCreateView({ draft, sticker, poll, events, state, onDraft, onPickPhoto, onPublish, onClose }: StoryCreateViewProps) {
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const onPhotoCanvas = draft.canvas === "photo" && draft.photoUrl !== null;
  return (
    <section className={onPhotoCanvas ? "app-story-compose app-story-compose--photo" : `app-story-compose app-story-compose--${draft.canvas}`} aria-label="Публикация истории">
      {onPhotoCanvas && <img className="app-story-photo" src={draft.photoUrl ?? ""} alt="" />}
      <span className="app-story-orb app-story-orb--light" aria-hidden="true" />
      <span className="app-story-orb app-story-orb--status" aria-hidden="true" />

      <div className="app-story-bar">
        <button type="button" className="app-story-round" aria-label="Закрыть" onClick={onClose}>
          <ActionIcon name="close" size={18} strokeWidth={2.6} />
        </button>
        <div className="app-story-bar-actions">
          <button type="button" className="app-story-round" aria-label="Подпись" onClick={() => captionRef.current?.focus()}>
            <ActionIcon name="text" size={20} strokeWidth={2} />
          </button>
          {/* Кадрирование и эффекты рисует макет, но редактора кадра в продукте нет (#502): глифы остаются декором, а не ложными кнопками. */}
          <span className="app-story-round app-story-round--muted" aria-hidden="true">
            <ActionIcon name="adjust" size={20} strokeWidth={2} />
          </span>
          <span className="app-story-round app-story-round--muted" aria-hidden="true">
            <ActionIcon name="sparkle" size={20} strokeWidth={2} />
          </span>
        </div>
      </div>

      <textarea ref={captionRef} className="app-story-caption" aria-label="Подпись истории" rows={2} placeholder="Мангал в Горьком. Кто с нами?" value={draft.text} onChange={(change) => onDraft({ ...draft, text: change.target.value })} />

      {sticker !== null && (
        <div className="app-story-sticker">
          <span className="app-story-sticker-dot" aria-hidden="true" />
          <span className="app-story-sticker-text">
            <span className="app-story-sticker-title">{sticker.title}</span>
            <span className="app-story-sticker-subtitle">{sticker.subtitle}</span>
          </span>
          {/* Стикер сам себе выбор: макет не рисует отдельной строки «какое событие», а нативный список открывается по тапу по стикеру. */}
          <select className="app-story-sticker-pick" aria-label="Событие истории" value={draft.eventId ?? ""} onChange={(change) => onDraft({ ...draft, eventId: change.target.value, answer: 0 })}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {sticker !== null && sticker.seatsLeft !== null && (
        <div className="app-story-seats">
          <span className="app-story-seats-label">осталось мест</span>
          <span className="app-story-seats-count">{sticker.seatsLeft}</span>
        </div>
      )}

      {poll !== null && (
        <div className="app-story-poll">
          <p className="app-story-poll-kind">Опрос</p>
          <p className="app-story-poll-question">{poll.question}</p>
          <div className="app-story-poll-options">
            {poll.options.map((option, index) => (
              <button key={option} type="button" className={draft.answer === index ? "app-story-poll-option app-story-poll-option--on" : "app-story-poll-option"} aria-pressed={draft.answer === index} onClick={() => onDraft({ ...draft, answer: draft.answer === index ? null : index })}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="app-story-foot">
        <div className="app-story-rail">
          {STORY_CANVASES.map((canvas, index) => (
            <button key={canvas} type="button" className={draft.canvas === canvas ? `app-story-tile app-story-tile--${canvas} app-story-tile--on` : `app-story-tile app-story-tile--${canvas}`} aria-pressed={draft.canvas === canvas} aria-label={`Фон ${index + 1}`} onClick={() => onDraft({ ...draft, canvas })} />
          ))}
          {draft.photoUrl !== null && <button type="button" className={onPhotoCanvas ? "app-story-tile app-story-tile--on" : "app-story-tile"} aria-pressed={onPhotoCanvas} aria-label="Своё фото" style={{ backgroundImage: `url(${draft.photoUrl})` }} onClick={() => onDraft({ ...draft, canvas: "photo" })} />}
          <button type="button" className="app-story-tile app-story-tile--add" aria-label="Выбрать фото" onClick={onPickPhoto}>
            <ActionIcon name="plus" size={20} strokeWidth={2.5} />
          </button>
        </div>
        {state === "error" && <p className="app-story-error">Не удалось опубликовать историю. Попробуйте ещё раз.</p>}
        <div className="app-story-actions">
          <button type="button" className="app-story-audience" onClick={() => onDraft({ ...draft, audience: nextStoryAudience(draft.audience) })}>
            <ActionIcon name="friends" size={18} strokeWidth={2.2} />
            {storyAudienceLabel(draft.audience)}
          </button>
          <button type="button" className="app-story-publish" disabled={state === "publishing"} onClick={onPublish}>
            {state === "publishing" ? "Публикуем…" : "В историю"}
            <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </section>
  );
}

export function StoryCreatePage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [draft, setDraft] = useState<StoryDraft>({ canvas: "gradient-1", photoUrl: null, text: "", eventId: null, answer: 0, audience: "close-friends" });
  const [state, setState] = useState<StoryPublishState>("idle");

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (!alive) return;
        setEvents(list);
        // Стикер макета несёт и площадку, и остаток мест, поэтому открываем на событии, у которого есть и то и другое.
        const opening = list.find((event) => event.placeId !== null && event.capacity !== null) ?? list.find((event) => event.placeId !== null) ?? list[0];
        if (opening !== undefined) setDraft((current) => (current.eventId === null ? { ...current, eventId: opening.id } : current));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (draft.eventId === null || userId === null) return;
    let alive = true;
    apiClient.getEventDetails(draft.eventId, userId).then(
      (loaded) => {
        if (alive) setDetails(loaded);
      },
      () => {
        if (alive) setDetails(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [draft.eventId, userId]);

  // Стикер и опрос читаются из одной карточки события, поэтому и живут одной памятью.
  const sticker = useMemo(() => (details === null || details.event.id !== draft.eventId ? null : storySticker(details)), [details, draft.eventId]);
  const poll = useMemo(() => (details === null || details.event.id !== draft.eventId ? null : storyPoll(details.event.startsAt)), [details, draft.eventId]);

  const publish = () => {
    setState("publishing");
    const imageUrl = draft.canvas === "photo" && draft.photoUrl !== null ? draft.photoUrl : storyCanvasImage(draft.canvas);
    apiClient.createStory(imageUrl, storyComposition(draft, sticker, poll)).then(
      () => navigate({ name: "home" }),
      () => setState("error"),
    );
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Выбрать фото для истории"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          change.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") return;
            setDraft((current) => ({ ...current, photoUrl: reader.result as string, canvas: "photo" }));
            setState("idle");
          };
          reader.readAsDataURL(file);
        }}
      />
      <StoryCreateView draft={draft} sticker={sticker} poll={poll} events={events} state={state} onDraft={setDraft} onPickPhoto={() => fileRef.current?.click()} onPublish={publish} onClose={back} />
    </>
  );
}
