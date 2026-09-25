// START_MODULE_CONTRACT
// PURPOSE: Экран 40 «Достижения»: the «N из 4 собрано» summary, the line that says there are only four and they are private, the four cards (the granted one on the brand gradient) and the «Ближе всего — …» block with its event entry.
// SCOPE: Exactly four achievements — the closed AchievementCode enum — via apiClient.getAchievements; the suggested event of the nearest achievement via apiClient.listEvents. No progress derivation here: the backend and the mock both derive it from the visit history.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/primitives.js, ../ui/icons.js, @max-events/api-contracts (Achievement, AchievementCode, Event, EventCategory), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ACHIEVEMENT_TITLES - the four titles as the design names them, keyed by the closed code enum
// - ACHIEVEMENT_UNITS - what each achievement counts, declined in ru («концерт» / «концерта» / «концертов»)
// - ACHIEVEMENT_CATEGORY - which event category moves each achievement forward, so the block can suggest one
// - achievementProgressPercent - clamped progress percentage of one achievement
// - collectedSummary - «1 из 4»
// - grantedLabel - «Получено 6 сентября»
// - remainingLabel - «Осталось 5 из 12»
// - nearestAchievement - the ungranted achievement closest to its threshold, null when all four are collected
// - nearestHint - «Осталось 5 концертов до порога. В пятницу как раз Джаз-квартет.»
// - AchievementsState - union of the achievements fetch states (loading / error / ready)
// - AchievementCard - one card: title, status line, counter or check, progress bar
// - AchievementsView - presentational: summary, the four cards and the «Ближе всего» block
// - AchievementsPage - route container: loads the four achievements and an event for the nearest one
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Achievement, AchievementCode, Event, EventCategory } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppState } from "../ui/primitives";

/**
 * The screen names the four the way the design names them. The contract carries a title too, but the
 * backend wording («Музыкальный фанат», «Город за выходные») predates the design and renaming it is a
 * backend change; the code enum is closed, so a table keyed by it stays exhaustive either way.
 */
export const ACHIEVEMENT_TITLES: Record<AchievementCode, string> = {
  city_explorer: "Исследователь города",
  music_fan: "Меломан",
  weekend_city: "Город на выходных",
  volunteer: "Волонтёр",
};

export const ACHIEVEMENT_UNITS: Record<AchievementCode, readonly [string, string, string]> = {
  city_explorer: ["место", "места", "мест"],
  music_fan: ["концерт", "концерта", "концертов"],
  weekend_city: ["район", "района", "районов"],
  volunteer: ["акция", "акции", "акций"],
};

export const ACHIEVEMENT_CATEGORY: Record<AchievementCode, EventCategory> = {
  city_explorer: "tourism",
  music_fan: "afisha",
  weekend_city: "tourism",
  volunteer: "volunteering",
};

const WEEKDAY_WHEN: readonly string[] = ["в воскресенье", "в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"];

export function achievementProgressPercent(achievement: Achievement): number {
  return Math.round((achievement.progress / achievement.threshold) * 100);
}

export function collectedSummary(achievements: Achievement[]): string {
  return `${achievements.filter((item) => item.grantedAt !== null).length} из ${achievements.length}`;
}

