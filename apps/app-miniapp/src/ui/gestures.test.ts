// Чистое ядро жестов: разыграть pointer-события в vitest нечем (окружение node, jsdom нет), поэтому
// проверяется ровно то, что решает исход жеста, — спор с прокруткой, пороги и затухание у края.
// Сами обработчики useSwipe проверяются в браузере.

import { describe, expect, it } from "vitest";
import { SWIPE_AXIS_RATIO, SWIPE_DISTANCE_PX, SWIPE_SLOP_PX, SWIPE_VELOCITY_PX_MS, claimGesture, dampOffset, gestureCross, gestureOffset, gestureVelocity, passesSwipeThreshold, resolveSwipe } from "./gestures";

const sample = (dx: number, dy: number, elapsedMs = 300) => ({ dx, dy, elapsedMs });

describe("оси жеста", () => {
  it("читает смещение вдоль оси и поперёк неё", () => {
    expect(gestureOffset(sample(30, -8), "x")).toBe(30);
    expect(gestureCross(sample(30, -8), "x")).toBe(-8);
    expect(gestureOffset(sample(30, -8), "y")).toBe(-8);
    expect(gestureCross(sample(30, -8), "y")).toBe(30);
  });
});

describe("спор жеста с прокруткой", () => {
  it("молчит, пока палец не вышел за слоп: на первых пикселях направления ещё не видно", () => {
    expect(claimGesture(sample(0, 0), "x")).toBe("pending");
    expect(claimGesture(sample(SWIPE_SLOP_PX - 1, 0), "x")).toBe("pending");
    expect(claimGesture(sample(0, SWIPE_SLOP_PX - 1), "x")).toBe("pending");
    expect(claimGesture(sample(SWIPE_SLOP_PX, 0), "x")).toBe("gesture");
  });

  it("отдаёт палец прокрутке, как только поперечное движение сравнялось с движением по оси", () => {
    expect(claimGesture(sample(40, 4), "x")).toBe("gesture");
    expect(claimGesture(sample(40, 40), "x")).toBe("scroll");
    expect(claimGesture(sample(4, 40), "x")).toBe("scroll");
    // Ровно на перевесе оси — ещё прокрутка: спорная диагональ достаётся ей, а не жесту.
    expect(claimGesture(sample(40, 40 / SWIPE_AXIS_RATIO), "x")).toBe("scroll");
  });

  it("на вертикальной оси судит зеркально, поэтому шторку можно смахивать вниз", () => {
    expect(claimGesture(sample(4, 40), "y")).toBe("gesture");
    expect(claimGesture(sample(40, 4), "y")).toBe("scroll");
  });

  it("считается только перевес, а не сами величины: медленное движение по оси остаётся жестом", () => {
    expect(claimGesture(sample(12, 0), "x")).toBe("gesture");
    expect(claimGesture(sample(300, 0), "x")).toBe("gesture");
  });
});

describe("пороги расстояния и скорости", () => {
  it("делит расстояние на время и не делит на ноль", () => {
    expect(gestureVelocity(60, 200)).toBeCloseTo(0.3);
    expect(gestureVelocity(-60, 200)).toBeCloseTo(0.3);
    expect(gestureVelocity(60, 0)).toBe(60);
  });

  it("засчитывает длинное медленное движение", () => {
    expect(passesSwipeThreshold(SWIPE_DISTANCE_PX, 2000)).toBe(true);
    expect(passesSwipeThreshold(-SWIPE_DISTANCE_PX, 2000)).toBe(true);
    expect(passesSwipeThreshold(SWIPE_DISTANCE_PX - 1, 2000)).toBe(false);
  });

  it("засчитывает быстрый короткий флик", () => {
    const flick = SWIPE_DISTANCE_PX / 2;

    expect(passesSwipeThreshold(flick, flick / SWIPE_VELOCITY_PX_MS)).toBe(true);
    expect(passesSwipeThreshold(flick, 1000)).toBe(false);
  });

  it("держит слоп полом и для скорости: дрожание за пару миллисекунд не проходит по флику", () => {
    expect(passesSwipeThreshold(SWIPE_SLOP_PX - 1, 1)).toBe(false);
    expect(passesSwipeThreshold(SWIPE_SLOP_PX, 1)).toBe(true);
  });

  it("слушается своих порогов, когда экран просит другие", () => {
    expect(passesSwipeThreshold(96, 2000, { distancePx: 120 })).toBe(false);
    expect(passesSwipeThreshold(96, 2000, { distancePx: 96 })).toBe(true);
  });
});

describe("разбор жеста целиком", () => {
  it("называет направление по оси", () => {
    expect(resolveSwipe(sample(120, 0), "x")).toBe("right");
    expect(resolveSwipe(sample(-120, 0), "x")).toBe("left");
    expect(resolveSwipe(sample(0, 120), "y")).toBe("down");
    expect(resolveSwipe(sample(0, -120), "y")).toBe("up");
  });

  it("не отвечает ничем, когда палец вёл прокрутку или не дотянул", () => {
    expect(resolveSwipe(sample(120, 120), "x")).toBeNull();
    expect(resolveSwipe(sample(20, 0, 2000), "x")).toBeNull();
    expect(resolveSwipe(sample(0, 0), "x")).toBeNull();
  });

  it("пропускает флик, который по расстоянию бы не прошёл", () => {
    expect(resolveSwipe(sample(30, 2, 2000), "x")).toBeNull();
    expect(resolveSwipe(sample(30, 2, 40), "x")).toBe("right");
  });
});

describe("затухание у края", () => {
  it("поддаётся пальцу, но не переходит предел", () => {
    expect(dampOffset(0, 40)).toBe(0);
    expect(dampOffset(40, 40)).toBe(20);
    expect(dampOffset(-40, 40)).toBe(-20);
    expect(Math.abs(dampOffset(4000, 40))).toBeLessThan(40);
    expect(dampOffset(4000, 40)).toBeGreaterThan(dampOffset(400, 40));
  });

  it("без предела не двигает вовсе, вместо того чтобы делить на ноль", () => {
    expect(dampOffset(100, 0)).toBe(0);
    expect(dampOffset(100, -10)).toBe(0);
  });
});
