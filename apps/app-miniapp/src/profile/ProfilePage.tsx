// START_MODULE_CONTRACT
// PURPOSE: Экран 36 «Профиль»: обложка со шапкой и меню, аватар без бейджа, имя и строка подписок, для своего профиля — строчные переходы в календарь, прогулки, планы, брони, достижения, группы и друзья, затем вкладки «Посты» / «Места» / «Сохранённое». Чужой профиль вместо переходов показывает действия с человеком.
// SCOPE: The profile screen only — data via apiClient.getProfile/getProfileCounters/listUserPosts/listVisitedPlaces/listLists/listSubscriptions/listFollowing/listFollowers/getAchievements/listWeGroups/listFriends; secondary blocks stay silent when their request fails. Editing lives on the settings route (./SettingsPage.tsx), the follow lists on ../subscriptions/.
// DEPENDS: ../api/client.js (apiClient, ListSummary, ProfileCounters, ProfilePost, VisitedPlace), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../feed/photo.js (readFeedPhoto), ../max/bridge.js (shareResult, webApp), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Achievement, Friend, Profile, Subscription, User, WeGroupScreen), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - profileInterestLine - up to three interests, then «и ещё N»
// - profileAbout - the bio under the name; the city and interests line is not shown
// - profileMetrics - the visit counters with their ru labels; a zero and an uncounted «компании» are left out (#496)
// - socialEntryLabel - «Подписки» / «Посты» / «Подписчики» when that counter is still zero
// - followMetrics - the two clickable counters of the header: everything the viewer follows and everyone following them; a direction that has not arrived is left out rather than printed as a zero
// - socialMetrics - second header row: subscriptions, posts, followers
// - ProfileTab - which grid the profile shows: the posts of the person or the places they have been
// - PROFILE_TABS - the two grids in screen order, «Посты» first
// - profileTabLabel - «Посты»; a count next to the name wraps the title onto two lines
// - listsHint - «6 готовых полок и 3 своих»; a zero half and an empty list are omitted
// - achievementsHint - «1 из 4 собрано»; nothing collected yet has no hint
// - weGroupsHint - «3 активные компании»; none open has no hint
// - friendsHint - «25 друзей»; zero friends has no hint
// - visitsLabel - «12 визитов» under an impression cell
// - achievementsProgress - доля собранных достижений для кольца и полосы; null, пока список не приехал
// - communityLetters - до четырёх букв названий живых компаний для стопки в карточке сообщества
// - AchievementSeal - кольцо прогресса с медалью вместо ленты на аватаре
// - QuietImage - фото карточки, которое при ошибке загрузки не оставляет значок битого файла
// - ProfileDashboard - строчные переходы своего профиля: календарь, прогулки, планы, брони, достижения, группы, друзья
// - ProfilePostGrid - сетка постов профиля: плитки со статой, приглашение опубликовать, плейсхолдеры загрузки
// - ProfileEntries - куда ведут счётчики, карточки и сетки экрана 36
// - isCustomProfileAvatar - in-app pick is /api/uploads or a data URL; MAX photo_url is another https host
// - ProfileMediaDialog - popup to add/change a photo or delete it back to the original (avatar or cover)
// - ProfileView - presentational: hero, sheet, avatar without a badge, follow line, own-profile cards, the grid switch and the grid under it
// - ProfilePage - route container: resolves auth, loads the profile and every counter the screen shows, wires the navigation and the share action
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Achievement, Friend, Profile, Subscription, User, WeGroupScreen } from "@max-events/api-contracts";
import { apiClient, type ListSummary, type ProfileCounters, type ProfilePost, type VisitedPlace } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { announceShare, getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { useRoute } from "../routing/router";
import { ListsPage } from "../lists/ListsPage";
import { ActionIcon } from "../ui/icons";
import { pictured, showPhoto } from "../ui/photos";
import { AppMedia, AppSkeleton, AppState } from "../ui/primitives";
import { ConfirmSheet } from "../ui/ConfirmSheet";

const INTERESTS_ON_LINE = 3;

/** Three interests fit the phone line. The rest stays a count, not a paragraph under the name. */
export function profileInterestLine(interests: readonly string[]): string {
  if (interests.length <= INTERESTS_ON_LINE) return interests.join(", ");
  const rest = interests.length - INTERESTS_ON_LINE;
  return `${interests.slice(0, INTERESTS_ON_LINE).join(", ")} и ещё ${rest}`;
}

/** The line under the name is the bio only. City and interests used to sit above it and crowded the header. */
export function profileAbout(profile: Pick<Profile, "bio">): string {
  return profile.bio.trim();
}

/**
 * The three visit counters. «Компании» is nullable on purpose: no service counts companies yet (#496),
 * and a fabricated zero would read as «ты ни с кем не ходил» instead of «мы пока не считаем».
 */
export function profileMetrics(counters: ProfileCounters | null): { value: number; label: string }[] {
  if (counters === null) return [];
  const metrics = [
    { value: counters.eventsCount, label: pluralRu(counters.eventsCount, "событие", "события", "событий") },
    { value: counters.placesCount, label: pluralRu(counters.placesCount, "место", "места", "мест") },
  ];
  if (counters.companiesCount !== null) metrics.push({ value: counters.companiesCount, label: pluralRu(counters.companiesCount, "компания", "компании", "компаний") });
  // A row of zeros is not a biography. The counter appears once the person has actually been somewhere.
  return metrics.filter((metric) => metric.value > 0);
}

/**
 * The two counters a social profile is read by, and the only ones on this screen that lead anywhere.
 *
 * «Подписки» is one number over two stores on purpose: the viewer follows organizers, places and
 * interests (`subscriptions`) and also people (the follow set of экран 02, which is not a Subscription,
 * #501). Two numbers under one word on one screen would be a riddle, so the header prints the total and
 * the list behind it shows all four kinds. A direction whose request has not answered yet is left out
 * entirely — a counter stuck on zero reads as «никто», which is worse than no counter at all.
 */
export function followMetrics(input: { subscriptions: Subscription[] | null; following: Friend[] | null; followers: Friend[] | null }): { id: "subscriptions" | "followers"; value: number; label: string }[] {
  const metrics: { id: "subscriptions" | "followers"; value: number; label: string }[] = [];
  if (input.subscriptions !== null && input.following !== null) {
    const value = input.subscriptions.length + input.following.length;
    metrics.push({ id: "subscriptions", value, label: pluralRu(value, "подписка", "подписки", "подписок") });
  }
  if (input.followers !== null) {
    const value = input.followers.length;
    metrics.push({ id: "followers", value, label: pluralRu(value, "подписчик", "подписчика", "подписчиков") });
  }
  return metrics;
}

/** A zero is an entry, not a score: the button keeps its name so the empty list can still be opened. */
export function socialEntryLabel(id: "posts" | "subscriptions" | "followers"): string {
  if (id === "posts") return "Посты";
  if (id === "subscriptions") return "Подписки";
  return "Подписчики";
}

/** Second header row: subscriptions, posts, followers — visits stay on the row above. */
export function socialMetrics(input: { posts: number | null; subscriptions: Subscription[] | null; following: Friend[] | null; followers: Friend[] | null }): { id: "posts" | "subscriptions" | "followers"; value: number; label: string }[] {
  const follows = followMetrics(input);
  const posts = input.posts === null ? [] : [{ id: "posts" as const, value: input.posts, label: pluralRu(input.posts, "пост", "поста", "постов") }];
  const subscriptions = follows.filter((metric) => metric.id === "subscriptions");
  const followers = follows.filter((metric) => metric.id === "followers");
  return [...subscriptions, ...posts, ...followers];
}

export type ProfileTab = "posts" | "places" | "saved";

/** Screen order: published posts, places, then the shelves the person saved. */
export const PROFILE_TABS: ReadonlyArray<{ id: ProfileTab; label: string }> = [
  { id: "posts", label: "Посты" },
  { id: "places", label: "Места" },
  { id: "saved", label: "Сохранённое" },
];

/** The tab stays a name. A count next to it wraps the title onto two lines. */
export function profileTabLabel(tab: ProfileTab): string {
  return PROFILE_TABS.find((candidate) => candidate.id === tab)!.label;
}

/**
 * «6 готовых полок и 3 своих». A zero half is left out, and an empty shelf list has no hint:
 * the row title «Списки» is enough.
 */
export function listsHint(lists: ListSummary[]): string | null {
  if (lists.length === 0) return null;
  const presets = lists.filter((row) => row.list.preset !== null).length;
  const own = lists.length - presets;
  const presetLine = presets === 0 ? null : `${presets} ${pluralRu(presets, "готовая полка", "готовые полки", "готовых полок")}`;
  const ownLine = own === 0 ? null : `${own} ${pluralRu(own, "своя", "свои", "своих")}`;
  return [presetLine, ownLine].filter((part): part is string => part !== null).join(" и ");
}

/** «1 из 4 собрано». Nothing collected yet is not a score of zero. */
export function achievementsHint(achievements: Achievement[]): string | null {
  const got = achievements.filter((item) => item.grantedAt !== null).length;
  if (got === 0) return null;
  return `${got} из ${achievements.length} собрано`;
}

/** «3 активные компании»: an archived group is a memory, not a company you are still in. None open means no hint. */
export function weGroupsHint(groups: WeGroupScreen[]): string | null {
  const active = groups.filter((row) => row.group.archivedAt === null).length;
  if (active === 0) return null;
  return `${active} ${pluralRu(active, "активная компания", "активные компании", "активных компаний")}`;
}

export function friendsHint(friends: number): string | null {
  if (friends <= 0) return null;
  return `${friends} ${pluralRu(friends, "друг", "друга", "друзей")}`;
}

export function visitsLabel(visits: number): string {
  return `${visits} ${pluralRu(visits, "визит", "визита", "визитов")}`;
}

/** Доля собранных. null — список ещё не приехал, ноль словами не печатаем. */
export function achievementsProgress(achievements: Achievement[] | null): number | null {
  if (achievements === null || achievements.length === 0) return null;
  return achievements.filter((item) => item.grantedAt !== null).length / achievements.length;
}

/** Буквы живых компаний, не больше четырёх: архив в стопку не входит. */
export function communityLetters(groups: WeGroupScreen[] | null): string[] {
  if (groups === null) return [];
  const letters: string[] = [];
  for (const row of groups) {
    if (row.group.archivedAt !== null) continue;
    const letter = row.group.title.trim().charAt(0).toUpperCase();
    if (letter === "") continue;
    letters.push(letter);
    if (letters.length === 4) break;
  }
  return letters;
}

/** Two rows of the three-across grid, so the panel keeps its height while posts load. */
const POST_SKELETON_TILES = 6;

/**
 * The post grid and the three states it can be in. A tile carries no text — none would fit — so it is
 * recognised by its cover and its counters: the author's own impression photo when there is one, and
 * the category gradient of the event otherwise, because the product shows no photographs of people.
 */
export function ProfilePostGrid({ posts, failed, onOpenPost, onNewPost, canPublish = true, onAskDelete }: { posts: ProfilePost[] | null; failed: boolean; onOpenPost: (post: ProfilePost) => void; onNewPost: () => void; canPublish?: boolean; onAskDelete?: (post: ProfilePost) => void }) {
  if (failed) return <AppState error>Не удалось загрузить посты.</AppState>;
  if (posts === null)
    return (
      <div className="app-me-posts" role="status" aria-label="Загружаем посты">
        {Array.from({ length: POST_SKELETON_TILES }, (_, tile) => (
          <AppSkeleton key={tile} variant="block" className="app-me-post-skeleton" />
        ))}
      </div>
    );
  if (posts.length === 0) {
    return (
      <AppState hint={canPublish ? "Впечатление с фотографией или без — оно встанет плиткой сюда." : undefined} action={canPublish ? { label: "Опубликовать впечатление", onClick: onNewPost } : undefined}>
        Постов пока нет
      </AppState>
    );
  }
  return (
    <div className="app-me-posts">
      {posts.map((post) => (
        <div key={post.postId} className="app-me-post">
          <button type="button" className="app-me-post-open" aria-label={post.eventId === null ? `Пост «${post.eventTitle}»` : `Пост о событии «${post.eventTitle}»`} onClick={() => onOpenPost(post)}>
            {post.photoUrl === null ? <AppMedia category={post.category} src={pictured(post.eventId ?? post.postId)} className="app-me-post-media" /> : <QuietImage className="app-me-post-photo" src={showPhoto(post.photoUrl) ?? post.photoUrl} />}
            <span className="app-me-post-stats" aria-hidden="true">
              <span className="app-me-post-stat">
                <ActionIcon name="heart" size={14} strokeWidth={2.4} />
                {post.likesCount}
              </span>
              <span className="app-me-post-stat">
                <ActionIcon name="comment" size={14} strokeWidth={2.4} />
                {post.commentsCount}
              </span>
            </span>
          </button>
          {onAskDelete !== undefined && (
            <button type="button" className="app-me-post-delete" aria-label="Удалить пост" onClick={() => onAskDelete(post)}>
              <ActionIcon name="trash" size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export interface ProfileEntries {
  onSettings: () => void;
  onShare: () => void;
  onLists: () => void;
  onPlans: () => void;
  onCreatePlan: () => void;
  onBookings: () => void;
  onOpenBooking: () => void;
  onCalendar: () => void;
  onWalks: () => void;
  onSubscriptions: () => void;
  onFollowers: () => void;
  onAchievements: () => void;
  onWeGroups: () => void;
  onFriends: () => void;
  onSubscribe: () => void;
  onWrite: () => void;
  onToggleClose?: () => void;
  closeFriend?: boolean;
  onInvite: () => void;
  onOpenPost: (post: ProfilePost) => void;
  onDeletePost?: (post: ProfilePost) => void;
  onNewPost: () => void;
  onOpenPlace: (placeId: string) => void;
  onTab: (tab: ProfileTab) => void;
  onPickAvatar?: () => void;
  onPickCover?: () => void;
  onResetAvatar?: () => void;
  onResetCover?: () => void;
}

/** In-app pick is stored at /api/uploads (or a data URL while it uploads); MAX photo_url is another https host. */
export function isCustomProfileAvatar(avatarUrl: string | null): boolean {
  if (avatarUrl === null) return false;
  return avatarUrl.startsWith("data:") || avatarUrl.includes("/api/uploads/");
}

function stopClick(event: { preventDefault: () => void; stopPropagation: () => void }): void {
  event.preventDefault();
  event.stopPropagation();
}

export function ProfileMediaDialog({ title, custom, onPick, onReset, onClose }: { title: string; custom: boolean; onPick: () => void; onReset?: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="app-me-pop" role="dialog" aria-modal="true" aria-labelledby="app-me-pop-title">
      <button type="button" className="app-me-pop-scrim" tabIndex={-1} aria-label="Закрыть" onClick={onClose} />
      <div className="app-me-pop-card" onClick={stopClick}>
        <h2 id="app-me-pop-title" className="app-me-pop-title">
          {title}
        </h2>
        <button type="button" className="app-me-pop-action" onClick={onPick}>
          {custom ? "Изменить фото" : "Добавить фото"}
        </button>
        {custom && onReset !== undefined && (
          <button type="button" className="app-me-pop-action app-me-pop-action--danger" onClick={onReset}>
            Удалить
          </button>
        )}
        <button type="button" className="app-me-pop-action app-me-pop-action--ghost" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}

const TAB_ICON = { posts: "cards", places: "pin", saved: "bookmark" } as const;

const PROFILE_SHORTCUTS = [
  { id: "calendar", label: "Календарь", icon: "calendar" },
  { id: "walks", label: "Мои прогулки", icon: "walk" },
  { id: "plans", label: "Все планы", icon: "bookmark" },
  { id: "bookings", label: "Все брони", icon: "ticket" },
] as const;

/** Фото, которое не открылось, не рисуем: под ним остаётся заливка карточки, а не значок битого файла. */
function QuietImage({ src, className }: { src: string; className: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return null;
  return <img className={className} alt="" src={src} onError={() => setFailedSrc(src)} />;
}

function ProfileDashboard({ achievements, weGroups, friendsCount, onPlans, onBookings, onCalendar, onWalks, onAchievements, onWeGroups, onFriends }: { achievements: Achievement[] | null; weGroups: WeGroupScreen[] | null; friendsCount: number | null; onPlans: () => void; onBookings: () => void; onCalendar: () => void; onWalks: () => void; onAchievements: () => void; onWeGroups: () => void; onFriends: () => void }) {
  const hint = achievements === null ? null : achievementsHint(achievements);
  const groupsLine = weGroups === null ? null : weGroupsHint(weGroups);
  const friendsLine = friendsCount === null ? null : friendsHint(friendsCount);
  const openShortcut = { calendar: onCalendar, walks: onWalks, plans: onPlans, bookings: onBookings };
  const extra = [
    { id: "achievements", label: "Достижения", icon: "medal" as const, hint, onClick: onAchievements },
    { id: "groups", label: "Группы", icon: "group" as const, hint: groupsLine, onClick: onWeGroups },
    { id: "friends", label: "Друзья", icon: "users" as const, hint: friendsLine, onClick: onFriends },
  ];
  return (
    <div className="app-me-dashboard" aria-label="Разделы профиля">
      <section className="app-me-card app-me-shortcuts">
        {PROFILE_SHORTCUTS.map((row) => (
          <button key={row.id} type="button" className="app-me-shortcut" onClick={openShortcut[row.id]}>
            <span className="app-me-shortcut-icon" aria-hidden="true">
              <ActionIcon name={row.icon} size={18} strokeWidth={2.1} />
            </span>
            <span className="app-me-shortcut-label">{row.label}</span>
            <ActionIcon name="chevron" size={16} />
          </button>
        ))}
        {extra.map((row) => (
          <button key={row.id} type="button" className="app-me-shortcut" onClick={row.onClick}>
            <span className="app-me-shortcut-icon" aria-hidden="true">
              <ActionIcon name={row.icon} size={18} strokeWidth={2.1} />
            </span>
            <span className="app-me-shortcut-label">{row.label}</span>
            {row.hint !== null && <span className="app-me-shortcut-hint">{row.hint}</span>}
            <ActionIcon name="chevron" size={16} />
          </button>
        ))}
      </section>
    </div>
  );
}

interface ProfileViewProps extends ProfileEntries {
  user: User;
  profile: Profile;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  following: Friend[] | null;
  followers: Friend[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  posts: ProfilePost[] | null;
  postsFailed: boolean;
  visitedPlaces: VisitedPlace[];
  tab: ProfileTab;
  /** Own profile: no subscribe/write/invite, avatar and cover are editable. */
  own?: boolean;
  followingThem?: boolean;
  /** They already added the viewer, so a return add makes the two friends. */
  followsYou?: boolean;
  subscribePending?: boolean;
}

export function ProfileView({ user, profile, lists, subscriptions, following, followers, achievements, weGroups, friendsCount, posts, postsFailed, visitedPlaces, tab, own = true, followingThem = false, subscribePending = false, ...entries }: ProfileViewProps) {
  const [mediaMenu, setMediaMenu] = useState<"avatar" | "cover" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProfilePost | null>(null);
  const [clickShield, setClickShield] = useState(false);
  const dismissMenu = useCallback(() => {
    setMediaMenu(null);
    setClickShield(true);
  }, []);
  useEffect(() => {
    if (!clickShield) return;
    const id = window.setTimeout(() => setClickShield(false), 400);
    return () => window.clearTimeout(id);
  }, [clickShield]);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const follows = followMetrics({ subscriptions, following, followers });
  const openList = { subscriptions: entries.onSubscriptions, followers: entries.onFollowers };
  const about = profileAbout(profile);
  const customAvatar = isCustomProfileAvatar(user.avatarUrl);
  const customCover = profile.coverUrl !== null;
  const shownTabs = PROFILE_TABS.filter((candidate) => candidate.id !== "saved" || own || (lists ?? []).some((summary) => summary.list.visibility === "public"));
  return (
    <section className="app-me app-me--user">
      <header className="app-me-head">
        <div className="app-me-hero">
          {profile.coverUrl !== null ? <img className="app-me-hero-cover" src={showPhoto(profile.coverUrl) ?? profile.coverUrl} alt="" /> : null}
          <span className="app-me-blob app-me-blob--light" aria-hidden="true" />
          <span className="app-me-blob app-me-blob--cool" aria-hidden="true" />
          {own && entries.onPickCover !== undefined && (
            <div className="app-me-hero-edits">
              <button type="button" className="app-me-hero-edit" aria-label="Сменить шапку" aria-haspopup="dialog" aria-expanded={mediaMenu === "cover"} onClick={() => setMediaMenu("cover")}>
                <ActionIcon name="upload" size={16} strokeWidth={2} />
                Шапка
              </button>
            </div>
          )}
          <span className="app-me-hero-actions">
            <button type="button" className="app-me-hero-action" aria-label="Поделиться профилем" onClick={entries.onShare}>
              <ActionIcon name="upload" size={18} strokeWidth={2} />
            </button>
            {own && (
              <button type="button" className="app-me-hero-action" aria-label="Настройки профиля" onClick={entries.onSettings}>
                <ActionIcon name="dots" size={18} strokeWidth={2} />
              </button>
            )}
          </span>
        </div>
      </header>
      <div className="app-me-sheet">
        {own && entries.onPickAvatar !== undefined ? (
          <button type="button" className="app-me-avatar-ring" aria-label="Сменить аватар" aria-haspopup="dialog" aria-expanded={mediaMenu === "avatar"} onClick={() => setMediaMenu("avatar")}>
            <span className="app-me-avatar">{user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={showPhoto(user.avatarUrl) ?? user.avatarUrl} />}</span>
          </button>
        ) : (
          <div className="app-me-avatar-ring">
            <span className="app-me-avatar">{user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={showPhoto(user.avatarUrl) ?? user.avatarUrl} />}</span>
          </div>
        )}
        {mediaMenu === "avatar" && entries.onPickAvatar !== undefined && (
          <ProfileMediaDialog
            title="Фото профиля"
            custom={customAvatar}
            onPick={() => {
              entries.onPickAvatar?.();
              dismissMenu();
            }}
            onReset={
              customAvatar && entries.onResetAvatar !== undefined
                ? () => {
                    entries.onResetAvatar?.();
                    dismissMenu();
                  }
                : undefined
            }
            onClose={dismissMenu}
          />
        )}
        {mediaMenu === "cover" && entries.onPickCover !== undefined && (
          <ProfileMediaDialog
            title="Шапка профиля"
            custom={customCover}
            onPick={() => {
              entries.onPickCover?.();
              dismissMenu();
            }}
            onReset={
              customCover && entries.onResetCover !== undefined
                ? () => {
                    entries.onResetCover?.();
                    dismissMenu();
                  }
                : undefined
            }
            onClose={dismissMenu}
          />
        )}
        {clickShield && <div className="app-me-pop-shield" aria-hidden="true" />}
        <h1 className="app-me-name">{name}</h1>
        {follows.length > 0 && (
          <p className="app-me-follows">
            {follows.map((metric, index) => (
              <span key={metric.id} className="app-me-follows-item">
                {index > 0 && (
                  <span className="app-me-follow-sep" aria-hidden="true">
                    |
                  </span>
                )}
                <button type="button" className="app-me-follow" onClick={openList[metric.id]}>
                  <span className="app-me-follow-value">{metric.value}</span> {metric.label}
                </button>
              </span>
            ))}
          </p>
        )}
        {about !== "" && <p className="app-me-about">{about}</p>}
        {!own && (
          <div className="app-me-actions">
            <button type="button" className="app-me-action app-me-action--primary" disabled={subscribePending} onClick={entries.onSubscribe}>
              {followingThem && entries.followsYou ? "Друзья" : followingThem ? "Вы добавили" : "Добавить"}
            </button>
            <button type="button" className="app-me-action" onClick={entries.onWrite}>
              Написать
            </button>
            {entries.onToggleClose !== undefined && (
              <button type="button" className="app-me-action" aria-pressed={entries.closeFriend === true} onClick={entries.onToggleClose}>
                {entries.closeFriend ? "В близких" : "В близкие"}
              </button>
            )}
            <button type="button" className="app-me-action" onClick={entries.onInvite}>
              Позвать
            </button>
          </div>
        )}
        {!own && <p className="app-me-link-hint">Добавьте человека или позовите ссылкой в MAX. Друзья — когда добавление взаимное.</p>}
        {own && <ProfileDashboard achievements={achievements} weGroups={weGroups} friendsCount={friendsCount} onPlans={entries.onPlans} onBookings={entries.onBookings} onCalendar={entries.onCalendar} onWalks={entries.onWalks} onAchievements={entries.onAchievements} onWeGroups={entries.onWeGroups} onFriends={entries.onFriends} />}
        <div
          className="app-me-tabs"
          role="tablist"
          aria-label="Что показывать"
          style={{
            ["--me-tabs" as string]: shownTabs.length,
            ["--me-tab" as string]: Math.max(
              0,
              shownTabs.findIndex((candidate) => candidate.id === tab),
            ),
          }}
          onPointerDown={(event) => {
            const host = event.currentTarget;
            const pick = (clientX: number) => {
              const box = host.getBoundingClientRect();
              const next = Math.min(shownTabs.length - 1, Math.max(0, Math.floor(((clientX - box.left) / Math.max(box.width, 1)) * shownTabs.length)));
              const chosen = shownTabs[next];
              if (chosen !== undefined) entries.onTab(chosen.id);
            };
            host.setPointerCapture(event.pointerId);
            pick(event.clientX);
            const move = (pointer: PointerEvent) => {
              if (pointer.pointerId !== event.pointerId) return;
              pick(pointer.clientX);
            };
            const up = (pointer: PointerEvent) => {
              if (pointer.pointerId !== event.pointerId) return;
              host.removeEventListener("pointermove", move);
              host.removeEventListener("pointerup", up);
            };
            host.addEventListener("pointermove", move);
            host.addEventListener("pointerup", up);
          }}
        >
          <span className="app-me-tab-pill" aria-hidden="true" />
          {shownTabs.map((candidate) => (
            <button key={candidate.id} type="button" role="tab" id={`app-me-tab-${candidate.id}`} aria-selected={tab === candidate.id} aria-controls="app-me-tabpanel" className={tab === candidate.id ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => entries.onTab(candidate.id)}>
              <ActionIcon name={TAB_ICON[candidate.id]} size={15} />
              {profileTabLabel(candidate.id)}
            </button>
          ))}
        </div>
        <div id="app-me-tabpanel" className="app-me-panel" role="tabpanel" aria-labelledby={`app-me-tab-${tab}`}>
          {tab === "posts" && <ProfilePostGrid posts={posts} failed={postsFailed} onOpenPost={entries.onOpenPost} onNewPost={entries.onNewPost} canPublish={own} onAskDelete={own && entries.onDeletePost !== undefined ? setPendingDelete : undefined} />}
          <div hidden={tab !== "saved"}>
            <ListsPage userId={user.id} />
          </div>
          {tab === "places" && visitedPlaces.length === 0 && <AppState>Мест пока нет — отметьтесь где-нибудь, и они появятся здесь.</AppState>}
          {tab === "places" && visitedPlaces.length > 0 && (
            <div className="app-me-grid">
              {visitedPlaces.map((place, index) => (
                <button key={place.placeId} type="button" className={`app-me-cell app-me-cell--${(index % 4) + 1} app-me-cell--photo`} onClick={() => entries.onOpenPlace(place.placeId)}>
                  <QuietImage className="app-me-cell-photo" src={pictured(place.placeId, place.photoUrl)} />
                  <span className="app-me-cell-veil">
                    <span className="app-me-cell-title">{place.title}</span>
                    <span className="app-me-cell-visits">{visitsLabel(place.visits)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {pendingDelete !== null && entries.onDeletePost !== undefined && (
        <ConfirmSheet
          title="Удалить пост?"
          confirmLabel="Удалить"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            entries.onDeletePost?.(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  counters: ProfileCounters | null;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  following: Friend[] | null;
  followers: Friend[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  posts: ProfilePost[] | null;
  postsFailed: boolean;
  visitedPlaces: VisitedPlace[];
}

const EMPTY_PROFILE_DATA: ProfileData = { profile: null, failed: false, counters: null, lists: null, subscriptions: null, following: null, followers: null, achievements: null, weGroups: null, friendsCount: null, posts: null, postsFailed: false, visitedPlaces: [] };

function useProfileData(userId: string, own: boolean): ProfileData {
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE_DATA);

  useEffect(() => {
    let alive = true;
    setData(EMPTY_PROFILE_DATA);
    const put = (patch: Partial<ProfileData>) => {
      if (alive) setData((current) => ({ ...current, ...patch }));
    };
    // Own profile is GET /profile; anyone else's is GET /users/:id/profile. A failed hint stays silent.
    (own ? apiClient.getProfile() : apiClient.getUserProfile(userId)).then(
      (profile) => put({ profile }),
      () => put({ failed: true }),
    );
    apiClient.getProfileCounters(userId).then(
      (counters) => put({ counters }),
      () => {},
    );
    apiClient.listVisitedPlaces(userId).then(
      (visitedPlaces) => put({ visitedPlaces }),
      () => {},
    );
    // The posts are a block of the screen rather than a hint, so their failure is said out loud:
    // silence here would leave the grid in its loading state for good.
    apiClient.listUserPosts(userId).then(
      (posts) => put({ posts }),
      () => put({ postsFailed: true }),
    );
    apiClient.listLists(userId).then(
      (lists) => put({ lists }),
      () => {},
    );
    // Organizer/place/interest follows belong to the viewer. On someone else's profile the header
    // counts only people they follow, so this store is not mixed in.
    if (own) {
      apiClient.listSubscriptions().then(
        (subscriptions) => put({ subscriptions }),
        () => {},
      );
    } else {
      put({ subscriptions: [] });
    }
    apiClient.listFollowing(userId).then(
      (following) => put({ following }),
      () => {},
    );
    apiClient.listFollowers(userId).then(
      (followers) => put({ followers }),
      () => {},
    );
    apiClient.getAchievements(userId).then(
      (achievements) => put({ achievements }),
      () => {},
    );
    apiClient.listWeGroups().then(
      (weGroups) => put({ weGroups }),
      () => {},
    );
    apiClient.listFriends().then(
      (friends) => put({ friendsCount: friends.length }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId, own]);

  return data;
}

function AuthenticatedProfile({ viewer, subjectId }: { viewer: User; subjectId: string | null }) {
  const { navigate } = useRoute();
  const { updateUser } = useAuth();
  const own = subjectId === null || subjectId === viewer.id;
  const data = useProfileData(own ? viewer.id : subjectId, own);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [subject, setSubject] = useState<User | null>(own ? viewer : null);
  const [followingThem, setFollowingThem] = useState(false);
  const [subscribePending, setSubscribePending] = useState(false);
  const [closeFriend, setCloseFriend] = useState(false);
  const [followedByThem, setFollowedByThem] = useState(false);
  const [myFollows, setMyFollows] = useState<string[]>([]);
  const [localCover, setLocalCover] = useState<string | null | undefined>(undefined);
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]);
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setHiddenPosts([]);
  }, [subjectId]);

  useEffect(() => {
    if (own) {
      setSubject(viewer);
      return;
    }
    let alive = true;
    apiClient.getUser(subjectId).then(
      (user) => {
        if (alive) setSubject(user);
      },
      () => {
        if (alive) setSubject(null);
      },
    );
    apiClient.getCloseFriend(subjectId).then(
      (close) => {
        if (alive) setCloseFriend(close);
      },
      () => {},
    );
    apiClient.listFollowing(viewer.id).then(
      (list) => {
        if (!alive) return;
        setMyFollows(list.map((person) => person.id));
        setFollowingThem(list.some((person) => person.id === subjectId));
      },
      () => {},
    );
    apiClient.listFollowers(viewer.id).then(
      (list) => {
        if (alive) setFollowedByThem(list.some((person) => person.id === subjectId));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [own, subjectId, viewer]);

  const pickMedia = useCallback(
    (kind: "avatar" | "cover", file: File) => {
      const revertAvatar = viewer;
      const revertCover = localCover;
      void readFeedPhoto(file).then(async (dataUrl) => {
        if (dataUrl === null) return;
        if (kind === "avatar") updateUser({ ...viewer, avatarUrl: dataUrl });
        else setLocalCover(dataUrl);
        try {
          const url = await apiClient.storeImage(dataUrl, "cover");
          if (kind === "avatar") {
            await apiClient.updateProfile({ avatarUrl: url });
            updateUser({ ...viewer, avatarUrl: url });
          } else {
            await apiClient.updateProfile({ coverUrl: url });
            setLocalCover(url);
          }
        } catch {
          if (kind === "avatar") updateUser(revertAvatar);
          else setLocalCover(revertCover);
        }
      });
    },
    [localCover, updateUser, viewer],
  );

  const toggleFollow = useCallback(() => {
    if (own || subjectId === null) return;
    setSubscribePending(true);
    const next = followingThem ? myFollows.filter((id) => id !== subjectId) : [...myFollows, subjectId];
    apiClient.followFriends(next).then(
      (stored) => {
        setMyFollows(stored);
        setFollowingThem(stored.includes(subjectId));
        setSubscribePending(false);
      },
      () => setSubscribePending(false),
    );
  }, [followingThem, myFollows, own, subjectId]);

  if (data.failed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (data.profile === null || subject === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      </div>
    );
  const shownUser = own ? viewer : subject;
  const loadedProfile = data.profile;
  return (
    <>
      <input
        ref={avatarRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Файл аватара"
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) pickMedia("avatar", file);
          change.target.value = "";
        }}
      />
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Файл шапки"
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) pickMedia("cover", file);
          change.target.value = "";
        }}
      />
      <ProfileView
        user={shownUser}
        profile={localCover === undefined ? loadedProfile : { ...loadedProfile, coverUrl: localCover }}
        lists={data.lists}
        subscriptions={data.subscriptions}
        following={data.following}
        followers={data.followers}
        achievements={data.achievements}
        weGroups={data.weGroups}
        friendsCount={data.friendsCount}
        posts={data.posts === null ? null : data.posts.filter((post) => !hiddenPosts.includes(post.postId))}
        postsFailed={data.postsFailed}
        visitedPlaces={data.visitedPlaces}
        tab={tab}
        own={own}
        followingThem={followingThem}
        followsYou={followedByThem}
        subscribePending={subscribePending}
        onTab={setTab}
        onSettings={() => navigate({ name: "settings" })}
        onShare={() => {
          const payload = sharePayload(`${[shownUser.firstName, shownUser.lastName].filter(Boolean).join(" ")} в Афише MAX`, `user-${shownUser.id}`);
          void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
        }}
        onLists={() => navigate({ name: "lists" })}
        onPlans={() => navigate({ name: "plans" })}
        onCreatePlan={() => navigate({ name: "plan-new" })}
        onBookings={() => navigate({ name: "bookings" })}
        onOpenBooking={() => navigate({ name: "bookings" })}
        onCalendar={() => navigate({ name: "calendar" })}
        onWalks={() => navigate({ name: "walks" })}
        onSubscriptions={() => navigate({ name: "subscriptions" })}
        onFollowers={() => navigate({ name: "followers" })}
        onAchievements={() => navigate({ name: "achievements" })}
        onWeGroups={() => navigate({ name: "we-groups" })}
        onFriends={() => navigate({ name: "friends" })}
        onSubscribe={toggleFollow}
        onWrite={() => {
          const name = [shownUser.firstName, shownUser.lastName].filter(Boolean).join(" ");
          const payload = sharePayload(`Привет, ${name}! Пишу из Афиши MAX.`, `user-${shownUser.id}`);
          void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
        }}
        closeFriend={closeFriend}
        onToggleClose={
          subjectId === null || (!closeFriend && !followedByThem)
            ? undefined
            : () => {
                const next = !closeFriend;
                setCloseFriend(next);
                apiClient.setCloseFriend(subjectId, next).then(setCloseFriend, () => setCloseFriend(!next));
              }
        }
        onInvite={() => navigate({ name: "plan-new" })}
        onOpenPost={(post) => navigate({ name: "post", id: post.postId })}
        onDeletePost={
          own
            ? (post) => {
                setHiddenPosts((ids) => [...ids, post.postId]);
                void apiClient.deleteFeedPost(post.postId).then(
                  () => {},
                  () => setHiddenPosts((ids) => ids.filter((id) => id !== post.postId)),
                );
              }
            : undefined
        }
        onNewPost={() => navigate({ name: "feed-new", eventId: null })}
        onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })}
        onPickAvatar={own ? () => avatarRef.current?.click() : undefined}
        onPickCover={own ? () => coverRef.current?.click() : undefined}
        onResetAvatar={
          own
            ? () => {
                const previous = viewer;
                updateUser({ ...viewer, avatarUrl: null });
                apiClient.updateProfile({ avatarUrl: null }).then(
                  () => {},
                  () => updateUser(previous),
                );
              }
            : undefined
        }
        onResetCover={
          own
            ? () => {
                const previous = localCover === undefined ? loadedProfile.coverUrl : localCover;
                setLocalCover(null);
                apiClient.updateProfile({ coverUrl: null }).then(
                  () => {},
                  () => setLocalCover(previous),
                );
              }
            : undefined
        }
      />
    </>
  );
}

export function ProfilePage({ userId = null }: { userId?: string | null }) {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedProfile viewer={auth.user} subjectId={userId} />;
  if (auth.status === "error") {
    return <AppState error>Не удалось войти: {auth.message}</AppState>;
  }
  if (auth.status === "loading") {
    return <AppState>Загрузка…</AppState>;
  }
  return <AppState>Откройте приложение внутри MAX, чтобы авторизоваться.</AppState>;
}
