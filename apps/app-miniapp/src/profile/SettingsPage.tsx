// START_MODULE_CONTRACT
// PURPOSE: Экран 41 «Настройки»: the MAX identity row and the grouped sections — Приложение, Приватность, Близкие, Уведомления, Мини-приложение — plus «Отключить мини-приложение». Organizer settings only when organizer mode is already on. Close friends are assembled from people who follow the viewer.
// SCOPE: The settings screen only. What the Profile contract carries (city, interests, privacy, smart alerts) is written with apiClient.updateProfile; the rest is apiClient.getAppSettings/updateAppSettings; the colour scheme is the useAppTheme preference, not a server field. Pickers are inline disclosures — no separate screen per row.
// DEPENDS: ../api/client.js (apiClient, AppSettings), ../auth/AuthContext.js, ../max/bridge.js (getWebApp), ../onboarding/onboarding.js (ONBOARDING_CITIES, ONBOARDING_INTERESTS), ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.js (useAppTheme, ThemePreference), @max-events/api-contracts (Profile, UpdateProfile, User), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - APP_VERSION - the version «О приложении» prints; the build injects none, so the design's string is the source
// - SEARCH_RADIUS_OPTIONS - the radii «Что считать рядом» offers, in km
// - THEME_OPTIONS - the three colour-scheme choices in design order with their ru labels
// - themeLabel - ru label of a theme preference
// - radiusLabel - «5 км»
// - planVisibilityLabel - «Друзья» / «Никто» for the routes privacy field
// - quietHoursLabel - «Вкл» / «Выкл»
// - quietHoursHint - «23:00–09:00, только срочное»
// - interestsHint - «6 категорий влияют на подборку»
// - identityHint - «Профиль MAX · @username», and «Профиль MAX» alone without one
// - APP_PREFERENCE_KEYS - localStorage keys that are settings, not cache, and survive «Очистить кеш»
// - appCacheBytes - size of the app's cached localStorage entries, preferences excluded
// - clearAppCache - drop those cached entries, keeping the preferences
// - formatBytes - «24 МБ» / «860 КБ» / «0 КБ»
// - SettingsToggle - the 44×26 switch of the design as a real role="switch" button
// - SettingsValueRow - row with a value and a chevron that opens its inline picker
// - SettingsSwitchRow - row with a switch
// - SettingsPicker - the inline option list a value row discloses
// - SettingsGroup - one bordered section with its uppercase caption
// - CloseFriendsList - the disclosed list: current close friends, then followers who can still be added
// - SettingsViewProps - what the settings screen renders and writes, including optional cover/avatar restore
// - SettingsView - presentational: identity row, the groups, the disable button
// - SettingsPage - route container: resolves auth, loads profile + app settings, writes both and binds the theme preference
// END_MODULE_MAP

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PROFILE_BIO_MAX, type Friend, type Profile, type UpdateProfile, type User } from "@max-events/api-contracts";
import { apiClient, type AppSettings } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isCustomProfileAvatar } from "./ProfilePage";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { getWebApp } from "../max/bridge";
import { ONBOARDING_CITIES, ONBOARDING_INTERESTS } from "../onboarding/onboarding";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeleton, AppState } from "../ui/primitives";
import { useAppTheme, type ThemePreference } from "../ui/theme";

/** The build injects no version, so the string the design prints is the one the screen shows until it does. */
export const APP_VERSION = "1.4.0";

export const SEARCH_RADIUS_OPTIONS: readonly number[] = [1, 3, 5, 10, 25];

export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

export function themeLabel(preference: ThemePreference): string {
  return THEME_OPTIONS.find((option) => option.value === preference)?.label ?? "Системная";
}

export function radiusLabel(km: number): string {
  return `${km} км`;
}

export function planVisibilityLabel(visibility: Profile["privacy"]["routes"]): string {
  return visibility === "friends" ? "Друзья" : "Никто";
}

export function quietHoursLabel(enabled: boolean): string {
  return enabled ? "Вкл" : "Выкл";
}

export function quietHoursHint(from: string, to: string): string {
  return `${from}–${to}, только срочное`;
}

export function interestsHint(interests: string[]): string {
  return `${interests.length} ${pluralRu(interests.length, "категория влияет", "категории влияют", "категорий влияют")} на подборку`;
}

