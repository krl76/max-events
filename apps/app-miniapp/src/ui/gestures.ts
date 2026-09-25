// START_MODULE_CONTRACT
// PURPOSE: Общий механизм жестов пальцем: чистое решение «это свайп или прокрутка» и pointer-хуки useSwipe / useSwipeDrag поверх него.
// SCOPE: Только распознавание жеста и его обработчики; что жест делает, решает экран. Спор за палец всегда выигрывает прокрутка, а всё, что даёт жест, экран обязан оставить доступным тапом — механизм это не проверяет, но на это рассчитан.
// DEPENDS: react
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SwipeAxis - ось жеста: «x» горизонтальный, «y» вертикальный
// - SwipeDirection - left | right | up | down
// - GestureSample - смещение пальца от точки касания и время с её начала
// - GestureClaim - кто забрал палец: pending пока не решено, gesture жест, scroll прокрутка
// - SWIPE_SLOP_PX - дрожание пальца, ниже которого решения ещё нет
// - SWIPE_DISTANCE_PX - расстояние, после которого жест засчитан без всякой скорости
// - SWIPE_VELOCITY_PX_MS - скорость короткого флика, который засчитан без расстояния
// - SWIPE_AXIS_RATIO - во сколько раз движение вдоль оси жеста должно обгонять поперечное
// - SwipeThresholds - пороги одного жеста: расстояние, скорость, перевес оси, слоп
// - gestureOffset - смещение вдоль оси жеста
// - gestureCross - смещение поперёк оси жеста
// - claimGesture - спор за палец: прокрутка выигрывает, пока жест не обогнал её по осям
// - gestureVelocity - px/мс; интервал меньше миллисекунды читается как миллисекунда
// - passesSwipeThreshold - засчитан ли жест: по расстоянию или по скорости флика
// - resolveSwipe - весь разбор одним вызовом: направление жеста или null
// - dampOffset - затухающее смещение для края, дальше которого жест не ведёт
// - SwipeGestureProps - готовые pointer-обработчики и touch-action, которые элемент разворачивает на себя
// - SwipeGestureOptions - пороги плюс обработчики: состоявшийся жест, живое смещение, отмена
// - useSwipe - хук жеста по оси: распознавание, захват пальца, отмена при прокрутке
// - SwipeDragOptions - useSwipe плюс предел затухания для элементов, тянущихся за пальцем
// - SwipeDrag - что отдаёт useSwipeDrag: смещение, признак возврата и props элемента
// - useSwipeDrag - useSwipe с готовым состоянием: элемент тянется за пальцем и сам едет домой
// END_MODULE_MAP

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type SwipeAxis = "x" | "y";

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface GestureSample {
  dx: number;
  dy: number;
  elapsedMs: number;
}

export type GestureClaim = "pending" | "gesture" | "scroll";

/** Ниже этого палец считается стоящим на месте: тап не должен превращаться в микро-свайп. */
export const SWIPE_SLOP_PX = 10;

/** Примерно шестая часть узкого телефона: столько пройти пальцем осознанно, но не утомительно. */
export const SWIPE_DISTANCE_PX = 56;

/** Быстрый короткий флик — это тоже свайп: 0.45 px/мс это 56px за 125мс. */
export const SWIPE_VELOCITY_PX_MS = 0.45;

/**
 * Главное условие сосуществования с прокруткой: по оси жеста палец должен уйти заметно дальше, чем
 * поперёк. Меньший перевес отбирал бы палец у диагональной прокрутки, больший — требовал бы
 * чертить идеальную горизонталь.
 */
export const SWIPE_AXIS_RATIO = 1.3;

export interface SwipeThresholds {
  distancePx?: number;
  velocityPxMs?: number;
  axisRatio?: number;
  slopPx?: number;
}

export function gestureOffset(sample: GestureSample, axis: SwipeAxis): number {
  return axis === "x" ? sample.dx : sample.dy;
}

