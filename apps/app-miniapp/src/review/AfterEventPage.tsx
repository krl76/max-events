// START_MODULE_CONTRACT
// PURPOSE: Экран 35 «После события»: the gradient hero with the question, the four-way verdict, «Что было правдой?» tags, the company photos with their audience line, «Твой вкус уточнился» weights and «Сохранить и поделиться в чат».
// SCOPE: One event, opened by the push that follows it (start_param «after-<eventId>»). Reads apiClient.getEventDetails/listReviewFactTags/listFeedPosts/getParticipationStats/getTaste, writes apiClient.createReview and shares the result into a MAX chat.
// DEPENDS: ../api/client.js (apiClient, ReviewFactTag, FeedPost), ../auth/AuthContext.js, ../catalog/format.js (CATEGORY_LABELS, pluralRu), ../max/bridge.js (shareResult, webApp), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Event, TasteProfile), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AFTER_EVENT_VERDICTS - the four answers of the design with the stars and «пойду ещё раз» each one means
// - AfterEventVerdict - one verdict option
// - verdictReview - verdict + picked tags -> the review payload createReview takes
// - afterEventWhen - «Вчера · Парк Горького» — when it was and where
// - afterEventQuestion - «Как было на «Субботник в Парке Горького»?»
// - audienceLine - «видят только 8 участников»
// - tasteRows - taste graph -> the labelled 0..100 shares the block draws
// - tasteLead - the sentence above the bars, naming the strongest category
// - AfterEventView - presentational: hero, verdict, fact tags, photos, taste, the save button
// - AfterEventPage - route container: loads the event, the tags, the photos, the audience and the taste, submits the review and shares it
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, TasteProfile } from "@max-events/api-contracts";
import { apiClient, type CreateReview, type FeedPost, type ReviewFactTag } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { shareResult, webApp } from "../max/bridge";
import { sharePayload } from "../max/links";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppState } from "../ui/primitives";

export interface AfterEventVerdict {
  code: string;
  label: string;
  stars: number;
  wouldGoAgain: boolean;
}

/**
 * The design asks one question with four answers; the contract stores stars plus «пойду ещё раз».
 * «Ещё раз» is the only answer that promises a return, so it is the only one that sets the flag.
 */
export const AFTER_EVENT_VERDICTS: readonly AfterEventVerdict[] = [
  { code: "not_mine", label: "Не моё", stars: 2, wouldGoAgain: false },
  { code: "ok", label: "Норм", stars: 3, wouldGoAgain: false },
  { code: "great", label: "Отлично", stars: 5, wouldGoAgain: false },
  { code: "again", label: "Ещё раз", stars: 5, wouldGoAgain: true },
];

export function verdictReview(userId: string, eventId: string, verdict: AfterEventVerdict, factTags: string[]): CreateReview {
  return { userId, eventId, stars: verdict.stars, wouldGoAgain: verdict.wouldGoAgain, factTags };
}

/** «Вчера · Парк Горького»; without a place the day stands alone, and past the week a date replaces it. */
export function afterEventWhen(startsAt: string, placeTitle: string | null, now: Date): string {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const date = new Date(startsAt);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const when = days <= 0 ? "Сегодня" : days === 1 ? "Вчера" : days < 7 ? `${days} ${pluralRu(days, "день", "дня", "дней")} назад` : date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return placeTitle === null ? when : `${when} · ${placeTitle}`;
}

export function afterEventQuestion(event: Pick<Event, "title">): string {
  return `Как было на «${event.title}»?`;
}

/** «видят только 8 участников» — the closed audience of the company photos. */
export function audienceLine(participants: number): string {
  return `видят только ${participants} ${pluralRu(participants, "участник", "участника", "участников")}`;
}

/**
 * The bars are shares of the taste graph, not raw weights: a weight is a running count whose scale
 * means nothing on screen, while «сколько это от твоего вкуса» is comparable across categories.
 * The design's own rows («На природе», «Музыка») come from a richer taxonomy than EventCategory (#505).
 */
