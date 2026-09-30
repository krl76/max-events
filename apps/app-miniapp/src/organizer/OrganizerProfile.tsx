// START_MODULE_CONTRACT
// PURPOSE: Organizer profile tab, the same shape as the visitor profile: cover, avatar, name, counters, published events and places.
// SCOPE: Presentational view plus the container that loads the organization's own events, places, subscriptions and followers. Cover and avatar stay on this device.
// DEPENDS: react, ../api/client.js, ../catalog/format.js, ../feed/photo.js, ../ui/icons.js, ../ui/photos.js, ../ui/primitives.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerProfilePane - home | reviews | team | complaints
// - OrganizerProfileList - subscriptions | followers, or none
// - OrganizerProfileView - the screen: public org chrome, rating, reviews, team, complaints
// - OrganizerProfile - loads the organization's own data
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Friend, OrganizerRating, Subscription } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerEventReview, type OrganizerPlace } from "../api/client";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { isCustomProfileAvatar, ProfileMediaDialog } from "../profile/ProfilePage";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { showPhoto } from "../ui/photos";
import { AppState } from "../ui/primitives";
import { REVIEW_FACT_LABELS, reviewVerdict } from "./OrganizerEventManage";
import { useOrganizerNativeBack } from "./organizer-native-back";
import { ORGANIZER_ACTIVITY_OPTIONS } from "./organizer-onboarding";

export type OrganizerProfilePane = "home" | "reviews" | "team" | "complaints";
export type OrganizerProfileList = "subscriptions" | "followers" | null;
export type OrganizerProfileReview = OrganizerEventReview & { eventTitle: string };

const MEDIA_KEY = "max-events:org-media:";

interface OrgMedia {
  avatarUrl: string | null;
  coverUrl: string | null;
}

function readMedia(organizationId: string): OrgMedia {
  if (typeof localStorage === "undefined") return { avatarUrl: null, coverUrl: null };
  try {
    const parsed = JSON.parse(localStorage.getItem(MEDIA_KEY + organizationId) ?? "") as Partial<OrgMedia>;
    return { avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null, coverUrl: typeof parsed.coverUrl === "string" ? parsed.coverUrl : null };
  } catch {
    return { avatarUrl: null, coverUrl: null };
  }
}

function writeMedia(organizationId: string, media: OrgMedia) {
  localStorage.setItem(MEDIA_KEY + organizationId, JSON.stringify(media));
}

const PROFILE_SHORTCUTS: ReadonlyArray<{ id: OrganizerProfilePane | "settings"; label: string; icon: ActionIconName }> = [
  { id: "settings", label: "Настройки", icon: "settings" },
  { id: "reviews", label: "Отзывы", icon: "star" },
  { id: "team", label: "Команда", icon: "users" },
  { id: "complaints", label: "Жалобы", icon: "alert" },
];

function ReviewCard({ row }: { row: OrganizerProfileReview }) {
  return (
    <article className="app-set-group">
      <div className="app-set-row">
        <span className="app-set-row-text">
          <span className="app-set-row-title">{row.name}</span>
          <span className="app-set-row-title">{reviewVerdict(row.stars, row.wouldGoAgain)}</span>
        </span>
      </div>
      <p>{row.eventTitle}</p>
      {row.factTags.length > 0 && <p>{row.factTags.map((tag) => REVIEW_FACT_LABELS[tag] ?? tag).join(", ")}</p>}
      {row.text !== null && row.text !== "" && <p>{row.text}</p>}
    </article>
  );
}

