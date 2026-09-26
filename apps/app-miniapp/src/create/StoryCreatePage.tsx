// START_MODULE_CONTRACT
// PURPOSE: Публикация истории (макет, экран 05): пустой холст, на который автор сам кладёт объекты — подпись, стикер события, опрос, счётчик мест, — плюс выбор фона, аудитории и кнопка «В историю».
// SCOPE: Экран целиком. Холст открывается пустым, каталог внизу добавляет объекты по одному, каждый таскается и снимается. Стикер и опрос наполняются из события, которое история рекламирует; ни стикера, ни опроса, ни аудитории, ни расстановки объектов у бэкенда нет (#502) — они уезжают в теле POST /stories под именами будущего эндпоинта. Фото едет data-URL, объектного хранилища нет (#477).
// DEPENDS: ../api/client.js (apiClient, EventDetails, StoryAudience, StoryCanvasObject, StoryComposition, StoryObjectKind, StoryPlaceSticker, StoryPoll, STORY_AUDIENCES), ../auth/AuthContext.js, ../routing/router.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoryPublishState - idle | publishing | error
// - StoryCanvas - подложка истории: один из трёх фирменных градиентов или своё фото
// - STORY_CANVASES - три градиента рельса в порядке макета
// - STORY_OBJECT_ORDER - объекты холста в порядке кнопок каталога
// - STORY_OBJECTS - что такое каждый объект: подпись кнопки, глиф и место в кадре, на которое он ложится
// - STORY_OBJECT_SCALES - лесенка размеров объекта, от самого мелкого к самому крупному
// - StoryDraft - черновик экрана: подложка, фото, подпись, событие стикера, правленый опрос, аудитория, объекты холста
// - storyTimeLabel - «14:00» из ISO-времени события
// - storySticker - стикер места из карточки события: заголовок, «место · время», остаток мест
// - storyPoll - заготовка опроса из события: вопрос макета и два времени — старт события и +3 часа
// - nextStoryAudience - следующая аудитория по кругу (кнопка «Близкие друзья» — переключатель)
// - storyAudienceLabel - подпись аудитории на кнопке
// - storyCanvasImage - data-URL фирменного градиента: у истории на градиентной подложке тоже должна быть картинка
// - hasStoryObject - объект уже лежит на холсте
// - addStoryObject - положить объект на его место в кадре; повторное добавление ничего не меняет
// - removeStoryObject - снять объект с холста
// - moveStoryObject - перенести объект, удерживая его центр в кадре
// - resizeStoryObject - шаг по лесенке размеров: на краю лесенки объект остаётся как был
// - storyDraftPoll - опрос, который сейчас на холсте: правка автора, а пока её нет — заготовка из события
// - editStoryPoll - правка опроса на месте: вопрос или один из вариантов
// - storyObjectEnabled - есть ли чем наполнить объект: стикер и счётчик мест без карточки события пусты, опрос — без времени старта
// - storyObjectClass - классы обёртки объекта: свой вид плюс «передний», если объект трогали последним
// - storyObjectStyle - расстановка объекта в кадре: доли кадра и размер одной трансформацией
// - storyComposition - черновик -> тело публикации: только то, что автор положил на холст, плюс расстановка
// - rotateStoryPhoto - следующий поворот кадра, по четверти круга
// - clampStoryCrop - сдвиг кадра не дальше половины кадра
// - panStoryCrop - подвинуть кадр на dx/dy, оставаясь в этих пределах
// - cropDeltaFromPointer - пиксели жеста в доли кадра
// - storyPhotoStyle - поворот и смещение кадра как CSS
// - bakeRotatedPhoto - запечь только поворот
// - bakeStoryPhoto - запечь поворот и кадрирование в само изображение
// - StoryCreateView - презентационный экран 05
// - StoryCreatePage - контейнер: события, карточка выбранного события, выбор фото, публикация
// END_MODULE_MAP

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient, STORY_AUDIENCES, type EventDetails, type StoryAudience, type StoryCanvasObject, type StoryComposition, type StoryObjectKind, type StoryPlaceSticker, type StoryPoll } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";

