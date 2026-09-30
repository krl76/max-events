// START_MODULE_CONTRACT
// PURPOSE: Share a MAX chat link that opens the viewer's profile so the other person can add them.
// SCOPE: Payload, share, hook, and the blue «Пригласить в MAX» button. Used on the friends screen and wherever the friend graph is empty (picker, gathering, plan).
// DEPENDS: react, ../auth/AuthContext.js, ../max/bridge.js, ../max/links.js, ../ui/icons.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FRIENDS_INVITE_LABEL - the button copy
// - friendsInvitePayload - sentence plus user- startapp
// - shareFriendsInvite - shareMaxContent / clipboard for that payload
// - useInviteFriends - bound to the signed-in viewer
// - FriendsInviteButton - the blue pill used on empty friend surfaces
// END_MODULE_MAP

import { useAuth } from "../auth/AuthContext";
import { announceShare, getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { ActionIcon } from "../ui/icons";

export const FRIENDS_INVITE_LABEL = "Пригласить в MAX";

/** What the MAX share sheet puts in the chat, with a link that opens this person's profile. */
export function friendsInvitePayload(userId: string): { text: string; link?: string } {
  return sharePayload("Добавь меня в друзья в Афише MAX", `user-${userId}`);
}

export function shareFriendsInvite(userId: string): void {
  const payload = friendsInvitePayload(userId);
  void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
}

export function useInviteFriends(): () => void {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  return () => {
    if (userId === null) return;
    shareFriendsInvite(userId);
  };
}

export function FriendsInviteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="app-friends-invite" onClick={onClick}>
      <ActionIcon name="share" size={18} />
      {FRIENDS_INVITE_LABEL}
    </button>
  );
}