export function OrganizerProfileView({ name, about, avatarUrl, coverUrl, subscriptions, followers, rating, reviews, pane, list, failed, onPane, onList, onSettings, onPickAvatar, onPickCover, onResetAvatar, onResetCover }: { name: string; about: string; avatarUrl: string | null; coverUrl: string | null; events: OrganizerEvent[]; places: OrganizerPlace[]; subscriptions: Subscription[] | null; followers: Friend[] | null; rating: OrganizerRating | null; reviews: OrganizerProfileReview[]; pane: OrganizerProfilePane; list: OrganizerProfileList; failed: boolean; onPane: (pane: OrganizerProfilePane) => void; onList: (list: OrganizerProfileList) => void; onSettings: () => void; onPickAvatar: () => void; onPickCover: () => void; onResetAvatar: () => void; onResetCover: () => void }) {
  const [mediaMenu, setMediaMenu] = useState<"avatar" | "cover" | null>(null);
  useOrganizerNativeBack(pane !== "home" || list !== null, () => {
    if (list !== null) onList(null);
    else onPane("home");
  });
  const initial = name.trim().slice(0, 1).toUpperCase() || "О";
  const customAvatar = isCustomProfileAvatar(avatarUrl);
  const customCover = coverUrl !== null;
  const dismiss = useCallback(() => setMediaMenu(null), []);
  return (
    <section className="app-me app-me--user" aria-label="Профиль организации">
      <header className="app-me-head">
        <div className="app-me-hero">
          {coverUrl !== null ? <img className="app-me-hero-cover" src={showPhoto(coverUrl) ?? coverUrl} alt="" /> : null}
          <span className="app-me-blob app-me-blob--light" aria-hidden="true" />
          <span className="app-me-blob app-me-blob--cool" aria-hidden="true" />
          <div className="app-me-hero-edits">
            <button type="button" className="app-me-hero-edit" aria-label="Сменить шапку" aria-haspopup="dialog" onClick={() => setMediaMenu("cover")}>
              <ActionIcon name="upload" size={16} strokeWidth={2} />
              Шапка
            </button>
          </div>
          <span className="app-me-hero-actions">
            <button type="button" className="app-me-hero-action" aria-label="Настройки" onClick={onSettings}>
              <ActionIcon name="dots" size={18} strokeWidth={2} />
            </button>
          </span>
        </div>
      </header>
      <div className="app-me-sheet">
        <button type="button" className="app-me-avatar-ring" aria-label="Сменить аватар" aria-haspopup="dialog" onClick={() => setMediaMenu("avatar")}>
          <span className="app-me-avatar">{avatarUrl === null ? initial : <img alt="" src={showPhoto(avatarUrl) ?? avatarUrl} />}</span>
        </button>
        {mediaMenu === "avatar" && (
          <ProfileMediaDialog
            title="Фото организации"
            custom={customAvatar}
            onPick={() => {
              onPickAvatar();
              dismiss();
            }}
            onReset={
              customAvatar
                ? () => {
                    onResetAvatar();
                    dismiss();
                  }
                : undefined
            }
            onClose={dismiss}
          />
        )}
        {mediaMenu === "cover" && (
          <ProfileMediaDialog
            title="Шапка профиля"
            custom={customCover}
            onPick={() => {
              onPickCover();
              dismiss();
            }}
            onReset={
              customCover
                ? () => {
                    onResetCover();
                    dismiss();
                  }
                : undefined
            }
            onClose={dismiss}
          />
        )}
        <h1 className="app-me-name">{name}</h1>
        {(subscriptions !== null || followers !== null) && (
          <p className="app-me-follows">
            {subscriptions !== null && (
              <span className="app-me-follows-item">
                <button type="button" className="app-me-follow" onClick={() => onList("subscriptions")}>
                  <span className="app-me-follow-value">{subscriptions.length}</span> {pluralRu(subscriptions.length, "подписка", "подписки", "подписок")}
                </button>
              </span>
            )}
            {subscriptions !== null && followers !== null && (
              <span className="app-me-follow-sep" aria-hidden="true">
                |
              </span>
            )}
            {followers !== null && (
              <span className="app-me-follows-item">
                <button type="button" className="app-me-follow" onClick={() => onList("followers")}>
                  <span className="app-me-follow-value">{followers.length}</span> {pluralRu(followers.length, "подписчик", "подписчика", "подписчиков")}
                </button>
              </span>
            )}
          </p>
        )}
        {about !== "" && <p className="app-me-about">{about}</p>}
        {failed && <AppState error>Не удалось загрузить профиль организации.</AppState>}
        {list !== null && (
          <div className="app-me-rows" aria-label={list === "subscriptions" ? "Подписки" : "Подписчики"}>
            {(list === "subscriptions" ? (subscriptions ?? []) : []).map((item) => (
              <p key={item.id} className="app-me-row">
                {item.title}
              </p>
            ))}
            {(list === "followers" ? (followers ?? []) : []).map((item) => (
              <p key={item.id} className="app-me-row">
                {item.name}
              </p>
            ))}
            {list === "subscriptions" && subscriptions !== null && subscriptions.length === 0 && <AppState>Подписок пока нет.</AppState>}
            {list === "followers" && followers !== null && followers.length === 0 && <AppState>Подписчиков пока нет.</AppState>}
          </div>
        )}
        {list === null && pane === "team" && (
          <>
            <h2 className="app-me-name">Команда</h2>
            <AppState>Сотрудников пока нет.</AppState>
          </>
        )}
        {list === null && pane === "complaints" && (
          <>
            <h2 className="app-me-name">Жалобы</h2>
            <AppState>Открытых жалоб нет.</AppState>
          </>
        )}
        {list === null && pane === "reviews" && (
          <>
            <h2 className="app-me-name">Отзывы гостей</h2>
            {reviews.length === 0 ? <AppState>Гости оставляют отзыв после события, на котором были.</AppState> : reviews.map((row) => <ReviewCard key={row.id} row={row} />)}
          </>
        )}
        {list === null && pane === "home" && (
          <>
            {rating !== null && (
              <div className="app-org-tiles">
                <button type="button" className="app-org-tile" onClick={() => onPane("reviews")}>
                  <span className="app-org-tile-label">Оценка</span>
                  <span className="app-org-tile-big">{rating.averageStars.toFixed(1).replace(".", ",")}</span>
                </button>
                <button type="button" className="app-org-tile" onClick={() => onPane("reviews")}>
                  <span className="app-org-tile-label">Рекомендуют</span>
                  <span className="app-org-tile-big">{Math.round(rating.recommendPercent)}%</span>
                </button>
                <div className="app-org-tile">
                  <span className="app-org-tile-label">Визиты</span>
                  <span className="app-org-tile-big">{rating.visitsCount}</span>
                </div>
                <div className="app-org-tile">
                  <span className="app-org-tile-label">В афише</span>
                  <span className="app-org-tile-big">{rating.eventsCount}</span>
                </div>
              </div>
            )}
            <div className="app-me-dashboard" aria-label="Разделы профиля">
              <section className="app-me-card app-me-shortcuts">
                {PROFILE_SHORTCUTS.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="app-me-shortcut"
                    onClick={() => {
                      if (row.id === "settings") onSettings();
                      else onPane(row.id);
                    }}
                  >
                    <span className="app-me-shortcut-icon" aria-hidden="true">
                      <ActionIcon name={row.icon} size={18} strokeWidth={2.1} />
                    </span>
                    <span className="app-me-shortcut-label">{row.label}</span>
                    <ActionIcon name="chevron" size={16} />
                  </button>
                ))}
              </section>
            </div>
            {reviews.length > 0 && reviews.slice(0, 3).map((row) => <ReviewCard key={row.id} row={row} />)}
            {reviews.length === 0 && rating === null && <AppState>Гости оставляют отзыв после события, на котором были.</AppState>}
          </>
        )}
      </div>
    </section>
  );
}