export type StoryPublishState = "idle" | "publishing" | "error";

export type StoryCanvas = "gradient-1" | "gradient-2" | "gradient-3" | "photo";

/** Рельс подложек макета: фирменный триколор, комета, ночь. Четвёртая плитка рельса — пунктирная, она открывает выбор фото. */
export const STORY_CANVASES: readonly StoryCanvas[] = ["gradient-1", "gradient-2", "gradient-3"];

/** Порядок кнопок каталога: сперва подпись, потом то, что тянет данные из события. */
export const STORY_OBJECT_ORDER: readonly StoryObjectKind[] = ["text", "event", "poll", "seats"];

/**
 * Каталог объектов холста: всё, что макет показывал готовой историей, здесь — кнопка добавления, а
 * не декорация экрана. Координаты — доли кадра в процентах, те же вертикали, по которым объекты
 * расставлены в макете; дальше автор двигает их сам.
 */
export const STORY_OBJECTS: Record<StoryObjectKind, { label: string; icon: ActionIconName; x: number; y: number }> = {
  text: { label: "Текст", icon: "text", x: 50, y: 21 },
  event: { label: "Событие", icon: "pin", x: 50, y: 34 },
  poll: { label: "Опрос", icon: "lines", x: 50, y: 60 },
  seats: { label: "Места", icon: "seat", x: 74, y: 45 },
};

/**
 * Размер объекта ступенями, а не щипком: щипок в мини-аппе пришлось бы отбирать у страницы вместе с
 * масштабом всего экрана, а второй палец на холсте конфликтует с переносом за ручку. Потолок 1.25
 * выбран по самому широкому объекту: опрос занимает кадр без двух отступов и за 1.25 уходит за край.
 */
export const STORY_OBJECT_SCALES: readonly number[] = [0.75, 0.9, 1, 1.15, 1.25];

