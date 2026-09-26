/** The @handle a person is mentioned by: their MAX username, or the first word of the name when they have none. */
export function friendHandle(friend: { name: string; username?: string | null }): string {
  const nick = friend.username?.trim().replace(/^@/, "");
  if (nick) return nick;
  return friend.name.trim().split(/\s+/)[0] || "друг";
}
