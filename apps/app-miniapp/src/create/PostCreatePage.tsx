// START_MODULE_CONTRACT
// PURPOSE: Публикация поста (макет, экран 06): шапка «Новый пост» с «Опубликовать», автор и текст, сетка фото, привязанное событие, место, отметка друзей, «Кто увидит», «Разрешить запись через пост» и строка «Черновик сохранён».
// SCOPE: Экран целиком; заменяет форму впечатления на маршруте feed-new. Места, отметка друзей, аудитория, «запись через пост» и автосохранение черновика колонок не имеют (#502) — они уезжают в теле POST /feed и POST /feed/drafts под именами будущего эндпоинта. Фото едут data-URL (#477), из них доживает только первое.
// DEPENDS: ../api/client.js (apiClient, CreateFeedPost, PostAudience, PostDraft, POST_AUDIENCES), ../auth/AuthContext.js, ../feed/photo.js (readFeedPhoto), ../routing/router.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - POST_PHOTO_LIMIT - сколько плиток держит сетка фото макета
// - PostSubmitState - idle | publishing | error
// - PostComposeDraft - черновик экрана: текст, фото, событие, место, отмеченные друзья, аудитория, «запись через пост»
// - postDateLine - «Сб, 19 сен · 14:00» из ISO-времени события
// - postEventLine - подпись привязанного события: дата, время и «привязано к посту»
// - firstNameOf - первое слово имени: в макете отмечены «Анна, Дима», а не полные имена
// - postFriendsLine - строка отметки друзей: «Отметить друзей» или «Отметить друзей · Анна, Дима»
// - postDraftReady - пост готов к публикации: событие привязано и текст не пуст
// - postPayload - черновик -> тело публикации
// - postDraftOf - черновик -> тело автосохранения
// - PostCreateView - презентационный экран 06
// - PostCreatePage - контейнер: события и места каталога, друзья, выбор фото, автосохранение, публикация
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Event, Friend, Place } from "@max-events/api-contracts";
import { apiClient, POST_AUDIENCES, type CreateFeedPost, type PostAudience, type PostDraft } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { readFeedPhoto } from "../feed/photo";
import { useRoute } from "../routing/router";
import { EventPicker } from "../ui/EventPicker";
import { friendHandle } from "../ui/friend-handle";
import { FriendPicker } from "../ui/FriendPicker";
import { ActionIcon } from "../ui/icons";
import { PlaceSheet } from "../ui/PlaceSheet";
import { placePinLabel, placePinTitle } from "../ui/pin-label";
import { pictured } from "../ui/photos";
import { AppMedia } from "../ui/primitives";

/** Сетка макета — крупная плитка плюс колонка из двух: три кадра и есть потолок. */
export const POST_PHOTO_LIMIT = 3;

export type PostSubmitState = "idle" | "publishing" | "error";

export interface PostComposeDraft {
  text: string;
  photoUrls: string[];
  eventId: string | null;
  placeId: string | null;
  pinLabel: string | null;
  taggedFriendIds: string[];
  audience: PostAudience;
  allowJoin: boolean;
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «Сб, 19 сен · 14:00» — формат макета; Intl для ru даёт «сб, 19 сент.», а это другая строка. */
export function postDateLine(startsAt: string): string {
  const at = new Date(startsAt);
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `${WEEKDAYS[at.getDay()]}, ${at.getDate()} ${MONTHS[at.getMonth()]} · ${time}`;
}

export function postEventLine(startsAt: string): string {
  return `${postDateLine(startsAt)} · привязано к посту`;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0];
}

export function postFriendsLine(friends: Friend[]): string {
  return friends.length === 0 ? "Отметить друзей" : `Отметить друзей · ${friends.map((friend) => firstNameOf(friend.name)).join(", ")}`;
}

export function postDraftReady(draft: PostComposeDraft): boolean {
  return draft.text.trim() !== "";
}

export function missingPostFields(draft: PostComposeDraft): string[] {
  const missing: string[] = [];
  if (draft.text.trim() === "") missing.push("Напишите текст");
  return missing;
}

/** Публикация несёт и photoUrl, и всю сетку: первое фото доживает до ленты, остальные ждут #502 и объектного хранилища (#477). */
export function postPayload(draft: PostComposeDraft, userId: string, eventId: string | null): CreateFeedPost {
  return { userId, eventId, text: draft.text.trim(), photoUrl: draft.photoUrls[0] ?? null, photoUrls: draft.photoUrls.slice(0, POST_PHOTO_LIMIT), placeId: draft.placeId, locationLabel: draft.pinLabel, taggedFriendIds: draft.taggedFriendIds, audience: draft.audience, allowJoin: eventId !== null && draft.allowJoin };
}

