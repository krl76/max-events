// START_MODULE_CONTRACT
// PURPOSE: The «Создать» tab of the user contour: one entry point to everything a viewer can publish — a story, a post, a plan, a micro-event.
// SCOPE: Navigation only. Every destination is an existing screen; the publication screens themselves live in their own modules (story: ../create/StoryCreatePage.js, post: ../create/PostCreatePage.js, plan: ../plans/PlanCreatePage.js, micro-event: ../micro/MicroEvents.js).
// DEPENDS: ../routing/router.js (useRoute), ../ui/primitives.js (AppSection), ../ui/icons.js (ActionIcon), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CreateEntry - one publication entry: icon, label, one line of what it is for, target route
// - CREATE_ENTRIES - the four publication entries in design order
// - CreateView - presentational: four equal full-width tiles, icon, label and one line
// - CreatePage - container: routes the picked entry
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, Friend, MicroEvent } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { showPhoto } from "../ui/photos";
import type { Route } from "../routing/router";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSection } from "../ui/primitives";

export interface CreateEntry {
  image: string;
  label: string;
  description: string;
  route: Route;
}

/** Макет, экран 03: «Создать» opens публикация — история (05), пост (06), план. The micro-event joins them: it is the fourth thing a viewer publishes. */
export const CREATE_ENTRIES: CreateEntry[] = [
  { image: "/covers/visits/gorky-me.jpg", label: "История", description: "Кадр, который друзья увидят сутки", route: { name: "story-new" } },
  { image: "/covers/visits/museum.jpg", label: "Пост", description: "Фото и мысль к событию", route: { name: "feed-new", eventId: null } },
  { image: "/covers/concert.jpg", label: "План", description: "Собрать вечер из афиши", route: { name: "plan-new" } },
  { image: "/covers/visits/cleanup.jpg", label: "Микро-событие", description: "Короткая встреча со своими", route: { name: "micro-new" } },
];

const FACE_CAP = 4;

export function eventWhen(startsAt: string): string {
  const date = new Date(startsAt);
  const day = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

export function CreateView({ onPick }: { onPick: (route: Route) => void }) {
  return (
    <AppSection className="app-create-section" ariaLabel="Создать">
      <div className="app-create-board">
        {CREATE_ENTRIES.map((entry, index) => (
          <button key={entry.label} type="button" className={`app-create-card app-create-card--${index}`} onClick={() => onPick(entry.route)}>
            <img className="app-create-card-photo" alt="" src={entry.image} />
            <span className="app-create-card-copy">
              <span className="app-create-card-label">{entry.label}</span>
              <span className="app-create-card-line">{entry.description}</span>
            </span>
          </button>
        ))}
      </div>
    </AppSection>
  );
}

function FaceRow({ people }: { people: readonly Friend[] }) {
  const shown = people.slice(0, FACE_CAP);
  const rest = people.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <span className="app-create-faces" aria-hidden="true">
      {shown.map((person) => {
        const face = showPhoto(person.avatarUrl);
        return (
          <span key={person.id} className="app-create-face">
            {face ? <img alt="" src={face} /> : person.name.slice(0, 1)}
          </span>
        );
      })}
      {rest > 0 && <span className="app-create-faces-more">+{rest}</span>}
    </span>
  );
}

export function CreateContinue({ events, micros, onOpenEvent, onOpenMicro }: { events: Event[]; micros: MicroEvent[]; onOpenEvent: (id: string) => void; onOpenMicro: (id: string) => void }) {
  if (events.length === 0 && micros.length === 0) return null;
  return (
    <div className="app-create-live">
      {events.length > 0 && (
        <>
          <p className="app-create-live-title">Ближайшие события</p>
          {events.slice(0, 3).map((event) => {
            const photo = showPhoto(event.coverUrl);
            return (
              <button key={event.id} type="button" className="app-create-live-row" onClick={() => onOpenEvent(event.id)}>
                {photo ? <img alt="" src={photo} /> : <span className={`app-create-live-photo app-media--${event.category}`} />}
                <span className="app-create-live-copy">
                  <strong>{event.title}</strong>
                  <span>{eventWhen(event.startsAt)}</span>
                </span>
                <ActionIcon name="chevron" size={16} />
              </button>
            );
          })}
        </>
      )}
      {micros.length > 0 && (
        <>
          <p className="app-create-live-title">Открытые сборы</p>
          {micros.slice(0, 3).map((item) => (
            <button key={item.id} type="button" className="app-create-live-row" onClick={() => onOpenMicro(item.id)}>
              <span className="app-create-live-copy">
                <strong>{item.title}</strong>
                <span>{eventWhen(item.startsAt)}</span>
              </span>
              <FaceRow people={item.participants ?? []} />
              <ActionIcon name="chevron" size={16} />
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function CreatePage() {
  const { navigate } = useRoute();
  const auth = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [micros, setMicros] = useState<MicroEvent[]>([]);

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (!alive) return;
        setEvents(
          list
            .filter((event) => Date.parse(event.startsAt) >= Date.now())
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
            .slice(0, 3),
        );
      },
      () => {},
    );
    apiClient.listMicroEvents().then(
      (list) => {
        if (!alive) return;
        const userId = auth.status === "authenticated" ? auth.user.id : null;
        setMicros(list.filter((item) => item.status === "open" && (userId === null || !item.participantIds.includes(userId))).slice(0, 3));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [auth]);

  return (
    <>
      <CreateView onPick={navigate} />
      <CreateContinue events={events} micros={micros} onOpenEvent={(id) => navigate({ name: "event", id })} onOpenMicro={(id) => navigate({ name: "micro-event", id })} />
    </>
  );
}
