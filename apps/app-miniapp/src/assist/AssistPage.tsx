// START_MODULE_CONTRACT
// PURPOSE: Экран 10 «MAX AI ассистент»: переписка с подборщиком — реплики, карточки вариантов под ответом, сборка плана на вечер, подсказки и строка ввода.
// SCOPE: Данные только через apiClient.assistChat (POST /assist/chat); 429 отдаёт текст про частые запросы; молчание не добавляет реплику MAX; «Открыть» и openEventId ведут на событие, собранный план — на экран плана. Ветка переписки хранится в состоянии экрана: истории диалогов на бэкенде нет и она ей не нужна.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (AssistChatResponse, AssistDayResponse, AssistPick, AssistResponse, Event, PlanCardSchema), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../plans/PlanTimeline.js (planStepTime), ./AssistSection.js (assistErrorMessage), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ASSIST_GREETING - первая реплика MAX, с которой открывается экран
// - ASSIST_PROMPTS - три подсказки над строкой ввода, в порядке макета
// - ASSIST_PLACEHOLDER - плейсхолдер строки ввода
// - AssistBubble - одна реплика ветки: чья, текст, приложенные варианты и собранный план
// - AssistThread - ветка реплик
// - isSaturdayPlanPrompt - просьба собрать план (суббота, шашлык, мангал); экран больше не ветвится на ней и шлёт фразу в чат
// - askedThread - добавить вопрос пользователя в ветку
// - answeredThread - добавить ответ MAX с вариантами
// - plannedThread - добавить ответ MAX с планом на вечер
// - chatThread - молчание оставляет ветку; иначе реплика MAX из reply, карточек и дня
// - assistChatTranscript - последние 8 реплик для POST /assist/chat; текст каждой не длиннее 400, пузырь на экране не режется
// - assistPickMeta - «20:00 · Концерт · 1 800 ₽» под названием варианта; бесплатный вход говорит об этом словами
// - AssistPageState - idle/loading/error статус запроса к ассистенту
// - AssistPageView - презентационная часть: шапка-градиент, ветка, подсказки и композер
// - ASSIST_GUIDES - подпись и маршрут раздела, который MAX может предложить
// - AssistPage - контейнер маршрута assist: ведёт переписку через POST /assist/chat
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import { PlanCardSchema, type AssistChatResponse, type AssistDayResponse, type AssistGuideId, type AssistPick, type AssistResponse, type Event } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { planStepTime } from "../plans/PlanTimeline";
import { useRoute, type Route } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppButton, AppMedia, AppState } from "../ui/primitives";
import { assistErrorMessage } from "./AssistSection";

/** Первая реплика: экран объясняет, о чём его вообще можно спросить, а не ждёт молча (макет, экран 10). */
export const ASSIST_GREETING = "Привет! Могу собрать план на день, найти свободную мангальную зону или корт под твой бюджет и компанию. О чём думаешь сегодня?";

export const ASSIST_PROMPTS: readonly string[] = ["Что-то бесплатное рядом", "План на субботу: шашлык", "Куда с детьми"];

export const ASSIST_PLACEHOLDER = "Спроси MAX: куда сходить, беседки, корты…";

export function isSaturdayPlanPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("план") && (lower.includes("суббот") || lower.includes("шашлык") || lower.includes("мангал"));
}

/** Одна реплика ветки. У ответа MAX могут быть приложены варианты или собранный план — но не оба сразу. */
export interface AssistBubble {
  id: number;
  role: "max" | "me";
  text: string;
  picks: AssistPick[];
  day: AssistDayResponse | null;
  guides: AssistGuideId[];
}

export type AssistThread = AssistBubble[];

export function askedThread(thread: AssistThread, question: string): AssistThread {
  return [...thread, { id: thread.length + 1, role: "me", text: question, picks: [], day: null, guides: [] }];
}

export function answeredThread(thread: AssistThread, result: AssistResponse): AssistThread {
  return [...thread, { id: thread.length + 1, role: "max", text: result.summary, picks: result.items, day: null, guides: [] }];
}

