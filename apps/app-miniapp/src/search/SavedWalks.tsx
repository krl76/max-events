import { useEffect, useRef, useState } from "react";
import type { CityWalk } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { ApiError } from "../api/endpoints/transport";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";

export function sortWalksNewest(walks: readonly CityWalk[]): CityWalk[] {
  return [...walks].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function walkCreatedLabel(at: string): string {
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) return at;
  return new Date(parsed).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function stopCountLabel(count: number): string {
  return `${count} ${pluralRu(count, "остановка", "остановки", "остановок")}`;
}

export function SavedWalkList({
  walks,
  onOpen,
  onBack,
}: {
  readonly walks: readonly CityWalk[];
  readonly onOpen: (id: string) => void;
  readonly onBack: () => void;
}) {
  const rows = sortWalksNewest(walks);
  return (
    <section className="app-walk">
      <button type="button" className="app-walk-back" onClick={onBack}>
        Назад
      </button>
      <h1 className="app-walk-title">Мои прогулки</h1>
      {rows.length === 0 ? <p className="app-walk-note">Сохранённых прогулок пока нет.</p> : null}
      <ol className="app-walk-stops">
        {rows.map((walk) => (
          <li key={walk.id} className="app-walk-stop">
            <button type="button" className="app-walk-back" onClick={() => onOpen(walk.id)}>
              <strong>{walk.city}</strong>
              <span className="app-walk-meta">
                {walkCreatedLabel(walk.createdAt)} · {stopCountLabel(walk.stops.length)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SavedWalkView({
  walk,
  onBack,
  onToggle,
  onMap,
}: {
  readonly walk: CityWalk;
  readonly onBack: () => void;
  readonly onToggle: (order: number, done: boolean) => void;
  readonly onMap?: () => void;
}) {
  return (
    <section className="app-walk">
      <button type="button" className="app-walk-back" onClick={onBack}>
        Назад
      </button>
      <h1 className="app-walk-title">{walk.city}</h1>
      <ol className="app-walk-stops">
        {walk.stops.map((stop) => (
          <li key={stop.sourceUrl} className="app-walk-stop">
            <span className="app-walk-num">{stop.order}</span>
            <div>
              <h3>{stop.title}</h3>
              <p className="app-walk-note">{stop.description}</p>
              <button type="button" aria-pressed={stop.done} onClick={() => onToggle(stop.order, !stop.done)}>
                Пройдено
              </button>
            </div>
          </li>
        ))}
      </ol>
      {onMap !== undefined ? (
        <button type="button" className="app-walk-back" onClick={onMap}>
          На карте
        </button>
      ) : null}
    </section>
  );
}

function markStop(walk: CityWalk, order: number, done: boolean): CityWalk {
  return { ...walk, stops: walk.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)) };
}

export function WalkListPage({
  list = () => apiClient.listCityWalks(),
}: {
  readonly list?: () => Promise<readonly CityWalk[]>;
}) {
  const { back, navigate } = useRoute();
  const [walks, setWalks] = useState<readonly CityWalk[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    list()
      .then((rows) => {
        if (live) setWalks(rows);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [list]);
  return (
    <>
      {failed ? <p className="app-walk-note">Не удалось открыть прогулки.</p> : null}
      <SavedWalkList walks={walks} onBack={back} onOpen={(id) => navigate({ name: "walk-saved", id })} />
    </>
  );
}

export function SavedWalkPage({
  id,
  load = (walkId) => apiClient.getCityWalk(walkId),
  setDone = (walkId, order, done) => apiClient.setCityWalkStopDone(walkId, order, done),
}: {
  readonly id: string;
  readonly load?: (id: string) => Promise<CityWalk>;
  readonly setDone?: (id: string, order: number, done: boolean) => Promise<CityWalk>;
}) {
  const { back, navigate } = useRoute();
  const [walk, setWalk] = useState<CityWalk | null>(null);
  const [missing, setMissing] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    setMissing(false);
    setWalk(null);
    load(id)
      .then((row) => {
        if (live.current) setWalk(row);
      })
      .catch((error: unknown) => {
        if (live.current && error instanceof ApiError && error.status === 404) setMissing(true);
      });
    return () => {
      live.current = false;
    };
  }, [id, load]);

  async function onToggle(order: number, done: boolean): Promise<void> {
    if (walk === null) return;
    const previous = walk;
    setWalk(markStop(walk, order, done));
    try {
      const saved = await setDone(id, order, done);
      if (live.current) setWalk(saved);
    } catch {
      if (live.current) setWalk(previous);
    }
  }

  if (missing) {
    return (
      <section className="app-walk">
        <button type="button" className="app-walk-back" onClick={back}>
          Назад
        </button>
        <p className="app-walk-note">Прогулка не найдена.</p>
      </section>
    );
  }
  if (walk === null) return <p className="app-walk-note">Открываем прогулку.</p>;
  return <SavedWalkView walk={walk} onBack={back} onToggle={(order, done) => void onToggle(order, done)} onMap={() => navigate({ name: "map", walkId: id })} />;
}
