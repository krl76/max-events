import { useEffect, useRef, useState } from "react";
import type { CityWalk } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { ApiError } from "../api/endpoints/transport";
import { pluralRu } from "../catalog/format";
import { announceShare, getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { useRoute } from "../routing/router";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { ActionIcon } from "../ui/icons";
import { AppChip } from "../ui/primitives";
import { WalkStopMedia, walkShareText, walkStopBlurb } from "./WalkResult";

function defaultListCityWalks(): Promise<CityWalk[]> {
  return apiClient.listCityWalks();
}

function defaultLoadCityWalk(id: string): Promise<CityWalk> {
  return apiClient.getCityWalk(id);
}

function defaultSetCityWalkStopDone(id: string, order: number, done: boolean): Promise<CityWalk> {
  return apiClient.setCityWalkStopDone(id, order, done);
}

function defaultDeleteCityWalk(id: string): Promise<void> {
  return apiClient.deleteCityWalk(id);
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

export function SavedWalkList({ walks, onOpen, onDelete }: { readonly walks: readonly CityWalk[]; readonly onOpen: (id: string) => void; readonly onDelete?: (id: string) => void }) {
  const rows = sortWalksNewest(walks);
  return (
    <section className="app-walk">
      <header className="app-walk-head">
        <h1 className="app-walk-title">Мои прогулки</h1>
      </header>
      {rows.length === 0 ? (
        <div className="app-walk-empty">
          <p className="app-walk-empty-title">Пока пусто</p>
          <p className="app-walk-note">Сохранённых прогулок пока нет.</p>
        </div>
      ) : (
        <ol className="app-walk-saved-list">
          {rows.map((walk) => (
            <li key={walk.id} className="app-walk-saved-item">
              <button type="button" className="app-walk-saved" onClick={() => onOpen(walk.id)}>
                <span className="app-walk-saved-copy">
                  <strong>{walk.city}</strong>
                  <span className="app-walk-meta">
                    {walkCreatedLabel(walk.createdAt)} · {stopCountLabel(walk.stops.length)}
                  </span>
                </span>
                <ActionIcon name="chevron" size={18} />
              </button>
              {onDelete !== undefined ? (
                <button type="button" className="app-walk-saved-delete" aria-label="Удалить прогулку" onClick={() => onDelete(walk.id)}>
                  <ActionIcon name="trash" size={18} />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SavedWalkView({ walk, onToggle, onMap, onPlace, onShare, onDelete }: { readonly walk: CityWalk; readonly onToggle: (order: number, done: boolean) => void; readonly onMap?: () => void; readonly onPlace?: (id: string) => void; readonly onShare?: () => void; readonly onDelete?: () => void }) {
  return (
    <section className="app-walk">
      <header className="app-walk-head">
        <h1 className="app-walk-title">{walk.city}</h1>
      </header>
      <ol className="app-walk-stops">
        {walk.stops.map((stop) => {
          const blurb = walkStopBlurb(stop.description);
          return (
            <li key={stop.sourceUrl} className="app-walk-stop app-walk-stop--card">
              <div className="app-walk-stop-body">
                <span className="app-walk-num">{stop.order}</span>
                {stop.placeId !== null && onPlace !== undefined ? (
                  <button type="button" className="app-walk-place" onClick={() => onPlace(stop.placeId!)}>
                    {stop.title}
                  </button>
                ) : (
                  <h3>{stop.title}</h3>
                )}
                {stop.address ? <p className="app-walk-meta">{stop.address}</p> : null}
                {blurb !== null ? <p className="app-walk-note">{blurb}</p> : null}
                <AppChip pressed={stop.done} onClick={() => onToggle(stop.order, !stop.done)}>
                  Пройдено
                </AppChip>
              </div>
              <WalkStopMedia stop={stop} />
            </li>
          );
        })}
      </ol>
      {onMap !== undefined || onShare !== undefined || onDelete !== undefined ? (
        <div className="app-walk-dock">
          {onMap !== undefined ? (
            <button type="button" className="app-walk-saved" onClick={onMap}>
              <span>Маршрут</span>
              <ActionIcon name="pin" size={18} />
            </button>
          ) : null}
          {onShare !== undefined ? (
            <button type="button" className="app-walk-saved" onClick={onShare}>
              <span>Отправить в MAX</span>
              <ActionIcon name="share" size={18} />
            </button>
          ) : null}
          {onDelete !== undefined ? (
            <button type="button" className="app-walk-saved" onClick={onDelete}>
              <span>Удалить</span>
              <ActionIcon name="trash" size={18} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function markStop(walk: CityWalk, order: number, done: boolean): CityWalk {
  return { ...walk, stops: walk.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)) };
}

export function WalkListPage({ list = defaultListCityWalks, remove = defaultDeleteCityWalk }: { readonly list?: () => Promise<readonly CityWalk[]>; readonly remove?: (id: string) => Promise<void> }) {
  const { navigate } = useRoute();
  const [walks, setWalks] = useState<readonly CityWalk[]>([]);
  const [failed, setFailed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  async function confirmDelete(): Promise<void> {
    if (pendingId === null) return;
    const id = pendingId;
    setPendingId(null);
    try {
      await remove(id);
      setWalks((rows) => rows.filter((walk) => walk.id !== id));
      setDeleteError(null);
    } catch {
      setDeleteError("Не удалось удалить прогулку.");
    }
  }

  return (
    <>
      {failed ? <p className="app-walk-note">Не удалось открыть прогулки.</p> : null}
      {deleteError !== null ? <p className="app-walk-note">{deleteError}</p> : null}
      <SavedWalkList walks={walks} onOpen={(id) => navigate({ name: "walk-saved", id })} onDelete={setPendingId} />
      {pendingId !== null ? <ConfirmSheet title="Удалить прогулку?" confirmLabel="Удалить" onConfirm={() => void confirmDelete()} onClose={() => setPendingId(null)} /> : null}
    </>
  );
}

export function SavedWalkPage({ id, load = defaultLoadCityWalk, setDone = defaultSetCityWalkStopDone, remove = defaultDeleteCityWalk }: { readonly id: string; readonly load?: (id: string) => Promise<CityWalk>; readonly setDone?: (id: string, order: number, done: boolean) => Promise<CityWalk>; readonly remove?: (id: string) => Promise<void> }) {
  const { navigate } = useRoute();
  const [walk, setWalk] = useState<CityWalk | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  async function confirmDelete(): Promise<void> {
    setConfirmingDelete(false);
    try {
      await remove(id);
      if (live.current) navigate({ name: "walks" });
    } catch {
      if (live.current) setDeleteError("Не удалось удалить прогулку.");
    }
  }

  if (missing) {
    return (
      <section className="app-walk">
        <header className="app-walk-head">
          <h1 className="app-walk-title">Маршрут</h1>
        </header>
        <div className="app-walk-empty">
          <p className="app-walk-note">Прогулка не найдена.</p>
        </div>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="app-walk">
        <header className="app-walk-head">
          <h1 className="app-walk-title">Не удалось открыть прогулку</h1>
        </header>
        <div className="app-walk-empty">
          <p className="app-walk-note">{error}</p>
        </div>
      </section>
    );
  }

  if (walk === null) {
    return (
      <section className="app-walk">
        <header className="app-walk-head">
          <h1 className="app-walk-title">Открываем прогулку...</h1>
        </header>
        <div className="app-walk-empty">
          <p className="app-walk-note">Загружаем сохранённый маршрут.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {deleteError !== null ? <p className="app-walk-note">{deleteError}</p> : null}
      <SavedWalkView
        walk={walk}
        onToggle={(order, done) => void onToggle(order, done)}
        onMap={() => navigate({ name: "map", walkId: id })}
        onPlace={(placeId) => navigate({ name: "place", id: placeId })}
        onShare={() => {
          const payload = sharePayload(walkShareText(walk), `walk-${walk.id}`);
          void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
        }}
        onDelete={() => setConfirmingDelete(true)}
      />
      {confirmingDelete ? <ConfirmSheet title="Удалить прогулку?" confirmLabel="Удалить" onConfirm={() => void confirmDelete()} onClose={() => setConfirmingDelete(false)} /> : null}
    </>
  );
}