export function grantedLabel(grantedAt: string): string {
  return `Получено ${new Date(grantedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

export function remainingLabel(achievement: Achievement): string {
  return `Осталось ${achievement.threshold - achievement.progress} из ${achievement.threshold}`;
}

/** Closest to its threshold by share, not by the raw gap: two steps out of three is nearer than five out of twelve. */
export function nearestAchievement(achievements: Achievement[]): Achievement | null {
  let nearest: Achievement | null = null;
  for (const achievement of achievements) {
    if (achievement.grantedAt !== null) continue;
    if (nearest === null || achievement.progress / achievement.threshold > nearest.progress / nearest.threshold) nearest = achievement;
  }
  return nearest;
}

/** The two sentences of the block: what is left, and the upcoming event that would move it. */
export function nearestHint(achievement: Achievement, event: Event | null, now: Date): string {
  const left = achievement.threshold - achievement.progress;
  const gap = `Осталось ${left} ${pluralRu(left, ...ACHIEVEMENT_UNITS[achievement.code])} до порога.`;
  if (event === null) return gap;
  const startsAt = new Date(event.startsAt);
  const days = Math.round((startsAt.getTime() - now.getTime()) / 86_400_000);
  // Within the week the weekday reads like a plan («в пятницу»); past it only a date is honest.
  const when = days > 6 ? startsAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : WEEKDAY_WHEN[startsAt.getDay()];
  return `${gap} ${when.charAt(0).toUpperCase()}${when.slice(1)} как раз ${event.title}.`;
}

export type AchievementsState = { status: "loading" } | { status: "error" } | { status: "ready"; achievements: Achievement[] };

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  const granted = achievement.grantedAt !== null;
  return (
    <li className={granted ? "app-ach-card app-ach-card--granted" : "app-ach-card"}>
      <div className="app-ach-card-head">
        <span className="app-ach-card-text">
          <span className="app-ach-card-title">{ACHIEVEMENT_TITLES[achievement.code]}</span>
          <span className="app-ach-card-status">{granted ? grantedLabel(achievement.grantedAt!) : remainingLabel(achievement)}</span>
        </span>
        {granted ? (
          <ActionIcon name="check" size={26} strokeWidth={2.6} />
        ) : (
          <span className="app-ach-card-count">
            {achievement.progress}
            <span className="app-ach-card-of">/{achievement.threshold}</span>
          </span>
        )}
      </div>
      <span className="app-ach-bar" aria-hidden="true">
        <span className="app-ach-bar-fill" style={{ width: `${achievementProgressPercent(achievement)}%` }} />
      </span>
    </li>
  );
}

export function AchievementsView({ state, event = null, now = new Date(), onOpenEvent = () => {} }: { state: AchievementsState; event?: Event | null; now?: Date; onOpenEvent?: (eventId: string) => void }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить достижения.</AppState>;
  const nearest = nearestAchievement(state.achievements);
  return (
    <section className="app-ach">
      <p className="app-ach-summary">
        <span className="app-ach-summary-value">{collectedSummary(state.achievements)}</span>
        <span className="app-ach-summary-label">собрано</span>
      </p>
      <p className="app-ach-lead">Достижений всего четыре, и они только про тебя. Чужие мы не показываем.</p>
      <ul className="app-ach-list">
        {state.achievements.map((achievement) => (
          <AchievementCard key={achievement.code} achievement={achievement} />
        ))}
      </ul>
      {nearest !== null && (
        <div className="app-ach-next">
          <p className="app-ach-next-title">Ближе всего — {ACHIEVEMENT_TITLES[nearest.code].toLocaleLowerCase("ru-RU")}</p>
          <p className="app-ach-next-hint">{nearestHint(nearest, event, now)}</p>
          {/* Кнопка появляется только когда есть что открывать: мёртвая кнопка читается как сломанный экран */}
          {event !== null && (
            <button type="button" className="app-ach-next-cta" onClick={() => onOpenEvent(event.id)}>
              Открыть событие
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function AchievementsPage() {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<AchievementsState>({ status: "loading" });
  const [event, setEvent] = useState<Event | null>(null);
  const now = new Date();

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    apiClient.getAchievements(userId).then(
      (achievements) => {
        if (!alive) return;
        setState({ status: "ready", achievements });
        const nearest = nearestAchievement(achievements);
        if (nearest === null) return;
        apiClient.listEvents({ category: ACHIEVEMENT_CATEGORY[nearest.code] }).then(
          (events) => {
            // The soonest upcoming one: a suggestion pointing at a past event is worse than none.
            const upcoming = events.filter((item) => Date.parse(item.startsAt) >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            if (alive) setEvent(upcoming[0] ?? null);
          },
          () => {},
        );
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  return <AchievementsView state={state} event={event} now={now} onOpenEvent={(id) => navigate({ name: "event", id })} />;
}