export function plannedThread(thread: AssistThread, result: AssistDayResponse): AssistThread {
  return [...thread, { id: thread.length + 1, role: "max", text: result.summary, picks: [], day: result, guides: [] }];
}

/** Подписи и маршруты разделов, которые MAX может предложить. Чужой id сюда не попадает. */
export const ASSIST_GUIDES: Record<AssistGuideId, { label: string; hint: string; route: Route }> = {
  search: { label: "Афиша", hint: "Искать события по фильтрам", route: { name: "search" } },
  map: { label: "Карта", hint: "События и места рядом", route: { name: "map" } },
  swipe: { label: "Свайп", hint: "Листать варианты и оставлять понравившиеся", route: { name: "swipe" } },
  plans: { label: "Планы", hint: "Собрать выход с друзьями", route: { name: "plans" } },
  calendar: { label: "Календарь", hint: "Что уже стоит в расписании", route: { name: "calendar" } },
  friends: { label: "Друзья", hint: "Люди и куда они идут", route: { name: "friends" } },
  lists: { label: "Списки", hint: "Сохранить событие себе или в общий список", route: { name: "lists" } },
  story: { label: "Истории", hint: "Короткое видео с места", route: { name: "story-new" } },
  post: { label: "Пост", hint: "Написать в ленту", route: { name: "feed-new", eventId: null } },
  nearby: { label: "Рядом", hint: "Свободные часы без билета", route: { name: "nearby" } },
  "day-route": { label: "Маршрут на день", hint: "Несколько точек в один день", route: { name: "day-route" } },
  profile: { label: "Профиль", hint: "Свои данные и достижения", route: { name: "profile" } },
  companies: { label: "Компании", hint: "Группа и голосование, куда идти", route: { name: "we-groups" } },
  micro: { label: "Микрособытия", hint: "Короткая встреча рядом", route: { name: "micro" } },
};

const ASSIST_TRANSCRIPT_TEXT_MAX = 400;

/** Ход в transcript не длиннее 400: схема его отвергает. Пузырь на экране остаётся целиком. */
export function assistChatTranscript(thread: AssistThread): { role: "user" | "assistant"; text: string }[] {
  return thread.slice(-8).map((bubble) => ({ role: bubble.role === "me" ? "user" : "assistant", text: bubble.text.slice(0, ASSIST_TRANSCRIPT_TEXT_MAX) }));
}

/** Молчание — та же ветка, без пузыря MAX. Иначе текст пузыря это reply, не старый шаблон summary. */
export function chatThread(thread: AssistThread, response: AssistChatResponse): AssistThread {
  if (response.silence) return thread;
  return [...thread, { id: thread.length + 1, role: "max", text: response.reply ?? "", picks: response.items ?? [], day: response.day ?? null, guides: response.guides ?? [] }];
}

/** Строка под названием варианта. Расстояния у события нет — оно живёт у площадки, — поэтому его здесь и нет. */
export function assistPickMeta(event: Pick<Event, "startsAt" | "category" | "isPaid" | "priceRub">): string {
  const price = event.isPaid && event.priceRub !== null ? `${event.priceRub.toLocaleString("ru-RU")} ₽` : "вход свободный";
  return `${formatStartsAt(event.startsAt)} · ${CATEGORY_LABELS[event.category]} · ${price}`;
}

export type AssistPageState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

function PickCard({ pick, onOpen }: { pick: AssistPick; onOpen: () => void }) {
  return (
    <button type="button" className="app-assist-pick" onClick={onOpen}>
      <AppMedia category={pick.event.category} src={pictured(pick.event.id, pick.event.coverUrl)} className="app-assist-pick-media" />
      <span className="app-assist-pick-body">
        <span className="app-assist-pick-title">{pick.event.title}</span>
        <span className="app-assist-pick-meta">{assistPickMeta(pick.event)}</span>
        <span className="app-assist-pick-why">{pick.explanation}</span>
      </span>
      <span className="app-assist-pick-open">Открыть</span>
    </button>
  );
}

