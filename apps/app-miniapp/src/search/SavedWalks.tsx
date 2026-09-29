import { useEffect, useRef, useState } from "react";
import type { CityWalk } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { ApiError } from "../api/endpoints/transport";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppChip } from "../ui/primitives";
import { WalkBack } from "./WalkWizard";

function defaultListCityWalks(): Promise<CityWalk[]> {
  return apiClient.listCityWalks();
}

function defaultLoadCityWalk(id: string): Promise<CityWalk> {
  return apiClient.getCityWalk(id);
}

function defaultSetCityWalkStopDone(id: string, order: number, done: boolean): Promise<CityWalk> {
  return apiClient.setCityWalkStopDone(id, order, done);
}

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

export function SavedWalkList({ walks, onOpen, onBack }: { readonly walks: readonly CityWalk[]; readonly onOpen: (id: string) => void; readonly onBack: () => void }) {
  const rows = sortWalksNewest(walks);
  return (
    <section className="app-walk">
      <WalkBack onBack={onBack} />
      <header className="app-walk-head">
        <p className="app-walk-kicker">Сохранённые</p>
        <h1 className="app-walk-title">Мои прогулки</h1>
      </header>
      {rows.length === 0 ? <p className="app-walk-note">Сохранённых прогулок пока нет.</p> : null}
      <ol className="app-walk-stops">
        {rows.map((walk) => (
          <li key={walk.id}>
            <button type="button" className="app-walk-saved" onClick={() => onOpen(walk.id)}>
              <span>
                <strong>{walk.city}</strong>
                <span className="app-walk-meta">
                  {walkCreatedLabel(walk.createdAt)} · {stopCountLabel(walk.stops.length)}
                </span>
              </span>
              <ActionIcon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SavedWalkView({ walk, onBack, onToggle, onMap, onPlace }: { readonly walk: CityWalk; readonly onBack: () => void; readonly onToggle: (order: number, done: boolean) => void; readonly onMap?: () => void; readonly onPlace?: (id: string) => void }) {
  return (
    <section className="app-walk">
      <WalkBack onBack={onBack} />
      <header className="app-walk-head">
        <p className="app-walk-kicker">Сохранённая</p>
        <h1 className="app-walk-title">{walk.city}</h1>
      </header>
      <ol className="app-walk-stops">
        {walk.stops.map((stop) => (
          <li key={stop.sourceUrl} className="app-walk-stop">
            <span className="app-walk-num">{stop.order}</span>
            <div>
              {stop.placeId !== null && onPlace !== undefined ? (
                <button type="button" className="app-walk-place" onClick={() => onPlace(stop.placeId!)}>
                  {stop.title}
                </button>
              ) : (
                <h3>{stop.title}</h3>
              )}
              {stop.address ? <p className="app-walk-meta">{stop.address}</p> : null}
              <p className="app-walk-note">{stop.description}</p>
              <AppChip pressed={stop.done} onClick={() => onToggle(stop.order, !stop.done)}>
                Пройдено
              </AppChip>
            </div>
          </li>
        ))}
      </ol>
      {onMap !== undefined ? (
        <button type="button" className="app-walk-saved" onClick={onMap}>
          <span>На карте</span>
          <ActionIcon name="pin" size={18} />
        </button>
      ) : null}
    </section>
  );
}

function markStop(walk: CityWalk, order: number, done: boolean): CityWalk {
  return { ...walk, stops: walk.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)) };
}

export function WalkListPage({ list = defaultListCityWalks }: { readonly list?: () => Promise<readonly CityWalk[]> }) {
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

export function SavedWalkPage({ id, load = defaultLoadCityWalk, setDone = defaultSetCityWalkStopDone }: { readonly id: string; readonly load?: (id: string) => Promise<CityWalk>; readonly setDone?: (id: string, order: number, done: boolean) => Promise<CityWalk> }) {
  const { back, navigate } = useRoute();
  const [walk, setWalk] = useState<CityWalk | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    setMissing(false);
    setError(null);
    setWalk(null);
    load(id)
      .then((row) => {
        if (live.current) setWalk(row);
      })
      .catch((err: unknown) => {
        if (!live.current) return;
        if (err instanceof ApiError && err.status === 404) {
          setMissing(true);
        } else {
          setError(err instanceof Error ? err.message : "Не удалось открыть прогулку.");
        }
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
        <WalkBack onBack={back} />
        <header className="app-walk-head">
          <p className="app-walk-kicker">Сохранённая</p>
          <h1 className="app-walk-title">Маршрут</h1>
        </header>
        <p className="app-walk-note">Прогулка не найдена.</p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="app-walk">
        <WalkBack onBack={back} />
        <header className="app-walk-head">
          <p className="app-walk-kicker">Ошибка</p>
          <h1 className="app-walk-title">Не удалось открыть прогулку</h1>
        </header>
        <p className="app-walk-note">{error}</p>
      </section>
    );
  }

  if (walk === null) {
    return (
      <section className="app-walk">
        <WalkBack onBack={back} />
        <header className="app-walk-head">
          <p className="app-walk-kicker">Сохранённая</p>
          <h1 className="app-walk-title">Открываем прогулку...</h1>
        </header>
        <p className="app-walk-note">Загружаем сохранённый маршрут.</p>
      </section>
    );
  }

  return <SavedWalkView walk={walk} onBack={back} onToggle={(order, done) => void onToggle(order, done)} onMap={() => navigate({ name: "map", walkId: id })} onPlace={(placeId) => navigate({ name: "place", id: placeId })} />;
}
