// START_MODULE_CONTRACT
// PURPOSE: Draw a published story the way the author arranged it: photo plus caption, event sticker, poll and seats.
// SCOPE: Presentational. Positions are percentages of the frame, the same numbers the composer stored.
// DEPENDS: @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import type { CSSProperties } from "react";
import type { Friend, Story, StoryCanvasObject } from "@max-events/api-contracts";
import { friendHandle } from "../ui/friend-handle";
import { pictured } from "../ui/photos";
import { StoryMentionText, type StoryMentionLink } from "./story-text";

function objectStyle(object: StoryCanvasObject): CSSProperties {
  return { left: `${object.x}%`, top: `${object.y}%`, transform: `translate(-50%, -50%) scale(${object.scale ?? 1})` };
}

function captionClass(object: StoryCanvasObject): string {
  return `app-story-caption app-story-caption--${object.font ?? "plain"} app-story-caption--${object.color ?? "white"}`;
}

function mentionsFor(object: StoryCanvasObject, friends: readonly Friend[]): StoryMentionLink[] {
  if (object.mentions && object.mentions.length > 0) return object.mentions;
  const ids = new Set(object.mentionIds ?? []);
  return friends.filter((friend) => ids.has(friend.id)).map((friend) => ({ id: friend.id, handle: friendHandle(friend) }));
}

function seatsLabel(seatsLeft: number): string {
  const mod100 = seatsLeft % 100;
  const mod10 = seatsLeft % 10;
  const word = mod100 > 10 && mod100 < 20 ? "мест" : mod10 === 1 ? "место" : mod10 >= 2 && mod10 <= 4 ? "места" : "мест";
  return `${seatsLeft} ${word} свободно`;
}

function votesWord(total: number): string {
  const mod100 = total % 100;
  const mod10 = total % 10;
  if (mod100 > 10 && mod100 < 20) return "голосов";
  if (mod10 === 1) return "голос";
  if (mod10 >= 2 && mod10 <= 4) return "голоса";
  return "голосов";
}

/** The published frame uses the same sticker, poll, seats and caption the composer drew. */
export function StoryFrame({ story, friends = [], onOpenEvent, onOpenUser, onVote }: { story: Story; friends?: readonly Friend[]; onOpenEvent?: (eventId: string) => void; onOpenUser?: (userId: string) => void; onVote?: (optionIndex: number) => void }) {
  const objects = story.objects ?? [];
  const firstText = objects.find((object) => object.kind === "text");
  return (
    <div className="app-story-frame">
      <img className="app-story-viewer-image" src={story.imageUrl} alt="" />
      {objects.map((object, index) => {
        const caption = object.kind === "text" ? (object.text && object.text.length > 0 ? object.text : object === firstText ? story.text : "") : "";
        return (
          <div key={object.id ?? `${object.kind}-${index}`} className={`app-story-frame-object app-story-frame-object--${object.kind}`} style={objectStyle(object)}>
            {object.kind === "text" && caption !== "" && (
              <p className={captionClass(object)}>
                <StoryMentionText text={caption} mentions={mentionsFor(object, friends)} onOpen={onOpenUser} />
              </p>
            )}
            {object.kind === "event" && story.sticker !== null && (
              <button type="button" className="app-story-sticker" onClick={() => onOpenEvent?.(story.sticker?.eventId ?? "")}>
                {story.sticker.coverUrl ? <img className="app-story-sticker-cover" src={pictured(story.sticker.eventId, story.sticker.coverUrl)} alt="" /> : <span className="app-story-sticker-dot" aria-hidden="true" />}
                <span className="app-story-sticker-text">
                  <span className="app-story-sticker-title">{story.sticker.title}</span>
                  <span className="app-story-sticker-subtitle">{story.sticker.subtitle}</span>
                  {story.sticker.seatsLeft !== null && story.sticker.startsAt !== undefined && Date.parse(story.sticker.startsAt) > Date.now() && <span className="app-story-sticker-seats">{seatsLabel(story.sticker.seatsLeft)}</span>}
                </span>
              </button>
            )}
            {object.kind === "seats" && story.sticker?.seatsLeft != null && (
              <div className="app-story-seats">
                <span className="app-story-seats-label">осталось мест</span>
                <span className="app-story-seats-count">{story.sticker.seatsLeft}</span>
              </div>
            )}
            {object.kind === "poll" && story.poll !== null && <StoryPoll poll={story.poll} onVote={onVote} />}
          </div>
        );
      })}
      {objects.every((object) => object.kind !== "text") && story.text !== "" && (
        <p className="app-story-frame-text app-story-frame-text--loose">
          <StoryMentionText text={story.text} mentions={objects.flatMap((object) => mentionsFor(object, friends))} onOpen={onOpenUser} />
        </p>
      )}
    </div>
  );
}

function StoryPoll({ poll, onVote }: { poll: NonNullable<Story["poll"]>; onVote?: (optionIndex: number) => void }) {
  const voted = poll.answer !== null;
  const counts = poll.options.map((_, index) => poll.counts?.[index] ?? 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <div className={voted ? "app-story-poll app-story-poll--results" : "app-story-poll"}>
      <p className="app-story-poll-kind">Опрос</p>
      <p className="app-story-poll-question">{poll.question}</p>
      <div className="app-story-poll-options">
        {poll.options.map((option, index) => {
          const count = counts[index] ?? 0;
          const percent = total === 0 ? 0 : Math.round((count / total) * 100);
          const chosen = poll.answer === index;
          return (
            <button key={`${index}-${option}`} type="button" className={chosen ? "app-story-poll-option app-story-poll-option--on" : "app-story-poll-option"} onClick={() => onVote?.(index)}>
              {voted && <span className="app-story-poll-bar" style={{ width: `${percent}%` }} />}
              <span className="app-story-poll-label">{option}</span>
              {voted && (
                <span className="app-story-poll-pct">
                  {count} · {percent}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      {voted && (
        <p className="app-story-poll-total">
          {total} {votesWord(total)}
        </p>
      )}
    </div>
  );
}