/** The MAX identity is the messenger's: the phone the design masks is not in the User contract, the handle is. */
export function identityHint(user: Pick<User, "username">): string {
  return user.username === null ? "Профиль MAX" : `Профиль MAX · @${user.username}`;
}

/** Settings, not cache: the scheme, the "onboarding already ran" flag, the map basemap, the organizer session and the dev initData survive «Очистить кеш». */
export const APP_PREFERENCE_KEYS: readonly string[] = ["max-events:theme", "max-events:onboarding", "max-events:basemap", "max-events.organizer-session", "max-events.dev-init-data"];

function appCacheKeys(storage: Pick<Storage, "length" | "key">): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && key.startsWith("max-events") && !APP_PREFERENCE_KEYS.includes(key)) keys.push(key);
  }
  return keys;
}

/** UTF-16 code units, two bytes each — the same arithmetic a browser quota uses. */
export function appCacheBytes(storage: Pick<Storage, "length" | "key" | "getItem">): number {
  return appCacheKeys(storage).reduce((sum, key) => sum + (key.length + (storage.getItem(key)?.length ?? 0)) * 2, 0);
}

export function clearAppCache(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  for (const key of appCacheKeys(storage)) storage.removeItem(key);
}

export function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} КБ`;
  return `${(kb / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

export function SettingsToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? "app-set-switch app-set-switch--on" : "app-set-switch"} onClick={() => onChange(!checked)}>
      <span className="app-set-switch-knob" aria-hidden="true" />
    </button>
  );
}

export function SettingsValueRow({ title, hint, value, expanded, onOpen }: { title: string; hint: string; value?: string; expanded: boolean; onOpen: () => void }) {
  return (
    <button type="button" className="app-set-row" aria-expanded={expanded} onClick={onOpen}>
      <span className="app-set-row-text">
        <span className="app-set-row-title">{title}</span>
        <span className="app-set-row-hint">{hint}</span>
      </span>
      <span className="app-set-row-value">
        {value !== undefined && <span>{value}</span>}
        <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
      </span>
    </button>
  );
}

export function SettingsSwitchRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="app-set-row">
      <span className="app-set-row-text">
        <span className="app-set-row-title">{title}</span>
        <span className="app-set-row-hint">{hint}</span>
      </span>
      <SettingsToggle checked={checked} label={title} onChange={onChange} />
    </div>
  );
}

export function SettingsPicker({ options, selected, multiple = false, onPick }: { options: readonly { value: string; label: string }[]; selected: readonly string[]; multiple?: boolean; onPick: (value: string) => void }) {
  return (
    <div className={multiple ? "app-set-picker app-set-picker--chips" : "app-set-picker"} role={multiple ? "group" : "radiogroup"}>
      {options.map((option) => {
        const on = selected.includes(option.value);
        return multiple ? (
          <button key={option.value} type="button" className={on ? "app-set-chip app-set-chip--on" : "app-set-chip"} aria-pressed={on} onClick={() => onPick(option.value)}>
            {option.label}
          </button>
        ) : (
          <button key={option.value} type="button" className="app-set-option" role="radio" aria-checked={on} onClick={() => onPick(option.value)}>
            <span>{option.label}</span>
            {on && <ActionIcon name="check" size={18} strokeWidth={2.6} />}
          </button>
        );
      })}
    </div>
  );
}

export function CloseFriendsList({ closeFriends, followers, onToggle }: { closeFriends: readonly Friend[]; followers: readonly Friend[]; onToggle: (userId: string, close: boolean) => void }) {
  const closeIds = new Set(closeFriends.map((person) => person.id));
  const candidates = followers.filter((person) => !closeIds.has(person.id));
  return (
    <div className="app-set-picker">
      {closeFriends.length === 0 && candidates.length > 0 && <p className="app-set-note">Пока никого. Добавьте из подписчиков ниже.</p>}
      {closeFriends.map((person) => (
        <button key={person.id} type="button" className="app-set-option" onClick={() => onToggle(person.id, false)}>
          <span>{person.name}</span>
          <span className="app-set-identity-action">Убрать</span>
        </button>
      ))}
      {followers.length === 0 && <p className="app-set-note">На вас пока никто не подписан.</p>}
      {followers.length > 0 && candidates.length === 0 && <p className="app-set-note">Все подписчики уже в близких.</p>}
      {candidates.map((person) => (
        <button key={person.id} type="button" className="app-set-option" onClick={() => onToggle(person.id, true)}>
          <span>{person.name}</span>
          <span className="app-set-identity-action">Добавить</span>
        </button>
      ))}
    </div>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="app-set-group-title">{title}</h2>
      <div className="app-set-group">{children}</div>
    </>
  );
}

