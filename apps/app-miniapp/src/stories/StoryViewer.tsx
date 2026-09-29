// START_MODULE_CONTRACT
// PURPOSE: Fullscreen story viewer over multiple authors: author header, per-story progress segments, tap left/right and 5s auto-advance, cross-author transitions (Instagram-style), close control.
// SCOPE: Presentational viewer; navigation math lives in the pure flattenStoryGroups/nextPosition/prevPosition helpers.
// DEPENDS: react, @max-events/api-contracts (Story), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - STORY_DURATION_MS - auto-advance interval per story
// - StoryGroup - one author's stories with the display name
// - StoryPosition - flattened viewing position: group index + index within the group
// - flattenStoryGroups - groups -> flat position list in viewing order
// - nextPosition - next flat index, null past the very last story (viewer closes)
// - prevPosition - previous flat index, null before the very first story
// - StoryViewer - fullscreen overlay across authors, starting at startPosition; onView reports every story actually shown, which is what marks it seen in the rail; the current segment fills over STORY_DURATION_MS (handed to CSS as --app-story-duration, so bar and timer cannot drift apart), segments are keyed by author so a new author's first segment starts its fill afresh, and the image is keyed by story so each one fades in
// END_MODULE_MAP

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Friend, Story } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { StoryFrame } from "./StoryFrame";

export const STORY_DURATION_MS = 5000;

export interface StoryGroup {
  authorName: string;
  stories: Story[];
}

export interface StoryPosition {
  group: number;
  index: number;
  groupSize: number;
  authorName: string;
  story: Story;
}

export function flattenStoryGroups(groups: StoryGroup[]): StoryPosition[] {
  const positions: StoryPosition[] = [];
  groups.forEach((group, groupIndex) => {
    group.stories.forEach((story, index) => {
      positions.push({ group: groupIndex, index, groupSize: group.stories.length, authorName: group.authorName, story });
    });
  });
  return positions;
}

export function nextPosition(positions: StoryPosition[], flat: number): number | null {
  const next = flat + 1;
  return next < positions.length ? next : null;
}

export function prevPosition(flat: number): number | null {
  return flat > 0 ? flat - 1 : null;
}

function withLocalVote(poll: NonNullable<Story["poll"]>, optionIndex: number): NonNullable<Story["poll"]> {
  const counts = poll.options.map((_, index) => poll.counts?.[index] ?? 0);
  const previous = poll.answer;
  if (previous === optionIndex) return { ...poll, counts };
  if (previous !== null && counts[previous] !== undefined) counts[previous] = Math.max(0, counts[previous] - 1);
  counts[optionIndex] = (counts[optionIndex] ?? 0) + 1;
  return { ...poll, answer: optionIndex, counts };
}

export function StoryViewer({ groups, startGroup = 0, onView, onClose }: { groups: StoryGroup[]; startGroup?: number; onView?: (story: Story) => void; onClose: () => void }) {
  const { navigate } = useRoute();
  const [polls, setPolls] = useState<Record<string, Story["poll"]>>({});
  const [friends, setFriends] = useState<Friend[]>([]);
  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  const positions = useMemo(() => flattenStoryGroups(groups), [groups]);
  const [flat, setFlat] = useState(() => {
    const found = positions.findIndex((position) => position.group === startGroup);
    return found >= 0 ? found : 0;
  });
  const current = positions[flat];

  const goNext = () => {
    const next = nextPosition(positions, flat);
    if (next === null) onClose();
    else setFlat(next);
  };

  const goPrev = () => {
    const prev = prevPosition(flat);
    if (prev !== null) setFlat(prev);
  };
  const [paused, setPaused] = useState(false);
  const remain = useRef(STORY_DURATION_MS);
  const pressedAt = useRef(0);
  const held = useRef(false);

  useEffect(() => {
    remain.current = STORY_DURATION_MS;
    setPaused(false);
  }, [flat]);

  useEffect(() => {
    if (paused || current === undefined) return;
    const started = Date.now();
    const timer = setTimeout(goNext, remain.current);
    return () => {
      remain.current = Math.max(0, remain.current - (Date.now() - started));
      clearTimeout(timer);
    };
  }, [paused, flat, current?.story.id]);

  // Просмотр засчитывается по показу, а не по открытию просмотрщика: иначе кольцо гасло бы у
  // историй, до которых автор не долистал. Колбэк живёт в ref: он приходит из рельса, который сам
  // перерисовывается от отметки просмотра, и в зависимостях эффекта дал бы бесконечный круг.
  const shown = current === undefined ? null : current.story;
  const report = useRef(onView);
  useEffect(() => {
    report.current = onView;
  }, [onView]);
  useEffect(() => {
    if (shown !== null) report.current?.(shown);
  }, [shown]);

  if (!current) return null;

  const basePoll = polls[current.story.id] ?? current.story.poll;
  const shownStory = basePoll === null ? current.story : { ...current.story, poll: basePoll };
  const vote = (optionIndex: number) => {
    const storyId = current.story.id;
    const previous = basePoll;
    if (previous === null) return;
    setPolls((known) => ({ ...known, [storyId]: withLocalVote(previous, optionIndex) }));
    void apiClient.voteStory(storyId, optionIndex).then(
      (story) => setPolls((known) => ({ ...known, [storyId]: story.poll })),
      () => setPolls((known) => ({ ...known, [storyId]: previous })),
    );
  };

  // Заполнение сегмента рисует CSS, но длину показа знает только этот модуль — она уходит переменной,
  // и полоса не может разойтись с таймером перелистывания выше.
  const segmentsStyle = { "--app-story-duration": `${STORY_DURATION_MS}ms` } as CSSProperties;

  return (
    <div
      className={paused ? "app-story-viewer app-story-viewer--paused" : "app-story-viewer"}
      role="dialog"
      aria-label={`История: ${current.authorName}`}
      onPointerDown={() => {
        pressedAt.current = Date.now();
        held.current = false;
        setPaused(true);
      }}
      onPointerUp={() => {
        if (Date.now() - pressedAt.current > 220) held.current = true;
        setPaused(false);
      }}
      onPointerCancel={() => setPaused(false)}
    >
      <StoryFrame key={current.story.id} story={shownStory} friends={friends} onOpenEvent={(eventId) => eventId !== "" && navigate({ name: "event", id: eventId })} onOpenUser={(userId) => navigate({ name: "user", id: userId })} onVote={vote} />
      <div className="app-story-viewer-top">
        <div className="app-story-viewer-segments" style={segmentsStyle}>
          {/* key с номером автора: у нового автора первый сегмент — новый элемент, и его заполнение стартует с нуля */}
          {Array.from({ length: current.groupSize }, (_, segment) => (
            <span key={`${current.group}-${segment}`} className={segment < current.index ? "app-story-segment app-story-segment--done" : segment === current.index ? "app-story-segment app-story-segment--current" : "app-story-segment"} />
          ))}
        </div>
        <div className="app-story-viewer-head">
          <button type="button" className="app-story-viewer-author" aria-label={`Профиль ${current.authorName}`} onClick={() => navigate({ name: "user", id: current.story.userId })}>
            {current.authorName}
          </button>
          <button type="button" className="app-story-viewer-close" aria-label="Закрыть" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
      <button
        type="button"
        className="app-story-viewer-tap app-story-viewer-tap--left"
        aria-label="Предыдущая история"
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          goPrev();
        }}
      />
      <button
        type="button"
        className="app-story-viewer-tap app-story-viewer-tap--right"
        aria-label="Следующая история"
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          goNext();
        }}
      />
    </div>
  );
}