export function gestureCross(sample: GestureSample, axis: SwipeAxis): number {
  return axis === "x" ? sample.dy : sample.dx;
}

/**
 * Спор за палец. Пока движение не вышло за слоп, ответа нет — и его нельзя торопить: на первых
 * пикселях направление ещё не видно, а решить рано значит отнять палец у прокрутки.
 */
export function claimGesture(sample: GestureSample, axis: SwipeAxis, thresholds: SwipeThresholds = {}): GestureClaim {
  const slop = thresholds.slopPx ?? SWIPE_SLOP_PX;
  const ratio = thresholds.axisRatio ?? SWIPE_AXIS_RATIO;
  const along = Math.abs(gestureOffset(sample, axis));
  const cross = Math.abs(gestureCross(sample, axis));
  if (Math.max(along, cross) < slop) return "pending";
  return along > cross * ratio ? "gesture" : "scroll";
}

/** Интервал меньше миллисекунды читается как миллисекунда: иначе скорость обращается в бесконечность. */
export function gestureVelocity(distancePx: number, elapsedMs: number): number {
  return Math.abs(distancePx) / Math.max(elapsedMs, 1);
}

/** Два порога, а не один: длинное медленное движение и короткий быстрый флик — оба свайп. */
export function passesSwipeThreshold(distancePx: number, elapsedMs: number, thresholds: SwipeThresholds = {}): boolean {
  const distance = Math.abs(distancePx);
  // Слоп остаётся полом и для скорости: иначе дрожание пальца за пару миллисекунд проходит по флику.
  if (distance < (thresholds.slopPx ?? SWIPE_SLOP_PX)) return false;
  if (distance >= (thresholds.distancePx ?? SWIPE_DISTANCE_PX)) return true;
  return gestureVelocity(distance, elapsedMs) >= (thresholds.velocityPxMs ?? SWIPE_VELOCITY_PX_MS);
}

/** null — жест не состоялся: либо палец вёл прокрутку, либо не дотянул ни по расстоянию, ни по скорости. */
export function resolveSwipe(sample: GestureSample, axis: SwipeAxis, thresholds: SwipeThresholds = {}): SwipeDirection | null {
  if (claimGesture(sample, axis, thresholds) !== "gesture") return null;
  const offset = gestureOffset(sample, axis);
  if (!passesSwipeThreshold(offset, sample.elapsedMs, thresholds)) return null;
  if (axis === "x") return offset > 0 ? "right" : "left";
  return offset > 0 ? "down" : "up";
}

/**
 * Край, дальше которого вести некуда: смещение идёт всё туже и никогда не переходит limitPx.
 * Палец получает ответ движением — но ответ честный, «дальше ничего нет».
 */
export function dampOffset(offset: number, limitPx: number): number {
  if (limitPx <= 0) return 0;
  return offset / (1 + Math.abs(offset) / limitPx);
}

export interface SwipeGestureProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  style: { touchAction: "pan-x" | "pan-y" };
}

export interface SwipeGestureOptions extends SwipeThresholds {
  axis?: SwipeAxis;
  /** Жест состоялся. У того же действия обязана оставаться обычная кнопка — жест только ускоряет. */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Живое смещение вдоль оси, пока палец ведёт. Приходит только после того, как жест забрал палец. */
  onOffset?: (offset: number) => void;
  /** Палец отпущен, не дойдя до порога, или жест забрала система: элементу пора домой. */
  onCancel?: () => void;
  disabled?: boolean;
}

interface ActiveGesture {
  pointerId: number;
  x: number;
  y: number;
  startedAt: number;
  claim: GestureClaim;
}

function capturePointer(element: Element, pointerId: number): void {
  if (typeof element.setPointerCapture !== "function") return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Палец мог исчезнуть между move и захватом: жест доживёт и без захвата, падать тут не из-за чего.
  }
}

