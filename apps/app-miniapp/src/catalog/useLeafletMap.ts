// START_MODULE_CONTRACT
// PURPOSE: React-шов к Leaflet: карта создаётся один раз на жизнь экрана, данные в неё втекают обновлениями.
// SCOPE: Жизненный цикл и статус загрузки; что именно рисуется — дело вызывающего, хук знает только про update/dispose. Создание сериализовано: в dev StrictMode монтирует эффект дважды, а второй `L.map` на том же контейнере бросает «Map container is already initialized» — до этой правки карта в дежурном режиме разработки именно так и не открывалась.
// DEPENDS: react
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LeafletHandle - что хук требует от карты: принять новые данные и убраться за собой
// - LeafletBinding - ref на контейнер, ref на карту (null, пока не создана) и статус загрузки
// - useLeafletMap - создать карту один раз, передавать ей input при изменениях, пережить двойной монтаж StrictMode
// END_MODULE_MAP

import { useEffect, useRef, useState, type RefObject } from "react";

export interface LeafletHandle<TInput> {
  update: (input: TInput) => void;
  dispose: () => void;
}

export interface LeafletBinding<THandle> {
  containerRef: RefObject<HTMLDivElement | null>;
  handleRef: RefObject<THandle | null>;
  /** «error» — leaflet не загрузился или упал на инициализации; экран показывает запасное полотно. */
  status: "loading" | "ready" | "error";
}

export function useLeafletMap<TInput, THandle extends LeafletHandle<TInput>>(create: (container: HTMLElement, input: TInput) => Promise<THandle>, input: TInput): LeafletBinding<THandle> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<THandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Свежие create/input нужны внутри эффекта создания, но зависимостями быть не могут: от них
  // карта пересоздавалась бы на каждый ввод в поиске, теряя зум и сдвиг.
  const createRef = useRef(create);
  createRef.current = create;
  const inputRef = useRef(input);
  inputRef.current = input;
  // Очередь создания: второй монтаж ждёт, пока первый договорит, и только потом берёт контейнер.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let disposed = false;
    queueRef.current = queueRef.current
      .catch(() => {})
      .then(async () => {
        // Размонтировались, пока стояли в очереди: карту незачем и создавать.
        if (disposed) return;
        const handle = await createRef.current(container, inputRef.current);
        if (disposed) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  // Статус в зависимостях не лишний: первый input приезжает вместе с картой, и без него
  // обновление, пришедшее до готовности, было бы потеряно.
  useEffect(() => {
    handleRef.current?.update(input);
  }, [input, status]);

  return { containerRef, handleRef, status };
}
