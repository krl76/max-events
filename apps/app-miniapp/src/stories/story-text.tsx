import type { ReactNode } from "react";

export interface StoryMentionLink {
  id: string;
  handle: string;
}

export type StoryTextPart = { type: "text"; value: string } | { type: "mention"; value: string; id: string };

function isHandleChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

/** Splits a caption so each stored @handle can be drawn as a link. Longer handles win over prefixes. */
export function splitStoryText(text: string, mentions: readonly StoryMentionLink[]): StoryTextPart[] {
  const handles = [...mentions].filter((item) => item.handle !== "").sort((a, b) => b.handle.length - a.handle.length);
  if (handles.length === 0 || !text.includes("@")) return [{ type: "text", value: text }];
  const parts: StoryTextPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const at = text.indexOf("@", cursor);
    if (at === -1) {
      parts.push({ type: "text", value: text.slice(cursor) });
      break;
    }
    const rest = text.slice(at + 1);
    const hit = handles.find((item) => rest.startsWith(item.handle) && !isHandleChar(rest.charAt(item.handle.length)));
    if (hit === undefined) {
      cursor = at + 1;
      continue;
    }
    if (at > cursor) parts.push({ type: "text", value: text.slice(cursor, at) });
    parts.push({ type: "mention", value: `@${hit.handle}`, id: hit.id });
    cursor = at + 1 + hit.handle.length;
  }
  return parts.length === 0 ? [{ type: "text", value: text }] : parts;
}

export function StoryMentionText({ text, mentions, onOpen }: { text: string; mentions: readonly StoryMentionLink[]; onOpen?: (userId: string) => void }): ReactNode {
  return splitStoryText(text, mentions).map((part, index) =>
    part.type === "text" ? (
      <span key={index}>{part.value}</span>
    ) : onOpen === undefined ? (
      <span key={index} className="app-story-mention">
        {part.value}
      </span>
    ) : (
      <button key={index} type="button" className="app-story-mention" onClick={() => onOpen(part.id)}>
        {part.value}
      </button>
    ),
  );
}
