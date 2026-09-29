// START_MODULE_CONTRACT
// PURPOSE: Organizer profile tab, the same shape as the visitor profile: cover, avatar, name, counters, published events and places.
// SCOPE: Presentational view plus the container that loads the organization's own events, places, subscriptions and followers. Cover and avatar stay on this device.
// DEPENDS: react, ../api/client.js, ../catalog/format.js, ../feed/photo.js, ../ui/icons.js, ../ui/photos.js, ../ui/primitives.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerProfileTab - events | places
// - OrganizerProfileList - subscriptions | followers, or none
// - OrganizerProfileView - the screen
// - OrganizerProfile - loads the organization's own data
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import type { Friend, Subscription } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerPlace } from "../api/client";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppMedia, AppState } from "../ui/primitives";
import { ORGANIZER_ACTIVITY_OPTIONS } from "./organizer-onboarding";

export type OrganizerProfileTab = "events" | "places";
export type OrganizerProfileList = "subscriptions" | "followers" | null;

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

export function OrganizerProfileView({ name, about, avatarUrl, coverUrl, events, places, subscriptions, followers, tab, list, failed, onTab, onList, onOpenEvent, onSettings, onPickAvatar, onPickCover }: { name: string; about: string; avatarUrl: string | null; coverUrl: string | null; events: OrganizerEvent[]; places: OrganizerPlace[]; subscriptions: Subscription[] | null; followers: Friend[] | null; tab: OrganizerProfileTab; list: OrganizerProfileList; failed: boolean; onTab: (tab: OrganizerProfileTab) => void; onList: (list: OrganizerProfileList) => void; onOpenEvent: (event: OrganizerEvent) => void; onSettings: () => void; onPickAvatar: () => void; onPickCover: () => void }) {
  const published = events.filter((item) => !item.draft);
  const initial = name.trim().slice(0, 1).toUpperCase() || "О";
  return (
    <section className="app-me" aria-label="Профиль организации">
      <div className="app-me-hero">
        {coverUrl !== null ? <img className="app-me-hero-cover" src={coverUrl} alt="" /> : null}
        <span className="app-me-blob app-me-blob--light" aria-hidden="true" />
        <span className="app-me-blob app-me-blob--cool" aria-hidden="true" />
        <div className="app-me-hero-edits">
          <button type="button" className="app-me-hero-edit" aria-label="Сменить шапку" onClick={onPickCover}>
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
      <button type="button" className="app-me-avatar-ring" aria-label="Сменить аватар" onClick={onPickAvatar}>
        <span className="app-me-avatar">{avatarUrl === null ? initial : <img alt="" src={avatarUrl} />}</span>
      </button>
      <h1 className="app-me-name">{name}</h1>
      {about !== "" && <p className="app-me-about">{about}</p>}
      {failed && <AppState error>Не удалось загрузить профиль организации.</AppState>}
      <div className="app-me-metrics">
        <div className="app-me-metrics-row">
          <button type="button" className="app-me-metric app-me-metric--link" onClick={() => onTab("events")}>
            <span className="app-me-metric-value">{published.length}</span>
            <span className="app-me-metric-label">{pluralRu(published.length, "событие", "события", "событий")}</span>
          </button>
          <button type="button" className="app-me-metric app-me-metric--link" onClick={() => onTab("places")}>
            <span className="app-me-metric-value">{places.length}</span>
            <span className="app-me-metric-label">{pluralRu(places.length, "место", "места", "мест")}</span>
          </button>
          <button type="button" className="app-me-metric app-me-metric--link" onClick={() => onList("subscriptions")}>
            <span className="app-me-metric-value">{subscriptions === null ? "—" : subscriptions.length}</span>
            <span className="app-me-metric-label">{pluralRu(subscriptions?.length ?? 0, "подписка", "подписки", "подписок")}</span>
          </button>
          <button type="button" className="app-me-metric app-me-metric--link" onClick={() => onList("followers")}>
            <span className="app-me-metric-value">{followers === null ? "—" : followers.length}</span>
            <span className="app-me-metric-label">{pluralRu(followers?.length ?? 0, "подписчик", "подписчика", "подписчиков")}</span>
          </button>
        </div>
      </div>
      {list !== null && (
        <div className="app-me-rows" aria-label={list === "subscriptions" ? "Подписки" : "Подписчики"}>
          <button type="button" className="app-me-hero-action" onClick={() => onList(null)}>
            Назад к профилю
          </button>
          {(list === "subscriptions" ? (subscriptions ?? []) : []).map((item) => (
            <p key={item.id} className="app-me-about">
              {item.title}
            </p>
          ))}
          {(list === "followers" ? (followers ?? []) : []).map((item) => (
            <p key={item.id} className="app-me-about">
              {item.name}
            </p>
          ))}
          {list === "subscriptions" && subscriptions !== null && subscriptions.length === 0 && <AppState>Подписок пока нет.</AppState>}
          {list === "followers" && followers !== null && followers.length === 0 && <AppState>Подписчиков пока нет.</AppState>}
        </div>
      )}
      {list === null && (
        <>
          <div className="app-me-tabs" role="tablist" aria-label="Что показывать">
            <button type="button" role="tab" aria-selected={tab === "events"} className={tab === "events" ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => onTab("events")}>
              События
            </button>
            <button type="button" role="tab" aria-selected={tab === "places"} className={tab === "places" ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => onTab("places")}>
              Места
            </button>
          </div>
          {tab === "events" && published.length === 0 && <AppState>Опубликованных событий пока нет.</AppState>}
          {tab === "events" && published.length > 0 && (
            <div className="app-me-posts">
              {published.map((item) => (
                <button key={item.id} type="button" className="app-me-post" aria-label={item.title} onClick={() => onOpenEvent(item)}>
                  <AppMedia category={item.category} src={pictured(item.id, item.coverUrl)} className="app-me-post-media" />
                </button>
              ))}
            </div>
          )}
          {tab === "places" && places.length === 0 && <AppState>Мест пока нет.</AppState>}
          {tab === "places" && places.length > 0 && (
            <div className="app-me-grid">
              {places.map((place, index) => (
                <div key={place.id} className={`app-me-cell app-me-cell--${(index % 4) + 1}`}>
                  <span className="app-me-cell-blob" aria-hidden="true" />
                  <span className="app-me-cell-veil">
                    <span className="app-me-cell-title">{place.title}</span>
                    <span className="app-me-cell-visits">{place.city}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function OrganizerProfile({ organizationId, organizationName, onOpenEvent, onSettings }: { organizationId: string; organizationName: string; onOpenEvent: (event: OrganizerEvent) => void; onSettings: () => void }) {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [places, setPlaces] = useState<OrganizerPlace[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [followers, setFollowers] = useState<Friend[] | null>(null);
  const [about, setAbout] = useState("");
  const [failed, setFailed] = useState(false);
  const [media, setMedia] = useState<OrgMedia>({ avatarUrl: null, coverUrl: null });
  const [tab, setTab] = useState<OrganizerProfileTab>("events");
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
        if (alive) setEvents(items);
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
        tab={tab}
        list={list}
        failed={failed}
        onTab={(next) => {
          setList(null);
          setTab(next);
        }}
        onList={setList}
        onOpenEvent={onOpenEvent}
        onSettings={onSettings}
        onPickAvatar={() => avatarRef.current?.click()}
        onPickCover={() => coverRef.current?.click()}
      />
    </>
  );
}
