// START_MODULE_CONTRACT
// PURPOSE: "Как прошло?" block: aggregated event rating plus the post-event review form (stars, category scores, would-go-again, text, photo placeholder).
// SCOPE: Presentational RatingView and ReviewForm plus the ReviewSection container that loads EventRating via apiClient and submits reviews; the form is gated by the canReview flag (past event + user was booked) computed by EventPage.
// DEPENDS: ../api/client.js (apiClient, EventRating, CreateReview), @max-events/api-contracts (ReviewCategoryScores), ../catalog/format.js (pluralRu), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CATEGORY_SCORE_LABELS - ru labels of the four review categories
// - ReviewDraft - review form draft (stars, category scores, would-go-again, text)
// - RatingView - presentational: "4.8 ⭐ (N отзывов)" plus non-empty per-category averages
// - ReviewForm - presentational: star picker, per-category stars, would-go-again, text field, photo placeholder and submit
// - ReviewSection - container: loads the rating aggregate, gates the form, submits the review and reloads the aggregate
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type EventRating } from "../api/client";
import type { ReviewCategoryScores, TasteProfile } from "@max-events/api-contracts";
import { CATEGORY_LABELS } from "../catalog/CatalogPage";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { AppButton, AppChip, AppTitle } from "../ui/primitives";

export const CATEGORY_SCORE_LABELS: Record<keyof ReviewCategoryScores, string> = {
  atmosphere: "Атмосфера",
  organization: "Организация",
  price: "Цена",
  place: "Место",
};

const CATEGORY_KEYS = Object.keys(CATEGORY_SCORE_LABELS) as (keyof ReviewCategoryScores)[];
const STARS = [1, 2, 3, 4, 5];

export function RatingView({ rating }: { rating: EventRating }) {
  if (rating.summary.reviewsCount === 0) return null;
  return (
    <div className="app-review-summary">
      <p className="app-review-average">
        {rating.summary.averageStars.toFixed(1)} ⭐ ({rating.summary.reviewsCount} {pluralRu(rating.summary.reviewsCount, "отзыв", "отзыва", "отзывов")})
      </p>
      <ul className="app-review-categories">
        {CATEGORY_KEYS.filter((key) => rating.categoryAverages[key] !== null).map((key) => (
          <li key={key}>
            {CATEGORY_SCORE_LABELS[key]}: {rating.categoryAverages[key]!.toFixed(1)} ⭐
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ReviewDraft {
  stars: number;
  categoryScores: ReviewCategoryScores;
  wouldGoAgain: boolean;
  text: string;
  photos: { url: string }[];
}

export function ReviewForm({ onSubmit, sending }: { onSubmit: (draft: ReviewDraft) => void; sending: boolean }) {
  const [stars, setStars] = useState(0);
  const [scores, setScores] = useState<ReviewCategoryScores>({});
  const [wouldGoAgain, setWouldGoAgain] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<{ url: string }[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const ready = stars > 0 && wouldGoAgain !== null;
  const photosFull = photos.length >= 4;

  const starButtons = (picked: number, pick: (value: number) => void) => (
    <div className="app-review-stars">
      {STARS.map((value) => (
        <button key={value} type="button" className="app-review-star" aria-pressed={picked >= value} onClick={() => pick(value)}>
          ★
        </button>
      ))}
    </div>
  );

  return (
    <form
      className="app-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onSubmit({ stars, categoryScores: scores, wouldGoAgain: wouldGoAgain as boolean, text, photos });
      }}
    >
      {starButtons(stars, setStars)}
      {CATEGORY_KEYS.map((key) => (
        <div key={key} className="app-review-category">
          <span className="app-review-category-label">{CATEGORY_SCORE_LABELS[key]}</span>
          {starButtons(scores[key] ?? 0, (value) => setScores((prev) => ({ ...prev, [key]: value })))}
        </div>
      ))}
      <div className="app-review-again">
        <AppChip pressed={wouldGoAgain === true} onClick={() => setWouldGoAgain(true)}>
          Да
        </AppChip>
        <AppChip pressed={wouldGoAgain === false} onClick={() => setWouldGoAgain(false)}>
          Нет
        </AppChip>
      </div>
      <textarea className="app-review-text" placeholder="Расскажи, как всё прошло (необязательно)" value={text} onChange={(event) => setText(event.target.value)} />
      {photos.length > 0 && (
        <ul className="app-plan-participants" aria-label="Фото отзыва">
          {photos.map((photo) => (
            <li key={photo.url}>
              <img src={photo.url} alt="" className="app-card-media-img" />
            </li>
          ))}
        </ul>
      )}
      {photoFailed && <p className="app-state app-state--error">Не удалось добавить фото. Выберите файл поменьше.</p>}
      <label className="app-review-photo">
        Добавить фото
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={photosFull}
          onChange={(change) => {
            const file = change.target.files?.[0];
            change.target.value = "";
            if (!file || photosFull) return;
            setPhotoFailed(false);
            void readFeedPhoto(file).then((url) => {
              if (url) setPhotos((current) => (current.length >= 4 ? current : [...current, { url }]));
              else setPhotoFailed(true);
            });
          }}
        />
      </label>
      <AppButton disabled={!ready || sending} type="submit" stretched>
        Отправить отзыв
      </AppButton>
    </form>
  );
}

export function ReviewSection({ eventId, userId, canReview }: { eventId: string; userId: string; canReview: boolean }) {
  const [rating, setRating] = useState<EventRating | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [taste, setTaste] = useState<TasteProfile | null>(null);

  const load = useCallback(() => {
    apiClient.getEventRating(eventId).then(
      (next) => {
        setRating(next);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [eventId]);
  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    (draft: ReviewDraft) => {
      setSending(true);
      apiClient
        .createReview({ userId, eventId, ...draft, text: draft.text === "" ? undefined : draft.text, photos: draft.photos })
        .then(() => {
          setSent(true);
          load();
          apiClient.getTaste().then(setTaste, () => {});
        })
        .finally(() => setSending(false));
    },
    [userId, eventId, load],
  );

  if (rating === null && (!canReview || failed)) return null;
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-section-title">{canReview ? "Как прошло?" : "Отзывы"}</h2>
        </AppTitle>
        {sent ? <p className="app-review-sent">Спасибо! Твой отзыв отправлен.</p> : canReview && <ReviewForm onSubmit={submit} sending={sending} />}
        {sent && taste !== null && taste.eventCategories.length > 0 && (
          <div>
            <p className="app-section-title">Твой вкус уточнился</p>
            <ul className="app-participation-counters">
              {taste.eventCategories
                .slice()
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
                .map((row) => (
                  <li key={row.category}>
                    {CATEGORY_LABELS[row.category]} {Math.round(row.weight)}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {!failed && rating !== null && <RatingView rating={rating} />}
      </div>
    </section>
  );
}