export interface StoryDraft {
  canvas: StoryCanvas;
  photoUrl: string | null;
  text: string;
  /** Событие, из которого наполняются стикер, опрос и счётчик мест; null, пока каталог не ответил. */
  eventId: string | null;
  /**
   * Опрос таким, каким его правит автор: заводится из события в момент добавления объекта и дальше
   * принадлежит автору — смена события больше не затирает того, что он написал. null — объекта на
   * холсте нет, и опрос снова возьмётся из карточки события.
   */
  poll: StoryPoll | null;
  audience: StoryAudience;
  /** Что автор положил на холст, в порядке добавления. Пусто на входе: история начинается с чистого кадра. */
  objects: StoryCanvasObject[];
  /** Поворот выбранного фото, градусы; 0 пока автор не трогал кадр. */
  rotate: number;
  /** 1:1 cover pan, −50..50 from the center. Reset when the photo changes. */
  cropX: number;
  cropY: number;
  /** Crop mode: drag the photo instead of canvas objects. */
  cropping: boolean;
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

export function hasStoryObject(objects: readonly StoryCanvasObject[], kind: StoryObjectKind): boolean {
  return objects.some((object) => object.kind === kind);
}

export function addStoryObject(objects: readonly StoryCanvasObject[], kind: StoryObjectKind): StoryCanvasObject[] {
  if (hasStoryObject(objects, kind)) return [...objects];
  const spot = STORY_OBJECTS[kind];
  return [...objects, { kind, x: spot.x, y: spot.y }];
}

export function removeStoryObject(objects: readonly StoryCanvasObject[], kind: StoryObjectKind): StoryCanvasObject[] {
  return objects.filter((object) => object.kind !== kind);
}

/** Центр объекта держится внутри кадра: утащенный за край объект нечем было бы вернуть. */
export function moveStoryObject(objects: readonly StoryCanvasObject[], kind: StoryObjectKind, x: number, y: number): StoryCanvasObject[] {
  const inside = (value: number) => Math.round(Math.min(94, Math.max(6, value)) * 10) / 10;
  return objects.map((object) => (object.kind === kind ? { ...object, x: inside(x), y: inside(y) } : object));
}

/** Шаг по лесенке размеров. На краю лесенки объект остаётся как был: кнопка там и без того погашена. */
export function resizeStoryObject(objects: readonly StoryCanvasObject[], kind: StoryObjectKind, step: 1 | -1): StoryCanvasObject[] {
  return objects.map((object) => {
    if (object.kind !== kind) return object;
    const at = STORY_OBJECT_SCALES.indexOf(object.scale ?? 1);
    const next = STORY_OBJECT_SCALES[Math.min(STORY_OBJECT_SCALES.length - 1, Math.max(0, (at === -1 ? STORY_OBJECT_SCALES.indexOf(1) : at) + step))];
    return { ...object, scale: next };
  });
}

/** Опрос, который сейчас на холсте: правка автора, а пока её нет — заготовка из карточки события. */
export function storyDraftPoll(draft: StoryDraft, poll: StoryPoll | null): StoryPoll | null {
  return draft.poll ?? poll;
}

/**
 * Правка опроса на месте: вопрос или один из вариантов, остальное остаётся как было. Подсвеченный
 * ответ держится индексом, а не текстом, поэтому переименование варианта его не сбивает.
 */
export function editStoryPoll(poll: StoryPoll, field: "question" | number, value: string): StoryPoll {
  if (field === "question") return { ...poll, question: value };
  return { ...poll, options: poll.options.map((option, index) => (index === field ? value : option)) };
}

/** Объект без данных не добавляется: пустой стикер или опрос без вариантов — это дыра в истории, а не объект. */
export function storyObjectEnabled(kind: StoryObjectKind, sticker: StoryPlaceSticker | null, poll: StoryPoll | null): boolean {
  if (kind === "text") return true;
  if (kind === "poll") return poll !== null;
  if (kind === "seats") return sticker !== null && sticker.seatsLeft !== null;
  return sticker !== null;
}

/**
 * Объект, которого коснулись последним, выходит вперёд. Обёртка объекта сдвинута трансформацией, а
 * трансформация заводит свой контекст наложения: поднять одни только ручки над соседями нельзя,
 * поднимается объект целиком. Без этого утащенный на чужие ручки объект намертво накрывает соседа —
 * тот перестаёт и двигаться, и сниматься крестиком.
 */
export function storyObjectClass(kind: StoryObjectKind, front: StoryObjectKind | null): string {
  return `app-story-object app-story-object--${kind}${front === kind ? " app-story-object--front" : ""}`;
}

/**
 * Место объекта в кадре и его размер одной трансформацией: перенос центра в точку и масштаб обязаны
 * ехать вместе, иначе крупный объект уезжает от пальца на половину прибавки.
 */
export function storyObjectStyle(object: StoryCanvasObject): CSSProperties {
  return { left: `${object.x}%`, top: `${object.y}%`, transform: `translate(-50%, -50%) scale(${object.scale ?? 1})` };
}

export function rotateStoryPhoto(degrees: number): number {
  return (degrees + 90) % 360;
}

export function clampStoryCrop(value: number): number {
  return Math.max(-50, Math.min(50, value));
}

export function panStoryCrop(cropX: number, cropY: number, dx: number, dy: number): { cropX: number; cropY: number } {
  return { cropX: clampStoryCrop(cropX + dx), cropY: clampStoryCrop(cropY + dy) };
}

export function cropDeltaFromPointer(dxPx: number, dyPx: number, frameSize: number): { dx: number; dy: number } {
  const size = frameSize > 0 ? frameSize : 1;
  return { dx: (dxPx / size) * 100, dy: (dyPx / size) * 100 };
}

export function storyPhotoStyle(draft: Pick<StoryDraft, "rotate" | "cropX" | "cropY">): CSSProperties {
  return { transform: `rotate(${draft.rotate}deg)`, objectPosition: `${50 + draft.cropX}% ${50 + draft.cropY}%` };
}

export function bakeRotatedPhoto(photoUrl: string, degrees: number): Promise<string> {
  return bakeStoryPhoto(photoUrl, degrees, 0, 0);
}

export function bakeStoryPhoto(photoUrl: string, degrees: number, cropX: number, cropY: number): Promise<string> {
  if (degrees % 360 === 0 && cropX === 0 && cropY === 0) return Promise.resolve(photoUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const swap = degrees % 180 !== 0;
      const rotatedW = swap ? image.height : image.width;
      const rotatedH = swap ? image.width : image.height;
      const canvas = document.createElement("canvas");
      canvas.width = rotatedW;
      canvas.height = rotatedH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(photoUrl);
        return;
      }
      ctx.translate(rotatedW / 2, rotatedH / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      const side = Math.min(rotatedW, rotatedH);
      const extraX = rotatedW - side;
      const extraY = rotatedH - side;
      const sx = Math.max(0, Math.min(extraX, extraX / 2 + (cropX / 50) * (extraX / 2)));
      const sy = Math.max(0, Math.min(extraY, extraY / 2 + (cropY / 50) * (extraY / 2)));
      const cropped = document.createElement("canvas");
      cropped.width = side;
      cropped.height = side;
      const cut = cropped.getContext("2d");
      if (!cut) {
        resolve(canvas.toDataURL("image/jpeg", 0.85));
        return;
      }
      cut.drawImage(canvas, sx, sy, side, side, 0, 0, side, side);
      resolve(cropped.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => resolve(photoUrl);
    image.src = photoUrl;
  });
}

/** В теле публикации едет только то, что автор положил на холст: пустой холст — история из одного фона. */
export function storyComposition(draft: StoryDraft, sticker: StoryPlaceSticker | null, poll: StoryPoll | null): StoryComposition {
  const onCanvas = (kind: StoryObjectKind) => hasStoryObject(draft.objects, kind);
  const asked = storyDraftPoll(draft, poll);
  return {
    text: onCanvas("text") ? draft.text.trim() : "",
    // Остаток мест лежит на том же стикере: счётчик без стикера — это тот же стикер, нарисованный одной цифрой.
    sticker: onCanvas("event") || onCanvas("seats") ? sticker : null,
    poll: onCanvas("poll") ? asked : null,
    audience: draft.audience,
    objects: draft.objects.map((object) => ({ ...object })),
  };
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
  const frameRef = useRef<HTMLElement | null>(null);
  const cropDrag = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  // Кого трогали последним — тот и впереди: порядок публикации от этого не зависит, это только холст.
  // Пока не трогали никого, выбран последний положенный: холст без выбранного объекта не показывал
  // бы ручек вовсе, а первым делом после добавления их и ищут.
  const [touched, setTouched] = useState<StoryObjectKind | null>(null);
  const front = touched ?? draft.objects[draft.objects.length - 1]?.kind ?? null;
  const onPhotoCanvas = draft.canvas === "photo" && draft.photoUrl !== null;
  // Опрос на холсте — правленый, а не выведенный: заготовка из события служит ему только началом.
  const asked = storyDraftPoll(draft, poll);

  /** Добавленный объект сразу становится выбранным: ручки живут на выбранном, и искать их не приходится. */
  const putObject = (kind: StoryObjectKind) => {
    onDraft({ ...draft, objects: addStoryObject(draft.objects, kind), ...(kind === "poll" && draft.poll === null && poll !== null ? { poll } : {}) });
    setTouched(kind);
  };

  /** Снятый опрос забирает с собой и свою правку: добавленный заново он снова заводится из события. */
  const dropObject = (kind: StoryObjectKind) => {
    onDraft({ ...draft, objects: removeStoryObject(draft.objects, kind), ...(kind === "poll" ? { poll: null } : {}) });
    setTouched((current) => (current === kind ? null : current));
  };

  const toggleObject = (kind: StoryObjectKind) => (hasStoryObject(draft.objects, kind) ? dropObject(kind) : putObject(kind));

  /** Перетаскивание считается от точки захвата, а не от центра: иначе объект прыгал бы под палец первым же движением. */
  const startDrag = (object: StoryCanvasObject, event: ReactPointerEvent<HTMLElement>) => {
    const frame = frameRef.current;
    if (frame === null) return;
    const box = frame.getBoundingClientRect();
    const fromX = event.clientX;
    const fromY = event.clientY;
    const move = (moved: PointerEvent) => onDraft({ ...draft, objects: moveStoryObject(draft.objects, object.kind, object.x + ((moved.clientX - fromX) / box.width) * 100, object.y + ((moved.clientY - fromY) / box.height) * 100) });
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  /**
   * Выбор события — единственное, что правится у стикера и счётчика мест: заголовок, площадка, время
   * и остаток мест принадлежат карточке события, а не истории, и сочинять их поверх неё нельзя.
   * Нативный список лежит прозрачным слоем поверх объекта, а шеврон говорит, что слой там есть.
   */
  const eventPick = (label: string): ReactNode => (
    <>
      <span className="app-story-pick-mark" aria-hidden="true">
        <ActionIcon name="chevron" size={12} strokeWidth={2.6} />
      </span>
      <select className="app-story-sticker-pick" aria-label={label} value={draft.eventId ?? ""} onChange={(change) => onDraft({ ...draft, eventId: change.target.value })}>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </select>
    </>
  );

  const objectBody = (kind: StoryObjectKind): ReactNode => {
    if (kind === "text") return <textarea ref={captionRef} className="app-story-caption" aria-label="Подпись истории" rows={2} placeholder="Ваш текст" value={draft.text} onChange={(change) => onDraft({ ...draft, text: change.target.value })} />;
    if (kind === "event" && sticker !== null)
      return (
        <div className="app-story-sticker">
          <span className="app-story-sticker-dot" aria-hidden="true" />
          <span className="app-story-sticker-text">
            <span className="app-story-sticker-title">{sticker.title}</span>
            <span className="app-story-sticker-subtitle">{sticker.subtitle}</span>
          </span>
          {eventPick("Событие истории")}
        </div>
      );
    if (kind === "seats" && sticker !== null && sticker.seatsLeft !== null)
      return (
        <div className="app-story-seats">
          <span className="app-story-seats-label">осталось мест</span>
          <span className="app-story-seats-count">{sticker.seatsLeft}</span>
          {/* Число не правится руками намеренно: свободные места считает бронирование, и подписанное автором «осталось 2» было бы враньём на витрине. */}
          <span className="app-story-seats-source">из карточки события</span>
          {eventPick("Событие счётчика мест")}
        </div>
      );
    if (kind === "poll" && asked !== null)
      return (
        <div className="app-story-poll">
          <p className="app-story-poll-kind">Опрос</p>
          {/* Вопрос и оба варианта правятся прямо на объекте: заготовка из события — начало, а не приговор. */}
          <input className="app-story-poll-question app-story-poll-field" aria-label="Вопрос опроса" placeholder="Ваш вопрос" value={asked.question} onChange={(change) => onDraft({ ...draft, poll: editStoryPoll(asked, "question", change.target.value) })} />
          <div className="app-story-poll-options">
            {asked.options.map((option, index) => (
              // Ключ по месту, а не по тексту: два одинаковых варианта посреди правки — обычное дело.
              <span key={index} className={asked.answer === index ? "app-story-poll-option app-story-poll-option--on" : "app-story-poll-option"}>
                <button type="button" className="app-story-poll-mark" aria-label={`Мой ответ: вариант ${index + 1}`} aria-pressed={asked.answer === index} onClick={() => onDraft({ ...draft, poll: { ...asked, answer: asked.answer === index ? null : index } })} />
                <input className="app-story-poll-field" aria-label={`Вариант ${index + 1}`} placeholder={`Вариант ${index + 1}`} value={option} onChange={(change) => onDraft({ ...draft, poll: editStoryPoll(asked, index, change.target.value) })} />
              </span>
            ))}
          </div>
        </div>
      );
    // Объект, которому нечем наполниться (каталог промолчал), не рисуется вовсе: пустая рамка на холсте хуже её отсутствия.
    return null;
  };

  const drawn = draft.objects.map((object) => ({ object, body: objectBody(object.kind) })).filter((item) => item.body !== null);

  return (
    <section ref={frameRef} className={onPhotoCanvas ? `app-story-compose app-story-compose--photo${draft.cropping ? " app-story-compose--cropping" : ""}` : `app-story-compose app-story-compose--${draft.canvas}`} aria-label="Публикация истории">
      {onPhotoCanvas && (
        <img
          className="app-story-photo"
          src={draft.photoUrl ?? ""}
          alt=""
          style={storyPhotoStyle(draft)}
          onPointerDown={(event) => {
            if (!draft.cropping) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            cropDrag.current = { x: event.clientX, y: event.clientY, cropX: draft.cropX, cropY: draft.cropY };
          }}
          onPointerMove={(event) => {
            const start = cropDrag.current;
            const frame = frameRef.current;
            if (start === null || frame === null) return;
            const size = Math.min(frame.clientWidth, frame.clientHeight);
            const delta = cropDeltaFromPointer(event.clientX - start.x, event.clientY - start.y, size);
            onDraft({ ...draft, ...panStoryCrop(start.cropX, start.cropY, -delta.dx, -delta.dy) });
          }}
          onPointerUp={() => {
            cropDrag.current = null;
          }}
        />
      )}
      <span className="app-story-orb app-story-orb--light" aria-hidden="true" />
      <span className="app-story-orb app-story-orb--status" aria-hidden="true" />

      <div className="app-story-bar">
        <button type="button" className="app-story-round" aria-label="Закрыть" onClick={onClose}>
          <ActionIcon name="close" size={18} strokeWidth={2.6} />
        </button>
        <div className="app-story-bar-actions">
          <button
            type="button"
            className="app-story-round"
            aria-label="Добавить текст"
            onClick={() => {
              putObject("text");
              captionRef.current?.focus();
            }}
          >
            <ActionIcon name="text" size={20} strokeWidth={2} />
          </button>
          {onPhotoCanvas ? (
            <button type="button" className="app-story-round" aria-label="Повернуть фото" onClick={() => onDraft({ ...draft, rotate: rotateStoryPhoto(draft.rotate) })}>
              <ActionIcon name="adjust" size={20} strokeWidth={2} />
            </button>
          ) : (
            <span className="app-story-round app-story-round--muted" aria-hidden="true">
              <ActionIcon name="adjust" size={20} strokeWidth={2} />
            </span>
          )}
          {onPhotoCanvas ? (
            <button type="button" className="app-story-round" aria-label="Кадрировать фото" aria-pressed={draft.cropping} onClick={() => onDraft({ ...draft, cropping: !draft.cropping })}>
              <ActionIcon name="sparkle" size={20} strokeWidth={2} />
            </button>
          ) : (
            <span className="app-story-round app-story-round--muted" aria-hidden="true">
              <ActionIcon name="sparkle" size={20} strokeWidth={2} />
            </span>
          )}
        </div>
      </div>

      {drawn.length === 0 && <p className="app-story-empty">Пустой холст. Выберите фон и добавьте объекты снизу: текст, событие, опрос, счётчик мест.</p>}

      {drawn.map(({ object, body }) => {
        const label = STORY_OBJECTS[object.kind].label;
        const scale = object.scale ?? 1;
        return (
          // Ручки живут на выбранном объекте: четыре набора разом закрывали холст сильнее самих объектов.
          <div key={object.kind} className={storyObjectClass(object.kind, front)} style={storyObjectStyle(object)} onPointerDown={() => setTouched(object.kind)}>
            {front === object.kind && (
              <span className="app-story-object-tools">
                <button type="button" className="app-story-object-grip" aria-label={`Передвинуть: ${label}`} onPointerDown={(event) => startDrag(object, event)}>
                  <ActionIcon name="dots" size={14} filled />
                </button>
                <button type="button" className="app-story-object-size" aria-label={`Мельче: ${label}`} disabled={scale === STORY_OBJECT_SCALES[0]} onClick={() => onDraft({ ...draft, objects: resizeStoryObject(draft.objects, object.kind, -1) })}>
                  <ActionIcon name="minus" size={12} strokeWidth={2.6} />
                </button>
                <button type="button" className="app-story-object-size" aria-label={`Крупнее: ${label}`} disabled={scale === STORY_OBJECT_SCALES[STORY_OBJECT_SCALES.length - 1]} onClick={() => onDraft({ ...draft, objects: resizeStoryObject(draft.objects, object.kind, 1) })}>
                  <ActionIcon name="plus" size={12} strokeWidth={2.6} />
                </button>
                <button type="button" className="app-story-object-drop" aria-label={`Убрать: ${label}`} onClick={() => dropObject(object.kind)}>
                  <ActionIcon name="close" size={12} strokeWidth={2.6} />
                </button>
              </span>
            )}
            {body}
          </div>
        );
      })}

      <div className="app-story-foot">
        {/* Каталог объектов: в макете они были показом возможностей, здесь — кнопки, которыми автор собирает свою историю. */}
        <div className="app-story-catalog">
          {STORY_OBJECT_ORDER.map((kind) => {
            const on = hasStoryObject(draft.objects, kind);
            return (
              // Лежащий на холсте объект снимается всегда: у события без мест счётчик не рисуется, и
              // погашенная кнопка запирала бы его в черновике — снять его было бы уже нечем.
              <button key={kind} type="button" className={on ? "app-story-catalog-chip app-story-catalog-chip--on" : "app-story-catalog-chip"} aria-pressed={on} disabled={!on && !storyObjectEnabled(kind, sticker, asked)} onClick={() => toggleObject(kind)}>
                <ActionIcon name={STORY_OBJECTS[kind].icon} size={16} strokeWidth={2.2} />
                {STORY_OBJECTS[kind].label}
              </button>
            );
          })}
        </div>
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
  // Холст пуст: объекты появляются только по действию автора, поэтому objects начинается пустым, а опроса нет вовсе.
  const [draft, setDraft] = useState<StoryDraft>({ canvas: "gradient-1", photoUrl: null, text: "", eventId: null, poll: null, audience: "close-friends", objects: [], rotate: 0, cropX: 0, cropY: 0, cropping: false });
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
    const raw = draft.canvas === "photo" && draft.photoUrl !== null ? draft.photoUrl : storyCanvasImage(draft.canvas);
    const baked = draft.canvas === "photo" && draft.photoUrl !== null ? bakeStoryPhoto(draft.photoUrl, draft.rotate, draft.cropX, draft.cropY) : Promise.resolve(raw);
    baked
      .then((imageUrl) => apiClient.createStory(imageUrl, storyComposition(draft, sticker, poll)))
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
        aria-label="Выбрать фото для истории"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          change.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") return;
            setDraft((current) => ({ ...current, photoUrl: reader.result as string, canvas: "photo", rotate: 0, cropX: 0, cropY: 0, cropping: false }));
            setState("idle");
          };
          reader.readAsDataURL(file);
        }}
      />
      <StoryCreateView draft={draft} sticker={sticker} poll={poll} events={events} state={state} onDraft={setDraft} onPickPhoto={() => fileRef.current?.click()} onPublish={publish} onClose={back} />
    </>
  );
}