function DayCard({ day, onOpenEvent, onOpenPlan }: { day: AssistDayResponse; onOpenEvent: (eventId: string) => void; onOpenPlan: (planId: string) => void }) {
  const plan = PlanCardSchema.safeParse(day.plan);
  return (
    <div className="app-assist-day">
      <ol className="app-assist-day-stops">
        {day.stops.map((stop) => (
          <li key={stop.event.id}>
            <button type="button" className="app-assist-day-stop" onClick={() => onOpenEvent(stop.event.id)}>
              {/* Внутри дня дата у каждой точки лишняя — какой это день, сказано репликой над карточкой */}
              <span className="app-assist-day-at">{planStepTime(stop.at)}</span>
              <span className="app-assist-day-title">{stop.event.title}</span>
              <span className="app-assist-day-why">{stop.explanation}</span>
            </button>
          </li>
        ))}
      </ol>
      {plan.success && (
        <AppButton tone="confirm" stretched onClick={() => onOpenPlan(plan.data.plan.id)}>
          Открыть план
        </AppButton>
      )}
    </div>
  );
}

interface AssistPageViewProps {
  thread: AssistThread;
  draft: string;
  state: AssistPageState;
  /** Пока вопроса не было, кнопки под ответом нечего повторять — их и нет. */
  lastQuestion: string | null;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onPlanEvening: () => void;
  onMoreOptions: () => void;
  onPrompt: (prompt: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenPlan: (planId: string) => void;
  onOpenGuide: (guide: AssistGuideId) => void;
  onClose: () => void;
}

export function AssistPageView({ thread, draft, state, lastQuestion, onDraft, onSubmit, onPlanEvening, onMoreOptions, onPrompt, onOpenEvent, onOpenPlan, onOpenGuide, onClose }: AssistPageViewProps) {
  const answered = thread.some((bubble) => bubble.role === "max" && bubble.picks.length > 0);
  return (
    <section className="app-assist" aria-label="MAX AI ассистент">
      <header className="app-assist-hero">
        <span className="app-assist-mark" aria-hidden="true">
          <ActionIcon name="spark" size={22} filled />
        </span>
        <span className="app-assist-hero-text">
          <span className="app-assist-hero-title">MAX AI ассистент</span>
          <span className="app-assist-hero-sub">Подбор по контексту, бюджету и друзьям</span>
        </span>
        <button type="button" className="app-assist-hero-close" aria-label="Закрыть ассистента" onClick={onClose}>
          <ActionIcon name="close" size={18} strokeWidth={2} />
          Закрыть
        </button>
      </header>

      <div className="app-assist-thread">
        {thread.map((bubble) => (
          <div key={bubble.id} className={bubble.role === "me" ? "app-assist-turn app-assist-turn--me" : "app-assist-turn"}>
            <p className={bubble.role === "me" ? "app-assist-bubble app-assist-bubble--me" : "app-assist-bubble"}>{bubble.text}</p>
            {bubble.picks.length > 0 && (
              <div className="app-assist-picks">
                {bubble.picks.map((pick) => (
                  <PickCard key={pick.event.id} pick={pick} onOpen={() => onOpenEvent(pick.event.id)} />
                ))}
              </div>
            )}
            {bubble.day !== null && <DayCard day={bubble.day} onOpenEvent={onOpenEvent} onOpenPlan={onOpenPlan} />}
            {bubble.guides.length > 0 && (
              <div className="app-assist-prompts" role="group" aria-label="Разделы приложения">
                {bubble.guides.map((guide) => (
                  <button key={guide} type="button" className="app-assist-prompt" onClick={() => onOpenGuide(guide)}>
                    {ASSIST_GUIDES[guide].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {state.status === "loading" && (
          <p className="app-ai-seek" role="status">
            <span className="app-ai-seek-word">Подбираем</span>
          </p>
        )}
        {state.status === "error" && <AppState error>{state.message}</AppState>}
        {answered && lastQuestion !== null && state.status !== "loading" && (
          <div className="app-assist-actions">
            <AppButton tone="confirm" size="small" onClick={onPlanEvening}>
              Собрать план на вечер
            </AppButton>
            <AppButton tone="secondary" size="small" onClick={onMoreOptions}>
              Ещё варианты
            </AppButton>
          </div>
        )}
      </div>

      <div className="app-assist-prompts" role="group" aria-label="Подсказки">
        {ASSIST_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" className="app-assist-prompt" onClick={() => onPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="app-assist-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input className="app-assist-input" type="text" value={draft} aria-label="Вопрос ассистенту" placeholder={ASSIST_PLACEHOLDER} onChange={(event) => onDraft(event.target.value)} />
        <button type="submit" className="app-assist-send" aria-label="Спросить" disabled={draft.trim() === "" || state.status === "loading"}>
          <ActionIcon name="arrow" size={22} strokeWidth={2} />
        </button>
      </form>
    </section>
  );
}

export function AssistPage({ ask = null }: { ask?: string | null }) {
  const { navigate, back } = useRoute();
  const [thread, setThread] = useState<AssistThread>([{ id: 0, role: "max", text: ASSIST_GREETING, picks: [], day: null, guides: [] }]);
  const [draft, setDraft] = useState(ask ?? "");
  const [state, setState] = useState<AssistPageState>({ status: "idle" });
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  // Состояние живёт в замыканиях обработчиков, поэтому вопрос и ветка читаются через ref — иначе
  // повторный запрос («Ещё варианты») ушёл бы со старым текстом.
  const pending = useRef(false);

  useEffect(() => {
    setDraft(ask ?? "");
  }, [ask]);

  const finishChat = (response: AssistChatResponse) => {
    pending.current = false;
    if (!response.silence) {
      setThread((current) => chatThread(current, response));
      if (response.openEventId !== undefined) navigate({ name: "event", id: response.openEventId });
    }
    setState({ status: "idle" });
  };

  const askMax = (question: string) => {
    const text = question.trim();
    if (text === "" || pending.current) return;
    pending.current = true;
    setThread((current) => askedThread(current, text));
    setLastQuestion(text);
    setDraft("");
    setState({ status: "loading" });
    apiClient
      .assistChat({
        message: text,
        transcript: assistChatTranscript(thread),
        offeredEventIds: [
          ...(thread
            .slice()
            .reverse()
            .find((bubble) => bubble.role === "max")?.picks ?? []),
        ]
          .slice(0, 4)
          .map((pick) => pick.event.id),
      })
      .then(finishChat, (error: unknown) => {
        pending.current = false;
        setState({ status: "error", message: assistErrorMessage(error, "Не удалось подобрать варианты. Попробуйте ещё раз.") });
      });
  };

  const planEvening = () => {
    if (pending.current) return;
    pending.current = true;
    // Кнопка обещает сохранённый план: тот же чат, но с save=true, а не прямой POST /assist/day.
    setState({ status: "loading" });
    apiClient
      .assistChat({
        message: "Собрать план на вечер",
        save: true,
        transcript: assistChatTranscript(thread),
        offeredEventIds: [
          ...(thread
            .slice()
            .reverse()
            .find((bubble) => bubble.role === "max")?.picks ?? []),
        ]
          .slice(0, 4)
          .map((pick) => pick.event.id),
      })
      .then(finishChat, (error: unknown) => {
        pending.current = false;
        setState({ status: "error", message: assistErrorMessage(error, "Не удалось собрать план на вечер.") });
      });
  };

  return <AssistPageView thread={thread} draft={draft} state={state} lastQuestion={lastQuestion} onDraft={setDraft} onSubmit={() => askMax(draft)} onPlanEvening={planEvening} onMoreOptions={() => askMax(lastQuestion === null ? "Ещё варианты" : `${lastQuestion}, ещё варианты`)} onPrompt={askMax} onOpenEvent={(id) => navigate({ name: "event", id })} onOpenPlan={(id) => navigate({ name: "plan", id })} onOpenGuide={(guide) => navigate(ASSIST_GUIDES[guide].route)} onClose={back} />;
}
