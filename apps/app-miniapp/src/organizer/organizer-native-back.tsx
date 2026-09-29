// START_MODULE_CONTRACT
// PURPOSE: One owner for the MAX client's BackButton inside the organizer cabinet. Screens register a handler; the messenger button shows while any handler is active and runs the most specific one.
// SCOPE: The provider and the registration hook. The cabinet shell, the wizard and the section screens decide when they have somewhere to go back to. The button itself belongs to the MAX client (window.WebApp.BackButton), the same one Layout uses for a visitor.
// DEPENDS: react, ../max/bridge.js (getWebApp)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerNativeBackRoot - binds show/hide/onClick once for the whole cabinet
// - useOrganizerNativeBack - register the screen that should answer the messenger button
// END_MODULE_MAP

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { getWebApp } from "../max/bridge";

/**
 * 0 — выход из кабинета или закрытие композитора, пока поверх него ничего нет.
 * 1 — шаг внутри видимого раздела (мастер, вывод, список).
 * 10 — экран оболочки, который закрыл раздел: спрятанный под ним обработчик не должен съесть нажатие.
 */
export const ORGANIZER_BACK_SECTION = 1;
export const ORGANIZER_BACK_COVER = 10;

interface BackEntry {
  id: string;
  priority: number;
  run: () => void;
}

interface BackApi {
  push: (id: string, priority: number, run: () => void) => void;
  remove: (id: string) => void;
}

const OrganizerNativeBackContext = createContext<BackApi | null>(null);

function topEntry(stack: readonly BackEntry[]): BackEntry | undefined {
  let best: BackEntry | undefined;
  let bestIndex = -1;
  stack.forEach((entry, index) => {
    if (best === undefined || entry.priority > best.priority || (entry.priority === best.priority && index > bestIndex)) {
      best = entry;
      bestIndex = index;
    }
  });
  return best;
}

export function OrganizerNativeBackRoot({ children }: { children: ReactNode }) {
  const stack = useRef<BackEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const api = useMemo<BackApi>(
    () => ({
      push(id, priority, run) {
        stack.current = [...stack.current.filter((entry) => entry.id !== id), { id, priority, run }];
        setVisible(true);
      },
      remove(id) {
        const next = stack.current.filter((entry) => entry.id !== id);
        if (next.length === stack.current.length) return;
        stack.current = next;
        setVisible(next.length > 0);
      },
    }),
    [],
  );

  useEffect(() => {
    const button = getWebApp()?.BackButton;
    if (!button) return;
    const onNativeBack = () => topEntry(stack.current)?.run();
    button.onClick(onNativeBack);
    if (visible) button.show();
    else button.hide();
    return () => {
      button.offClick(onNativeBack);
      button.hide();
    };
  }, [visible]);

  return <OrganizerNativeBackContext.Provider value={api}>{children}</OrganizerNativeBackContext.Provider>;
}

/** `active` — с этого экрана есть куда вернуться. Без провайдера (витрина вне кабинета) хук ничего не вешает. */
export function useOrganizerNativeBack(active: boolean, run: () => void, priority = ORGANIZER_BACK_SECTION): void {
  const api = useContext(OrganizerNativeBackContext);
  const id = useId();
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!api || !active) return;
    api.push(id, priority, () => runRef.current());
    return () => api.remove(id);
  }, [api, active, id, priority]);
}
