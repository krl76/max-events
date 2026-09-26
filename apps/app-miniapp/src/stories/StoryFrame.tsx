// START_MODULE_CONTRACT
// PURPOSE: Draw a published story the way the author arranged it: photo plus caption, event sticker, poll and seats.
// SCOPE: Presentational. Positions are percentages of the frame, the same numbers the composer stored.
// DEPENDS: @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import type { CSSProperties } from "react";
import type { Story, StoryCanvasObject } from "@max-events/api-contracts";

function objectStyle(object: StoryCanvasObject): CSSProperties {
  return { left: `${object.x}%`, top: `${object.y}%`, transform: `translate(-50%, -50%) scale(${object.scale ?? 1})` };
}

function captionClass(object: StoryCanvasObject): string {
  return `app-story-caption app-story-caption--${object.font ?? "plain"} app-story-caption--${object.color ?? "white"}`;
}

/** The published frame uses the same sticker, poll, seats and caption the composer drew. */
export function StoryFrame({ story, onOpenEvent, onVote }: { story: Story; onOpenEvent?: (eventId: string) => void; onVote?: (optionIndex: number) => void }) {
  const objects = story.objects ?? [];
  const firstText = objects.find((object) => object.kind === "text");
  return (
    <div className="app-story-frame">
      <img className="app-story-viewer-image" src={story.imageUrl} alt="" />
      {objects.map((object, index) => {
        const caption = object.kind === "text" ? (object.text && object.text.length > 0 ? object.text : object === firstText ? story.text : "") : "";
        return (
          <div key={object.id ?? `${object.kind}-${index}`} className={`app-story-frame-object app-story-frame-object--${object.kind}`} style={objectStyle(object)}>
            {object.kind === "text" && caption !== "" && <p className={captionClass(object)}>{caption}</p>}
            {object.kind === "event" && story.sticker !== null && (
              <button type="button" className="app-story-sticker" onClick={() => onOpenEvent?.(story.sticker?.eventId ?? "")}>
                <span className="app-story-sticker-dot" aria-hidden="true" />
                <span className="app-story-sticker-text">
                  <span className="app-story-sticker-title">{story.sticker.title}</span>
                  <span className="app-story-sticker-subtitle">{story.sticker.subtitle}</span>
                </span>
              </button>
            )}
            {object.kind === "seats" && story.sticker?.seatsLeft != null && (
              <div className="app-story-seats">
                <span className="app-story-seats-label">осталось мест</span>
                <span className="app-story-seats-count">{story.sticker.seatsLeft}</span>
              </div>
            )}
            {object.kind === "poll" && story.poll !== null && (
              <div className="app-story-poll">
                <p className="app-story-poll-kind">Опрос</p>
                <p className="app-story-poll-question">{story.poll.question}</p>
                <div className="app-story-poll-options">
                  {story.poll.options.map((option, index) => (
                    <button key={`${index}-${option}`} type="button" className={story.poll?.answer === index ? "app-story-poll-option app-story-poll-option--on" : "app-story-poll-option"} onClick={() => onVote?.(index)}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {objects.every((object) => object.kind !== "text") && story.text !== "" && <p className="app-story-frame-text app-story-frame-text--loose">{story.text}</p>}
    </div>
  );
}