export function postDraftOf(draft: PostComposeDraft, userId: string): PostDraft {
  return { userId, eventId: draft.eventId, text: draft.text, photoUrls: draft.photoUrls, placeId: draft.placeId, taggedFriendIds: draft.taggedFriendIds, audience: draft.audience, allowJoin: draft.allowJoin };
}

interface PostCreateViewProps {
  draft: PostComposeDraft;
  authorName: string;
  /** Фото профиля. Без него остаётся буква имени. */
  authorAvatar?: string | null;
  events: Event[];
  places: Place[];
  friends: Friend[];
  state: PostSubmitState;
  photoRejected: boolean;
  onDraft: (next: PostComposeDraft) => void;
  onPickPhoto: () => void;
  onPublish: () => void;
  onClose: () => void;
}

export function PostCreateView({ draft, authorName, authorAvatar = null, events, places, friends, state, photoRejected, onDraft, onPickPhoto, onPublish }: PostCreateViewProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [taggingOpen, setTaggingOpen] = useState(false);
  const [placeMode, setPlaceMode] = useState<"address" | "map" | null>(null);
  const [pickingEvent, setPickingEvent] = useState(false);
  const missing = missingPostFields(draft);
  const boundEvent = events.find((event) => event.id === draft.eventId) ?? null;
  const boundPlace = places.find((place) => place.id === draft.placeId) ?? null;
  const tagged = friends.filter((friend) => draft.taggedFriendIds.includes(friend.id));
  const whereLine = draft.pinLabel ? placePinTitle(draft.pinLabel) : boundPlace ? (boundPlace.address.trim() !== "" ? boundPlace.address : boundPlace.title) : "";
  const addTile = draft.photoUrls.length < POST_PHOTO_LIMIT;

  const publishLabel = state === "publishing" ? "Публикуем…" : "Опубликовать";

  return (
    <section className="app-post-compose" aria-label="Публикация поста">
      <header className="app-post-compose-head">
        <span className="app-post-compose-title">Новый пост</span>
        <button
          type="button"
          className="app-post-compose-publish"
          disabled={state === "publishing"}
          onClick={() => {
            if (missing.length === 0) onPublish();
            else textRef.current?.focus();
          }}
        >
          {publishLabel}
        </button>
      </header>

      <div className="app-post-compose-body">
        <div className="app-post-compose-author">
          <span className="app-post-compose-avatar" aria-hidden="true">
            {authorAvatar ? <img alt="" src={authorAvatar} /> : authorName.slice(0, 1).toUpperCase()}
          </span>
          <div className="app-post-compose-id">
            <span className="app-post-compose-name">{authorName}</span>
            <textarea ref={textRef} className="app-post-compose-text" aria-label="Текст поста" rows={3} placeholder="Напишите текст" value={draft.text} onChange={(change) => onDraft({ ...draft, text: change.target.value })} />
          </div>
        </div>
        <div className={draft.photoUrls.length === 0 ? "app-post-compose-photos app-post-compose-photos--empty" : "app-post-compose-photos"}>
          {draft.photoUrls.length > 0 && (
            <div className="app-post-compose-shot app-post-compose-shot--lead" style={{ backgroundImage: `url(${draft.photoUrls[0]})` }}>
              <span className="app-post-compose-shot-orb" aria-hidden="true" />
              <button type="button" className="app-post-compose-shot-drop" aria-label="Убрать фото" onClick={() => onDraft({ ...draft, photoUrls: draft.photoUrls.filter((_, index) => index !== 0) })}>
                <ActionIcon name="close" size={13} strokeWidth={3} />
              </button>
            </div>
          )}
          {(draft.photoUrls.length > 1 || (draft.photoUrls.length > 0 && addTile)) && (
            <div className="app-post-compose-shot-column">
              {draft.photoUrls.slice(1).map((photoUrl, index) => (
                <div key={photoUrl.slice(-24)} className="app-post-compose-shot" style={{ backgroundImage: `url(${photoUrl})` }}>
                  <button type="button" className="app-post-compose-shot-drop" aria-label="Убрать фото" onClick={() => onDraft({ ...draft, photoUrls: draft.photoUrls.filter((_, position) => position !== index + 1) })}>
                    <ActionIcon name="close" size={13} strokeWidth={3} />
                  </button>
                </div>
              ))}
              {addTile && (
                <button type="button" className="app-post-compose-add" aria-label="Добавить фото" onClick={onPickPhoto}>
                  <ActionIcon name="camera" size={24} strokeWidth={2} />
                </button>
              )}
            </div>
          )}
          {draft.photoUrls.length === 0 && (
            <button type="button" className="app-post-compose-add app-post-compose-add--lead" aria-label="Добавить фото" onClick={onPickPhoto}>
              <ActionIcon name="camera" size={24} strokeWidth={2} />
            </button>
          )}
        </div>
        {photoRejected && <p className="app-post-compose-error">Не удалось подготовить фото. Попробуйте другое.</p>}

        <div className="app-post-compose-rows">
          <div className="app-post-compose-row app-post-compose-row--event">
            <button type="button" className="app-post-compose-row-hit" onClick={() => setPickingEvent(true)}>
              {boundEvent === null ? <span className="app-post-compose-row-media" aria-hidden="true" /> : <AppMedia category={boundEvent.category} src={pictured(boundEvent.id, boundEvent.coverUrl)} className="app-post-compose-thumb" />}
              <span className="app-post-compose-row-text">
                <span className="app-post-compose-row-title">{boundEvent === null ? "Привязать событие" : boundEvent.title}</span>
                <span className="app-post-compose-row-note">{boundEvent === null ? "Фото, дата и место — в окне выбора" : postEventLine(boundEvent.startsAt)}</span>
              </span>
              {boundEvent === null && (
                <span className="app-post-compose-row-chevron" aria-hidden="true">
                  <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
                </span>
              )}
            </button>
            {boundEvent !== null && (
              <button type="button" className="app-post-compose-row-drop" aria-label="Отвязать событие" onClick={() => onDraft({ ...draft, eventId: null, allowJoin: false, placeId: null })}>
                <ActionIcon name="close" size={18} strokeWidth={2.6} />
              </button>
            )}
          </div>
          {pickingEvent && (
            <EventPicker
              title="Событие поста"
              events={events}
              selectedId={draft.eventId}
              onPick={(event) => {
                onDraft({ ...draft, eventId: event.id });
                setPickingEvent(false);
              }}
              onClose={() => setPickingEvent(false)}
            />
          )}

          <div className="app-post-compose-row app-post-compose-row--place">
            <span className="app-post-compose-row-text">
              <span className="app-post-compose-row-title">{whereLine === "" ? "Место" : whereLine}</span>
              <span className="app-post-compose-row-note">{whereLine === "" ? "На карте или вписать адрес" : "Адрес"}</span>
            </span>
            <span className="app-field-side">
              <button type="button" className="app-field-action" onClick={() => setPlaceMode("address")}>
                <ActionIcon name="pin" size={18} strokeWidth={2.2} />
                Адрес
              </button>
              <button type="button" className="app-field-action" onClick={() => setPlaceMode("map")}>
                <ActionIcon name="layers" size={18} strokeWidth={2.2} />
                Карта
              </button>
            </span>
          </div>
          <button type="button" className="app-post-compose-row app-post-compose-row--button" aria-expanded={taggingOpen} onClick={() => setTaggingOpen(true)}>
            <span className="app-post-compose-row-text">
              <span className="app-post-compose-row-title">{tagged.length === 0 ? "Отметить друзей" : tagged.map((friend) => friend.name.split(" ")[0]).join(", ")}</span>
              <span className="app-post-compose-row-note">{tagged.length === 0 ? "Их увидят в посте" : `@${friendHandle(tagged[0]!)}`}</span>
            </span>
          </button>
          {taggingOpen && (
            <FriendPicker
              friends={friends}
              multiple
              title="Кого отметить"
              hint="В посте они появятся как @ник"
              confirmLabel="Отметить"
              onConfirm={(ids) => {
                onDraft({ ...draft, taggedFriendIds: ids });
                setTaggingOpen(false);
              }}
              onClose={() => setTaggingOpen(false)}
            />
          )}
          {placeMode !== null && (
            <PlaceSheet
              title="Место поста"
              mode={placeMode}
              places={places}
              onConfirm={(choice) => {
                const pinLabel = choice.latitude !== undefined && choice.longitude !== undefined ? placePinLabel(choice.label, choice.latitude, choice.longitude) : choice.placeId === null ? choice.label : null;
                onDraft({ ...draft, pinLabel, placeId: choice.placeId });
                setPlaceMode(null);
              }}
              onClose={() => setPlaceMode(null)}
            />
          )}
        </div>

        <div className="app-post-who">
          <span className="app-post-who-label">Кто увидит</span>
          <div className="app-post-who-seg" role="radiogroup" aria-label="Кто увидит">
            {POST_AUDIENCES.map((audience) => (
              <button key={audience.id} type="button" role="radio" aria-checked={draft.audience === audience.id} onClick={() => onDraft({ ...draft, audience: audience.id })}>
                {audience.label}
              </button>
            ))}
          </div>
        </div>

        {draft.eventId !== null && (
          <div className="app-post-compose-join">
            <span className="app-post-compose-join-text">
              <span className="app-post-compose-join-title">Запись с поста</span>
              <span className="app-post-compose-join-note">Друг нажимает «Я пойду» прямо здесь</span>
            </span>
            <button type="button" role="switch" aria-checked={draft.allowJoin} aria-label="Запись с поста" className={draft.allowJoin ? "app-post-compose-switch app-post-compose-switch--on" : "app-post-compose-switch"} onClick={() => onDraft({ ...draft, allowJoin: !draft.allowJoin })}>
              <span className="app-post-compose-switch-knob" aria-hidden="true" />
            </button>
          </div>
        )}
        {state === "error" && <p className="app-post-compose-error">Не удалось опубликовать пост. Попробуйте ещё раз.</p>}
      </div>
    </section>
  );
}