export function tasteRows(taste: TasteProfile | null): { label: string; share: number }[] {
  const categories = taste?.eventCategories.filter((row) => row.weight > 0) ?? [];
  const total = categories.reduce((sum, row) => sum + row.weight, 0);
  if (total === 0) return [];
  return categories.map((row) => ({ label: CATEGORY_LABELS[row.category], share: Math.round((row.weight / total) * 100) })).sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
}

export function tasteLead(rows: { label: string; share: number }[]): string {
  const strongest = rows[0];
  if (strongest === undefined) return "Пока рано делать выводы — сходи ещё куда-нибудь, и мы подтянем похожее.";
  return `«${strongest.label}» — теперь твоя сильная тема. Подтянем похожее на следующие выходные.`;
}

interface AfterEventViewProps {
  event: Event;
  placeTitle: string | null;
  now: Date;
  factTags: ReviewFactTag[];
  photos: FeedPost[];
  participants: number | null;
  taste: TasteProfile | null;
  verdictCode: string | null;
  pickedTags: string[];
  saving: boolean;
  failed: boolean;
  onVerdict: (verdict: AfterEventVerdict) => void;
  onTag: (code: string) => void;
  onAddPhoto: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function AfterEventView({ event, placeTitle, now, factTags, photos, participants, taste, verdictCode, pickedTags, saving, failed, onVerdict, onTag, onAddPhoto, onClose, onSave }: AfterEventViewProps) {
  const rows = tasteRows(taste);
  return (
    <section className="app-after">
      <div className="app-after-hero">
        <span className="app-after-blob" aria-hidden="true" />
        <button type="button" className="app-after-close" aria-label="Закрыть" onClick={onClose}>
          <ActionIcon name="close" size={18} strokeWidth={2.5} />
          Закрыть
        </button>
        <span className="app-after-hero-veil">
          <span className="app-after-when">{afterEventWhen(event.startsAt, placeTitle, now)}</span>
          <span className="app-after-question">{afterEventQuestion(event)}</span>
        </span>
      </div>
      <div className="app-after-body">
        <div className="app-after-verdicts" role="radiogroup" aria-label="Оценка">
          {AFTER_EVENT_VERDICTS.map((verdict) => {
            const on = verdictCode === verdict.code;
            return (
              <button key={verdict.code} type="button" role="radio" aria-checked={on} className={on ? "app-after-verdict app-after-verdict--on" : "app-after-verdict"} onClick={() => onVerdict(verdict)}>
                {on && <ActionIcon name="sparkle" size={20} filled />}
                {verdict.label}
              </button>
            );
          })}
        </div>
        {factTags.length > 0 && (
          <>
            <p className="app-after-label">Что было правдой?</p>
            <div className="app-after-facts">
              {factTags.map((tag) => {
                const on = pickedTags.includes(tag.code);
                return (
                  <button key={tag.code} type="button" aria-pressed={on} className={on ? "app-after-fact app-after-fact--on" : "app-after-fact"} onClick={() => onTag(tag.code)}>
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="app-after-photos-head">
          <span className="app-after-photos-title">Фото компании</span>
          {participants !== null && <span className="app-after-photos-audience">{audienceLine(participants)}</span>}
        </div>
        <div className="app-after-photos">
          {photos.slice(0, 2).map((post, index) => (
            <span key={post.id} className={`app-after-photo app-after-photo--${(index % 2) + 1}`}>
              {post.photoUrl !== null && <img alt="" src={post.photoUrl} />}
              <span className="app-after-photo-author" aria-hidden="true">
                {post.author.name.charAt(0)}
              </span>
            </span>
          ))}
          <button type="button" className="app-after-photo-add" aria-label="Добавить фото" onClick={onAddPhoto}>
            <ActionIcon name="camera" size={24} strokeWidth={2} />
          </button>
        </div>
        <div className="app-after-taste">
          <p className="app-after-taste-title">Твой вкус уточнился</p>
          <p className="app-after-taste-text">{tasteLead(rows)}</p>
          {rows.length > 0 && (
            <ul className="app-after-taste-rows">
              {rows.map((row) => (
                <li key={row.label} className="app-after-taste-row">
                  <span className="app-after-taste-label">{row.label}</span>
                  <span className="app-after-taste-bar" aria-hidden="true">
                    <span className="app-after-taste-fill" style={{ width: `${row.share}%` }} />
                  </span>
                  <span className="app-after-taste-value">{row.share}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {failed && <p className="app-after-error">Не удалось сохранить. Попробуй ещё раз.</p>}
      </div>
      <div className="app-after-foot">
        <button type="button" className="app-after-save" disabled={verdictCode === null || saving} onClick={onSave}>
          {saving ? "Сохраняем…" : "Сохранить и поделиться в чат"}
        </button>
      </div>
    </section>
  );
}

export function AfterEventPage({ eventId }: { eventId: string }) {
  const auth = useAuth();
  const { navigate, back } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [event, setEvent] = useState<Event | null>(null);
  const [placeTitle, setPlaceTitle] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [factTags, setFactTags] = useState<ReviewFactTag[]>([]);
  const [photos, setPhotos] = useState<FeedPost[]>([]);
  const [participants, setParticipants] = useState<number | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [verdict, setVerdict] = useState<AfterEventVerdict | null>(null);
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const now = new Date();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setLoadFailed(false);
    apiClient.getEventDetails(eventId, userId).then(
      (details) => {
        if (!alive) return;
        setEvent(details.event);
        setPlaceTitle(details.place?.title ?? null);
      },
      () => {
        if (alive) setLoadFailed(true);
      },
    );
    apiClient.listReviewFactTags(eventId).then(
      (tags) => {
        if (alive) setFactTags(tags);
      },
      // No dictionary, no block: the rest of the screen still answers the question it asks (#500).
      () => {},
    );
    apiClient.listFeedPosts(eventId).then(
      (posts) => {
        if (alive) setPhotos(posts.filter((post) => post.photoUrl !== null));
      },
      () => {},
    );
    apiClient.getParticipationStats(eventId, userId).then(
      (stats) => {
        if (alive) setParticipants(stats.counts.going);
      },
      () => {},
    );
    apiClient.getTaste().then(
      (profile) => {
        if (alive) setTaste(profile);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [eventId, userId, attempt]);

  if (loadFailed)
    return (
      <AppState error action={{ label: "Повторить", onClick: () => setAttempt((n) => n + 1) }}>
        Не удалось загрузить событие.
      </AppState>
    );
  if (event === null || userId === null) return <AppState>Загрузка…</AppState>;

  return (
    <AfterEventView
      event={event}
      placeTitle={placeTitle}
      now={now}
      factTags={factTags}
      photos={photos}
      participants={participants}
      taste={taste}
      verdictCode={verdict?.code ?? null}
      pickedTags={pickedTags}
      saving={saving}
      failed={saveFailed}
      onVerdict={setVerdict}
      onTag={(code) => setPickedTags((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]))}
      onAddPhoto={() => navigate({ name: "feed-new", eventId })}
      onClose={back}
      onSave={() => {
        if (verdict === null) return;
        setSaving(true);
        setSaveFailed(false);
        apiClient.createReview(verdictReview(userId, eventId, verdict, pickedTags)).then(
          async () => {
            const payload = sharePayload(`${event.title} — ${verdict.label}`, `after-${eventId}`);
            await shareResult(webApp, payload.text, payload.link);
            setSaving(false);
            // Выход с экрана — профиль: там и лежит то, что этот экран только что уточнил.
            navigate({ name: "profile" });
          },
          () => {
            setSaving(false);
            setSaveFailed(true);
          },
        );
      }}
    />
  );
}
