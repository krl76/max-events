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

export function StoryFrame({ story }: { story: Story }) {
  const objects = story.objects ?? [];
  const firstText = objects.find((object) => object.kind === "text");
  return (
    <div className="app-story-frame">
      <img className="app-story-viewer-image" src={story.imageUrl} alt="" />
      {objects.map((object, index) => {
        const caption = object.kind === "text" ? (object.text && object.text.length > 0 ? object.text : object === firstText ? story.text : "") : "";
        return (
          <div key={object.id ?? `${object.kind}-${index}`} className={`app-story-frame-object app-story-frame-object--${object.kind}`} style={objectStyle(object)}>
            {object.kind === "text" && caption !== "" && <p className="app-story-frame-text">{caption}</p>}
            {object.kind === "event" && story.sticker !== null && (
              <div className="app-story-frame-sticker">
                <span className="app-story-frame-sticker-title">{story.sticker.title}</span>
                <span className="app-story-frame-sticker-sub">{story.sticker.subtitle}</span>
              </div>
            )}
            {object.kind === "seats" && story.sticker?.seatsLeft != null && (
              <div className="app-story-frame-seats">
                <span>осталось мест</span>
                <strong>{story.sticker.seatsLeft}</strong>
              </div>
            )}
            {object.kind === "poll" && story.poll !== null && (
              <div className="app-story-frame-poll">
                <p>{story.poll.question}</p>
                <div>
                  {story.poll.options.map((option) => (
                    <span key={option}>{option}</span>
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