type PickerName = "identity" | "city" | "theme" | "interests" | "radius" | "plans" | "quiet" | "about" | "disable" | "bio" | "close" | null;

export interface SettingsViewProps {
  user: User;
  profile: Profile;
  settings: AppSettings | null;
  theme: { preference: ThemePreference; setPreference: (next: ThemePreference) => void };
  cacheBytes: number;
  failed: boolean;
  onProfile: (patch: UpdateProfile) => void;
  onSettings: (patch: Partial<Omit<AppSettings, "userId">>) => void;
  onClearCache: () => void;
  onOrganizer: () => void;
  onDisable: () => void;
  onPickCover?: () => void;
  onResetCover?: () => void;
  onResetAvatar?: () => void;
  closeFriends?: readonly Friend[];
  followers?: readonly Friend[];
  onToggleClose?: (userId: string, close: boolean) => void;
}

export function SettingsView({ user, profile, settings, theme, cacheBytes, failed, onProfile, onSettings, onClearCache, onOrganizer, onDisable, onPickCover, onResetCover, onResetAvatar, closeFriends, followers, onToggleClose }: SettingsViewProps) {
  const [picker, setPicker] = useState<PickerName>(null);
  const open = (name: Exclude<PickerName, null>) => setPicker((current) => (current === name ? null : name));

  return (
    <section className="app-set">
      <button type="button" className="app-set-identity" aria-expanded={picker === "identity"} onClick={() => open("identity")}>
        <span className="app-set-identity-avatar" aria-hidden="true">
          {user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={user.avatarUrl} />}
        </span>
        <span className="app-set-identity-text">
          <span className="app-set-identity-name">{[user.firstName, user.lastName].filter(Boolean).join(" ")}</span>
          <span className="app-set-identity-sub">{identityHint(user)}</span>
        </span>
        <span className="app-set-identity-action">Изменить</span>
      </button>
      {picker === "identity" && (
        <>
          <p className="app-set-note">Имя и телефон — из профиля MAX. Аватар меняется нажатием на фото в профиле.</p>
          {onResetAvatar !== undefined && <button type="button" className="app-set-reset" onClick={onResetAvatar}>Вернуть фото MAX</button>}
        </>
      )}
      {failed && <p className="app-set-error">Не удалось сохранить настройку. Попробуй ещё раз.</p>}

      <SettingsGroup title="Приложение">
        <SettingsValueRow title="Город" hint="Определяется по геолокации" value={profile.city} expanded={picker === "city"} onOpen={() => open("city")} />
        {picker === "city" && <SettingsPicker options={ONBOARDING_CITIES.map((city) => ({ value: city.name, label: city.name }))} selected={[profile.city]} onPick={(city) => onProfile({ city })} />}
        <SettingsValueRow title="Тема" hint="Светлая, тёмная или как в системе" value={themeLabel(theme.preference)} expanded={picker === "theme"} onOpen={() => open("theme")} />
        {picker === "theme" && <SettingsPicker options={THEME_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} selected={[theme.preference]} onPick={(value) => theme.setPreference(value as ThemePreference)} />}
        <SettingsValueRow title="О себе" hint={profile.bio.trim() === "" ? "Коротко, по желанию" : profile.bio} value="Изменить" expanded={picker === "bio"} onOpen={() => open("bio")} />
        {picker === "bio" && <textarea className="app-review-text" maxLength={PROFILE_BIO_MAX} value={profile.bio} onChange={(change) => onProfile({ bio: change.target.value })} placeholder="Пара слов о себе" />}
        {onPickCover !== undefined && <SettingsValueRow title="Шапка профиля" hint={profile.coverUrl === null ? "Градиент Афиши" : "Своя фотография"} value={profile.coverUrl === null ? "Добавить" : "Изменить"} expanded={false} onOpen={onPickCover} />}
        {profile.coverUrl !== null && onResetCover !== undefined && <SettingsValueRow title="Исходная шапка" hint="Вернуть градиент Афиши" value="Сбросить" expanded={false} onOpen={onResetCover} />}
        <SettingsValueRow title="Интересы" hint={interestsHint(profile.interests)} value="Изменить" expanded={picker === "interests"} onOpen={() => open("interests")} />
        {picker === "interests" && <SettingsPicker multiple options={ONBOARDING_INTERESTS.map((interest) => ({ value: interest, label: interest }))} selected={profile.interests} onPick={(interest) => onProfile({ interests: profile.interests.includes(interest) ? profile.interests.filter((item) => item !== interest) : [...profile.interests, interest] })} />}
        <SettingsValueRow title="Радиус поиска" hint="Что считать «рядом»" value={settings === null ? undefined : radiusLabel(settings.searchRadiusKm)} expanded={picker === "radius"} onOpen={() => open("radius")} />
        {picker === "radius" && settings !== null && <SettingsPicker options={SEARCH_RADIUS_OPTIONS.map((km) => ({ value: String(km), label: radiusLabel(km) }))} selected={[String(settings.searchRadiusKm)]} onPick={(km) => onSettings({ searchRadiusKm: Number(km) })} />}
      </SettingsGroup>

      <SettingsGroup title="Приватность">
        <SettingsValueRow title="Кто видит мои планы" hint="По умолчанию для новых записей" value={planVisibilityLabel(profile.privacy.routes)} expanded={picker === "plans"} onOpen={() => open("plans")} />
        {picker === "plans" && (
          <SettingsPicker
            options={[
              { value: "friends", label: "Друзья" },
              { value: "hidden", label: "Никто" },
            ]}
            selected={[profile.privacy.routes]}
            onPick={(value) => onProfile({ privacy: { routes: value as Profile["privacy"]["routes"] } })}
          />
        )}
        <SettingsSwitchRow title="Показывать меня на карте" hint="Только когда я на событии" checked={settings?.showOnMap ?? false} onChange={(showOnMap) => onSettings({ showOnMap })} />
        <SettingsSwitchRow title="Статус «ищу компанию»" hint="Виден участникам события" checked={settings?.lookingForCompany ?? false} onChange={(lookingForCompany) => onSettings({ lookingForCompany })} />
        <SettingsSwitchRow title="История посещений" hint="Используется для подборок" checked={profile.privacy.visitHistory === "friends"} onChange={(on) => onProfile({ privacy: { visitHistory: on ? "friends" : "hidden" } })} />
      </SettingsGroup>

      <SettingsGroup title="Близкие">
        <SettingsValueRow title="Близкие друзья" hint="Только из тех, кто на вас подписан" value={closeFriends === undefined ? undefined : closeFriends.length === 0 ? "Нет" : String(closeFriends.length)} expanded={picker === "close"} onOpen={() => open("close")} />
        {picker === "close" && closeFriends !== undefined && followers !== undefined && <CloseFriendsList closeFriends={closeFriends} followers={followers} onToggle={onToggleClose ?? (() => {})} />}
        {picker === "close" && (closeFriends === undefined || followers === undefined) && <p className="app-set-note">Загрузка…</p>}
      </SettingsGroup>

      <SettingsGroup title="Уведомления">
        {/* Один переключатель на два поля контракта: маршрут и погода — это ровно то, из чего складывается «когда выходить». */}
        <SettingsSwitchRow title="Когда выходить" hint="С учётом маршрута и погоды" checked={profile.smartAlerts.leaveNow} onChange={(on) => onProfile({ smartAlerts: { leaveNow: on, weather: on } })} />
        <SettingsSwitchRow title="Освободилось место" hint="По листу ожидания" checked={settings?.seatFreed ?? false} onChange={(seatFreed) => onSettings({ seatFreed })} />
        <SettingsSwitchRow title="Планы друзей" hint="Когда друг записался рядом" checked={profile.smartAlerts.friendLeft} onChange={(on) => onProfile({ smartAlerts: { friendLeft: on } })} />
        <SettingsValueRow title="Тихие часы" hint={quietHoursHint(profile.smartAlerts.quietHoursFrom, profile.smartAlerts.quietHoursTo)} value={quietHoursLabel(profile.smartAlerts.quietHoursEnabled)} expanded={picker === "quiet"} onOpen={() => open("quiet")} />
        {picker === "quiet" && (
          <SettingsPicker
            options={[
              { value: "on", label: "Вкл" },
              { value: "off", label: "Выкл" },
            ]}
            selected={[profile.smartAlerts.quietHoursEnabled ? "on" : "off"]}
            onPick={(value) => onProfile({ smartAlerts: { quietHoursEnabled: value === "on" } })}
          />
        )}
      </SettingsGroup>

      {settings?.organizerMode === true && (
        <SettingsGroup title="Организаторам">
          <SettingsSwitchRow title="Режим организатора" hint="Панель, события и промо" checked={settings.organizerMode} onChange={(organizerMode) => onSettings({ organizerMode })} />
          <SettingsValueRow title="Реквизиты и оплата" hint="Билеты продаются у вас" value="Настроить" expanded={false} onOpen={onOrganizer} />
        </SettingsGroup>
      )}

      <SettingsGroup title="Мини-приложение">
        <SettingsSwitchRow title="Доступ к геолокации MAX" hint="Нужен для карты и «рядом»" checked={settings?.geoAccess ?? false} onChange={(geoAccess) => onSettings({ geoAccess })} />
        <SettingsSwitchRow title="Доступ к списку контактов" hint="Чтобы находить друзей в Афише" checked={settings?.contactsAccess ?? false} onChange={(contactsAccess) => onSettings({ contactsAccess })} />
        <SettingsValueRow title="Очистить кеш" hint={formatBytes(cacheBytes)} expanded={false} onOpen={onClearCache} />
        <SettingsValueRow title="О приложении" hint={`Версия ${APP_VERSION} · условия и помощь`} expanded={picker === "about"} onOpen={() => open("about")} />
      </SettingsGroup>
      {picker === "about" && <p className="app-set-note">MAX Афиша — афиша событий и совместного досуга внутри MAX. Версия {APP_VERSION}.</p>}

      <button type="button" className="app-set-disable" aria-expanded={picker === "disable"} onClick={() => (picker === "disable" ? onDisable() : open("disable"))}>
        {picker === "disable" ? "Точно отключить?" : "Отключить мини-приложение"}
      </button>
      {picker === "disable" && <p className="app-set-note">Мини-приложение убирается из списка в самом MAX — здесь мы только закроем его.</p>}
    </section>
  );
}