const DRAFT_AUTOSAVE_MS = 800;

export function PostCreatePage({ eventId }: { eventId: string | null }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const authorName = auth.status === "authenticated" ? `${auth.user.firstName}${auth.user.lastName === null ? "" : ` ${auth.user.lastName}`}` : "";
  const authorAvatar = auth.status === "authenticated" ? auth.user.avatarUrl : null;
  const { navigate, back } = useRoute();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [draft, setDraft] = useState<PostComposeDraft>({ text: "", photoUrls: [], eventId, placeId: null, pinLabel: null, taggedFriendIds: [], audience: POST_AUDIENCES[0].id, allowJoin: false });
  const [state, setState] = useState<PostSubmitState>("idle");
  const [photoRejected, setPhotoRejected] = useState(false);
  // Только последний выбор доезжает: тяжёлое фото, выбранное первым, иначе перезапишет лёгкое, выбранное вторым.
  const photoPick = useRef(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([apiClient.listEvents().catch(() => [] as Event[]), apiClient.listPlaces().catch(() => [] as Place[]), apiClient.listFriends().catch(() => [] as Friend[])]).then(([loadedEvents, loadedPlaces, loadedFriends]) => {
      if (!alive) return;
      setEvents(loadedEvents);
      setPlaces(loadedPlaces);
      setFriends(loadedFriends);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Автосохранение черновика (#502): пустой черновик сохранять нечего, остальное уезжает с задержкой, а не на каждое нажатие.
  useEffect(() => {
    if (userId === null) return;
    if (draft.text.trim() === "" && draft.photoUrls.length === 0 && draft.eventId === null) return;
    const timer = setTimeout(() => {
      apiClient.savePostDraft(postDraftOf(draft, userId)).then(
        () => {},
        () => {},
      );
    }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, userId]);

  const pickPhoto = useCallback((file: File) => {
    const pick = ++photoPick.current;
    setPhotoRejected(false);
    void readFeedPhoto(file).then((photoUrl) => {
      if (pick !== photoPick.current) return;
      if (photoUrl === null) setPhotoRejected(true);
      else setDraft((current) => (current.photoUrls.length >= POST_PHOTO_LIMIT ? current : { ...current, photoUrls: [...current.photoUrls, photoUrl] }));
    });
  }, []);

  const publish = () => {
    if (userId === null || !postDraftReady(draft)) return;
    setState("publishing");
    // The draft keeps a sharp preview. The post stores the short upload URL, so the feed does not
    // have to ship a crushed data URL on every open.
    void Promise.all(draft.photoUrls.map((photo) => apiClient.storeImage(photo, "feed")))
      .then((photoUrls) => apiClient.createFeedPost(postPayload({ ...draft, photoUrls }, userId, draft.eventId)))
      .then(
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
        aria-label="Выбрать фото для поста"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          change.target.value = "";
          if (file) pickPhoto(file);
        }}
      />
      <PostCreateView draft={draft} authorName={authorName} authorAvatar={authorAvatar} events={events} places={places} friends={friends} state={state} photoRejected={photoRejected} onDraft={setDraft} onPickPhoto={() => fileRef.current?.click()} onPublish={publish} onClose={back} />
    </>
  );
}
