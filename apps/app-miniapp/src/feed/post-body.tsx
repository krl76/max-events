import { useState } from "react";
import { createPortal } from "react-dom";
import type { Friend } from "@max-events/api-contracts";
import { showPhoto } from "../ui/photos";

/** A caption longer than this, or broken into more than three lines, folds behind «Раскрыть». */
const FOLD_AT = 90;

/** People we can show as faces, without repeating one person. */
export function likeFaces(people: readonly Friend[]): Friend[] {
  const seen = new Set<string>();
  const unique: Friend[] = [];
  for (const person of people) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    unique.push(person);
  }
  return unique;
}

const LIKE_FACES = 3;

/** Friend faces under a post. The viewer is already excluded. Faces that do not fit the row are «+N»; the sheet names every friend. */
export function LikeFaces({ people }: { people: readonly Friend[] }) {
  const [open, setOpen] = useState(false);
  const friends = likeFaces(people);
  if (friends.length === 0) return null;
  const shown = friends.slice(0, LIKE_FACES);
  const rest = friends.slice(LIKE_FACES);
  return (
    <>
      <button type="button" className="app-feed-likes" aria-label={`Нравится друзьям: ${friends.map((person) => person.name).join(", ")}`} onClick={() => setOpen(true)}>
        <span>Нравится</span>
        <span className="app-feed-like-faces" aria-hidden="true">
          {shown.map((person) => {
            const face = showPhoto(person.avatarUrl);
            return (
              <span key={person.id} className="app-feed-like-face">
                {face ? <img alt="" src={face} /> : person.name.slice(0, 1)}
              </span>
            );
          })}
        </span>
        {rest.length > 0 && <span className="app-feed-like-more">+{rest.length}</span>}
      </button>
      {open &&
        createPortal(
          <div className="app-picker app-like-layer" role="dialog" aria-modal="true" aria-label="Друзья, которым нравится">
            <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={() => setOpen(false)} />
            <div className="app-like-sheet">
              <p className="app-place-title">Друзья</p>
              <ul className="app-like-people">
                {friends.map((person) => {
                  const face = showPhoto(person.avatarUrl);
                  return (
                    <li key={person.id}>
                      <span className="app-feed-like-face">{face ? <img alt="" src={face} /> : person.name.slice(0, 1)}</span>
                      <span>{person.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.querySelector(".app-root") ?? document.body,
        )}
    </>
  );
}

/** Post text. The fold control sits outside the clamped lines, so «Раскрыть» stays tappable. */
export function PostText({ text, className }: { text: string; className: string }) {
  const [open, setOpen] = useState(false);
  const long = text.trim().length > FOLD_AT || text.split("\n").length > 3;
  return (
    <div className="app-post-fold">
      <p className={long && !open ? `${className} app-post-fold-text` : className}>{text}</p>
      {long && (
        <button type="button" className="app-post-fold-btn" onClick={() => setOpen((value) => !value)}>
          {open ? "Скрыть" : "Раскрыть"}
        </button>
      )}
    </div>
  );
}