function AuthenticatedSettings({ user }: { user: User }) {
  const { navigate } = useRoute();
  const { updateUser } = useAuth();
  const theme = useAppTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [closeFriends, setCloseFriends] = useState<Friend[] | null>(null);
  const [followers, setFollowers] = useState<Friend[] | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const profileWrite = useRef(0);
  const bioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (value) => {
        if (alive) setProfile(value);
      },
      () => {
        if (alive) setLoadFailed(true);
      },
    );
    apiClient.getAppSettings(user.id).then(
      (value) => {
        if (alive) setSettings(value);
      },
      // The rows this aggregate feeds keep their last known state; the screen is the profile's, not its.
      () => {},
    );
    apiClient.listCloseFriends().then(
      (value) => {
        if (alive) setCloseFriends(value);
      },
      () => {
        if (alive) setCloseFriends([]);
      },
    );
    apiClient.listFollowers(user.id).then(
      (value) => {
        if (alive) setFollowers(value);
      },
      () => {
        if (alive) setFollowers([]);
      },
    );
    if (typeof window !== "undefined") setCacheBytes(appCacheBytes(window.localStorage));
    return () => {
      alive = false;
    };
  }, [user.id]);

  if (loadFailed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (profile === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
        </div>
      </div>
    );

  return (
    <>
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Файл шапки"
        onChange={(change) => {
          const file = change.target.files?.[0];
          change.target.value = "";
          if (!file) return;
          void readFeedPhoto(file).then((url) => {
            if (url === null) return;
            setProfile((current) => (current === null ? current : { ...current, coverUrl: url }));
            apiClient.updateProfile({ coverUrl: url }).then(setProfile, () => setSaveFailed(true));
          });
        }}
      />
    <SettingsView
      user={user}
      profile={profile}
      settings={settings}
      theme={theme}
      cacheBytes={cacheBytes}
      failed={saveFailed}
      onPickCover={() => coverRef.current?.click()}
      onResetCover={
        profile.coverUrl === null
          ? undefined
          : () => {
              setSaveFailed(false);
              const previous = profile;
              setProfile({ ...profile, coverUrl: null });
              apiClient.updateProfile({ coverUrl: null }).then(setProfile, () => {
                setProfile(previous);
                setSaveFailed(true);
              });
            }
      }
      onResetAvatar={
        isCustomProfileAvatar(user.avatarUrl)
          ? () => {
              setSaveFailed(false);
              apiClient.updateProfile({ avatarUrl: null }).then(
                () => {
                  apiClient.getMe().then(({ user: next }) => updateUser(next), () => updateUser({ ...user, avatarUrl: null }));
                },
                () => setSaveFailed(true),
              );
            }
          : undefined
      }
      onProfile={(patch) => {
        setSaveFailed(false);
        // Optimistic: a switch that waits for the server reads as a broken switch. The response is the
        // truth that lands afterwards, and a rejected write puts the old value back.
        const previous = profile;
        setProfile({ ...profile, ...patch, smartAlerts: { ...profile.smartAlerts, ...patch.smartAlerts }, privacy: { ...profile.privacy, ...patch.privacy } });
        const flush = () => {
          const n = ++profileWrite.current;
          apiClient.updateProfile(patch).then(
            (saved) => {
              if (n !== profileWrite.current) {
                setProfile((current) => (current === null ? saved : patch.bio !== undefined ? { ...saved, bio: current.bio } : saved));
                return;
              }
              setProfile(saved);
            },
            () => {
              if (n !== profileWrite.current) return;
              setProfile(previous);
              setSaveFailed(true);
            },
          );
        };
        if (patch.bio !== undefined) {
          if (bioTimer.current) clearTimeout(bioTimer.current);
          bioTimer.current = setTimeout(flush, 350);
          return;
        }
        flush();
      }}
      onSettings={(patch) => {
        setSaveFailed(false);
        const previous = settings;
        if (settings !== null) setSettings({ ...settings, ...patch });
        apiClient.updateAppSettings(user.id, patch).then(setSettings, () => {
          setSettings(previous);
          setSaveFailed(true);
        });
      }}
      onClearCache={() => {
        if (typeof window === "undefined") return;
        clearAppCache(window.localStorage);
        setCacheBytes(appCacheBytes(window.localStorage));
      }}
      onOrganizer={() => navigate({ name: "organizer" })}
      // MAX Bridge has no "disable" call (https://dev.max.ru/docs/webapps/bridge): closing is all a
      // mini-app may do about itself, the removal happens in MAX.
      onDisable={() => getWebApp()?.close()}
      closeFriends={closeFriends ?? undefined}
      followers={followers ?? undefined}
      onToggleClose={(userId, close) => {
        if (closeFriends === null || followers === null) return;
        setSaveFailed(false);
        const previous = closeFriends;
        const person = followers.find((row) => row.id === userId) ?? previous.find((row) => row.id === userId);
        if (person === undefined) return;
        setCloseFriends(close ? [...previous.filter((row) => row.id !== userId), person] : previous.filter((row) => row.id !== userId));
        apiClient.setCloseFriend(userId, close).then(
          (stored) => {
            if (stored === close) return;
            setCloseFriends(previous);
          },
          () => {
            setCloseFriends(previous);
            setSaveFailed(true);
          },
        );
      }}
    />
    </>
  );
}

export function SettingsPage() {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedSettings user={auth.user} />;
  if (auth.status === "error") {
    return <AppState error>Не удалось войти: {auth.message}</AppState>;
  }
  if (auth.status === "loading") {
    return <AppState>Загрузка…</AppState>;
  }
  return <AppState>Откройте приложение внутри MAX, чтобы авторизоваться.</AppState>;
}
