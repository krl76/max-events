// START_MODULE_CONTRACT
// PURPOSE: Achievements screen: Instagram-style stamp grid with progress per achievement, granted stamps visually distinct.
// SCOPE: Data via apiClient.getAchievements (mock or live); presentational rendering + profile entry link; no derivation logic (mock derives in api/mock.js).
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ../event/EventPage.js (DEMO_USER_ID), ../routing/router.js, @max-events/api-contracts (Achievement), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AchievementsState - union of the achievements fetch states (loading / error / ready)
// - achievementProgressPercent - clamped progress percentage of one achievement
// - AchievementsView - presentational: one stamp tile per achievement with title, progress line and bar
// - AchievementsPage - route container: loads the achievements of the current user
// - AchievementsLink - profile entry button to the achievements screen
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Achievement } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DEMO_USER_ID } from "../event/EventPage";
import { useRoute } from "../routing/router";

export type AchievementsState = { status: "loading" } | { status: "error" } | { status: "ready"; achievements: Achievement[] };

export function achievementProgressPercent(achievement: Achievement): number {
  return Math.round((achievement.progress / achievement.threshold) * 100);
}

export function AchievementsView({ state }: { state: AchievementsState }) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить достижения.</p>;
  return (
    <ul className="app-achievements">
      {state.achievements.map((achievement) => (
        <li key={achievement.code} className={`app-achievement${achievement.grantedAt !== null ? " app-achievement--granted" : ""}`}>
          <span className="app-achievement-stamp" aria-hidden="true">
            {achievement.grantedAt !== null ? "✓" : achievementProgressPercent(achievement)}
          </span>
          <span className="app-achievement-title">{achievement.title}</span>
          <span className="app-achievement-progress">
            {achievement.progress} / {achievement.threshold}
          </span>
          <span className="app-achievement-bar" aria-hidden="true">
            <span className="app-achievement-bar-fill" style={{ width: `${achievementProgressPercent(achievement)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AchievementsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const [state, setState] = useState<AchievementsState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getAchievements(userId).then(
      (achievements) => {
        if (alive) setState({ status: "ready", achievements });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);
  return <AchievementsView state={state} />;
}

export function AchievementsLink() {
  const { navigate } = useRoute();
  return (
    <button type="button" className="app-lists-link" onClick={() => navigate({ name: "achievements" })}>
      Достижения
    </button>
  );
}