function releasePointer(element: Element, pointerId: number): void {
  // Захват мог уже уйти вместе с pointercancel; снимать несуществующий — бросок на ровном месте.
  if (typeof element.hasPointerCapture === "function" && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

/**
 * Один жест по одной оси на pointer-событиях: мышь, палец и перо приходят сюда одним потоком.
 *
 * Состояние касания живёт в рефе, а не в state: перерисовка посреди движения не должна ни терять
 * точку старта, ни заново подписывать обработчики. Поэтому и обработчики пересоздаются свободно —
 * держаться не за что.
 */
export function useSwipe(options: SwipeGestureOptions = {}): SwipeGestureProps {
  const axis = options.axis ?? "x";
  const active = useRef<ActiveGesture | null>(null);

  function sampleOf(current: ActiveGesture, event: ReactPointerEvent<HTMLElement>): GestureSample {
    return { dx: event.clientX - current.x, dy: event.clientY - current.y, elapsedMs: Date.now() - current.startedAt };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    // Правая кнопка мыши — не жест; второй палец поверх ведущего — тоже: касание ведёт первое.
    if (options.disabled === true || event.button !== 0 || active.current !== null) return;
    active.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startedAt: Date.now(), claim: "pending" };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const current = active.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const sample = sampleOf(current, event);
    if (current.claim === "pending") {
      const claim = claimGesture(sample, axis, options);
      if (claim === "pending") return;
      if (claim === "scroll") {
        // Спор решается один раз за касание: палец ушёл прокрутке и до отпускания не вернётся.
        active.current = null;
        return;
      }
      current.claim = "gesture";
      capturePointer(event.currentTarget, event.pointerId);
    }
    options.onOffset?.(gestureOffset(sample, axis));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>): void {
    const current = active.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const sample = sampleOf(current, event);
    const owned = current.claim === "gesture";
    releasePointer(event.currentTarget, event.pointerId);
    active.current = null;
    if (!owned) return;
    const direction = resolveSwipe(sample, axis, options);
    if (direction === null) options.onCancel?.();
    else options.onSwipe?.(direction);
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLElement>): void {
    const current = active.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const owned = current.claim === "gesture";
    releasePointer(event.currentTarget, event.pointerId);
    active.current = null;
    if (owned) options.onCancel?.();
  }

  // Ось жеста закрыта для браузера, поперечная остаётся за прокруткой: без этого горизонтальное
  // движение по странице отдаётся системе, и хук видит pointercancel вместо жеста.
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, style: { touchAction: axis === "x" ? "pan-y" : "pan-x" } };
}

export interface SwipeDragOptions extends SwipeGestureOptions {
  /** Предел затухания для края: элемент поддаётся, но не уходит дальше. Без него — точно за пальцем. */
  dampPx?: number;
}

export interface SwipeDrag {
  /** На сколько элемент сдвинут вдоль оси прямо сейчас. */
  offset: number;
  /** Жест отпущен, не дойдя до порога: элемент возвращается, и возврат стоит анимировать. */
  settling: boolean;
  gesture: SwipeGestureProps;
}

/** Тот же жест, но с готовым состоянием: элементу остаётся развернуть props и отдать offset в transform. */
export function useSwipeDrag(options: SwipeDragOptions = {}): SwipeDrag {
  const [drag, setDrag] = useState<{ offset: number; settling: boolean }>({ offset: 0, settling: false });
  const gesture = useSwipe({
    ...options,
    onOffset: (value) => {
      setDrag({ offset: options.dampPx === undefined ? value : dampOffset(value, options.dampPx), settling: false });
      options.onOffset?.(value);
    },
    onSwipe: (direction) => {
      // Жест состоялся — элемент уступает место следующему, и возвращать нечего.
      setDrag({ offset: 0, settling: false });
      options.onSwipe?.(direction);
    },
    onCancel: () => {
      setDrag((current) => ({ offset: 0, settling: current.offset !== 0 }));
      options.onCancel?.();
    },
  });
  return { offset: drag.offset, settling: drag.settling, gesture };
}