export function OrganizerProfile({ organizationId, organizationName, onSettings }: { organizationId: string; organizationName: string; onOpenEvent: (event: OrganizerEvent) => void; onSettings: () => void }) {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [places, setPlaces] = useState<OrganizerPlace[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [followers, setFollowers] = useState<Friend[] | null>(null);
  const [about, setAbout] = useState("");
  const [rating, setRating] = useState<OrganizerRating | null>(null);
  const [reviews, setReviews] = useState<OrganizerProfileReview[]>([]);
  const [failed, setFailed] = useState(false);
  const [media, setMedia] = useState<OrgMedia>({ avatarUrl: null, coverUrl: null });
  const [pane, setPane] = useState<OrganizerProfilePane>("home");
  const [list, setList] = useState<OrganizerProfileList>(null);
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMedia(readMedia(organizationId));
  }, [organizationId]);

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerEvents().then(
      (items) => {
        if (!alive) return;
        setEvents(items);
        void Promise.all(
          items
            .filter((item) => !item.draft)
            .slice(0, 8)
            .map((item) =>
              apiClient.listOrganizerEventReviews(item.id).then(
                (rows) => rows.map((row) => ({ ...row, eventTitle: item.title })),
                () => [] as OrganizerProfileReview[],
              ),
            ),
        ).then((groups) => {
          if (alive) setReviews(groups.flat());
        });
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    apiClient.listOrganizerPlaces().then(
      (items) => {
        if (alive) setPlaces(items);
      },
      () => {},
    );
    apiClient.getOrganizerSetup().then(
      (setup) => {
        if (!alive) return;
        const city = setup.venue.city.trim();
        const activities = setup.activities.map((activity) => ORGANIZER_ACTIVITY_OPTIONS.find((option) => option.activity === activity)?.label ?? activity).join(", ");
        setAbout([city, activities].filter((part) => part !== "").join(" · "));
      },
      () => {},
    );
    apiClient.listSubscriptions().then(
      (items) => {
        if (alive) setSubscriptions(items);
      },
      () => {
        if (alive) setSubscriptions([]);
      },
    );
    apiClient.getOrganizerRating(organizationId).then(
      (response) => {
        if (alive) setRating(response.rating);
      },
      () => {
        if (alive) setRating(null);
      },
    );
    apiClient.getMe().then(
      ({ user }) => {
        apiClient.listFollowers(user.id).then(
          (items) => {
            if (alive) setFollowers(items);
          },
          () => {
            if (alive) setFollowers([]);
          },
        );
      },
      () => {
        if (alive) setFollowers([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [organizationId]);

  const savePhoto = (kind: "avatar" | "cover", file: File | undefined) => {
    if (file === undefined) return;
    readFeedPhoto(file).then(
      (dataUrl) => {
        if (dataUrl === null) return;
        const apply = (url: string) => {
          const next = { ...readMedia(organizationId), [kind === "avatar" ? "avatarUrl" : "coverUrl"]: url };
          writeMedia(organizationId, next);
          setMedia(next);
        };
        apiClient.storeImage(dataUrl, "cover").then(apply, () => apply(dataUrl));
      },
      () => {},
    );
  };

  return (
    <>
      <input ref={avatarRef} type="file" accept="image/*" hidden aria-label="Фото организации" onChange={(change) => savePhoto("avatar", change.target.files?.[0])} />
      <input ref={coverRef} type="file" accept="image/*" hidden aria-label="Шапка организации" onChange={(change) => savePhoto("cover", change.target.files?.[0])} />
      <OrganizerProfileView
        name={organizationName}
        about={about}
        avatarUrl={media.avatarUrl}
        coverUrl={media.coverUrl}
        events={events}
        places={places}
        subscriptions={subscriptions}
        followers={followers}
        rating={rating}
        reviews={reviews}
        pane={pane}
        list={list}
        failed={failed}
        onPane={(next) => {
          setList(null);
          setPane(next);
        }}
        onList={setList}
        onSettings={onSettings}
        onPickAvatar={() => avatarRef.current?.click()}
        onPickCover={() => coverRef.current?.click()}
        onResetAvatar={() => {
          const next = { ...readMedia(organizationId), avatarUrl: null };
          writeMedia(organizationId, next);
          setMedia(next);
        }}
        onResetCover={() => {
          const next = { ...readMedia(organizationId), coverUrl: null };
          writeMedia(organizationId, next);
          setMedia(next);
        }}
      />
    </>
  );
}
