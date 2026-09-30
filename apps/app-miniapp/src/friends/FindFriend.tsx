// START_MODULE_CONTRACT
// PURPOSE: Find a person by MAX id or @username, or send them an invite link if they have not opened the mini-app yet.
// SCOPE: Presentational popup plus a small hook that talks to GET /friends/find. Invite uses ./invite.js.
// DEPENDS: ../api/client.js, ./invite.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - findFriendQuery - trim and strip a leading @
// - FindFriendDialog - popup: input, result, add or invite
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { apiClient, ApiError } from "../api/client";
import { ActionIcon } from "../ui/icons";
import { logError } from "../ui/log-error";
import { PersonAvatar } from "./avatar";

export function findFriendQuery(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

type FindState = { status: "idle" } | { status: "loading" } | { status: "ready"; friend: Friend } | { status: "missing" } | { status: "error" };

export function FindFriendDialog({ onClose, onOpen, onAdd, onInvite, adding = false }: { onClose: () => void; onOpen: (userId: string) => void; onAdd: (userId: string) => void; onInvite: () => void; adding?: boolean }) {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<FindState>({ status: "idle" });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function search(event: { preventDefault: () => void }) {
    event.preventDefault();
    const query = findFriendQuery(draft);
    if (query.length === 0) return;
    setState({ status: "loading" });
    apiClient.findFriendByMaxId(query).then(
      (friend) => setState({ status: "ready", friend }),
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "missing" });
          return;
        }
        logError("friend find failed", error);
        setState({ status: "error" });
      },
    );
  }

  return (
    <div className="app-me-pop" role="dialog" aria-modal="true" aria-labelledby="app-friends-find-title">
      <button type="button" className="app-me-pop-scrim" tabIndex={-1} aria-label="Закрыть" onClick={onClose} />
      <div className="app-me-pop-card app-friends-find">
        <h2 id="app-friends-find-title" className="app-me-pop-title">
          Найти друга
        </h2>
        <p className="app-friends-find-hint">По id MAX или @нику, если человек уже заходил в Афишу.</p>
        <form className="app-friends-find-form" onSubmit={search}>
          <input className="app-friends-find-input" value={draft} onChange={(change) => setDraft(change.target.value)} placeholder="id или @ник" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="id MAX" />
          <button type="submit" className="app-friends-find-go" disabled={findFriendQuery(draft).length === 0 || state.status === "loading"}>
            Найти
          </button>
        </form>
        {state.status === "loading" && <p className="app-friends-find-status">Ищем…</p>}
        {state.status === "error" && <p className="app-friends-find-status app-friends-find-status--error">Не удалось найти. Попробуйте ещё раз.</p>}
        {state.status === "ready" && (
          <button type="button" className="app-friends-find-hit" onClick={() => onOpen(state.friend.id)}>
            <PersonAvatar id={state.friend.id} name={state.friend.name} size={40} />
            <span className="app-friends-find-hit-copy">
              <span className="app-friends-find-hit-name">{state.friend.name}</span>
              {state.friend.username !== undefined && <span className="app-friends-find-hit-nick">@{state.friend.username}</span>}
            </span>
          </button>
        )}
        {state.status === "ready" && (
          <button type="button" className="app-me-pop-action" disabled={adding} onClick={() => onAdd(state.friend.id)}>
            Добавить в друзья
          </button>
        )}
        {state.status === "missing" && <p className="app-friends-find-status">Этого человека в Афише ещё нет. Отправьте ссылку — когда откроет, вы подпишетесь друг на друга.</p>}
        {(state.status === "idle" || state.status === "missing") && (
          <button type="button" className="app-me-pop-action" onClick={onInvite}>
            Отправить ссылку в MAX
          </button>
        )}
        <button type="button" className="app-me-pop-action app-me-pop-action--ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function FindFriendButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="app-friends-search" aria-label="Найти друга" onClick={onClick}>
      <ActionIcon name="search" size={18} />
    </button>
  );
}
