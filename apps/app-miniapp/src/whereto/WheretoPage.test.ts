import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WheretoBudgetSchema, WheretoCompanySchema, WheretoMoodSchema } from "@max-events/api-contracts";
import { BUDGET_LABELS, COMPANY_LABELS, MOOD_HINTS, MOOD_LABELS, WHERETO_QUESTIONS, WheretoView, answeredRows, formatWheretoPrice, formatWheretoWhen, restLabel, resultTitle, wheretoQuery, wizardStepIndex, type WheretoAnswers, type WheretoResult, type WheretoState } from "./WheretoPage";
import { MOCK_NOW, wheretoSuggestions } from "../api/mock";

const NOW = MOCK_NOW;

const answers = (over: Partial<WheretoAnswers> = {}): WheretoAnswers => ({ company: null, mood: null, budget: null, ...over });

const picks = wheretoSuggestions({ company: "friends", mood: "calm", budget: "under_3000" }).items;

const noop = () => {};

function viewHtml(state: WheretoState, over: { answers?: WheretoAnswers; result?: WheretoResult } = {}): string {
  return renderToStaticMarkup(
    createElement(WheretoView, {
      state,
      answers: over.answers ?? answers(),
      result: over.result ?? { status: "ready", items: [] },
      now: NOW,
      onPick: noop,
      onStep: noop,
      onNext: noop,
      onBack: noop,
      onRestart: noop,
      onRetry: noop,
      onOpenEvent: noop,
    }),
  );
}

describe("закрытые наборы ответов", () => {
  it("покрывают каждое значение контракта ровно один раз", () => {
    expect(Object.keys(COMPANY_LABELS).sort()).toEqual([...WheretoCompanySchema.options].sort());
    expect(Object.keys(MOOD_LABELS).sort()).toEqual([...WheretoMoodSchema.options].sort());
    expect(Object.keys(MOOD_HINTS).sort()).toEqual([...WheretoMoodSchema.options].sort());
    expect(Object.keys(BUDGET_LABELS).sort()).toEqual([...WheretoBudgetSchema.options].sort());
  });

  it("описывают ровно три вопроса", () => {
    expect(WHERETO_QUESTIONS).toHaveLength(3);
  });
});

describe("wheretoQuery", () => {
  it("собирает запрос только из трёх полных ответов", () => {
    expect(wheretoQuery(answers({ company: "friends", mood: "calm" }))).toBeNull();
    expect(wheretoQuery(answers({ company: "friends", mood: "calm", budget: "under_3000" }))).toEqual({ company: "friends", mood: "calm", budget: "under_3000" });
  });
});

describe("answeredRows", () => {
  it("показывает только вопросы выше открытого", () => {
    const filled = answers({ company: "friends", mood: "calm", budget: "any" });

    expect(answeredRows(filled, 0)).toEqual([]);
    expect(answeredRows(filled, 1)).toEqual([{ at: 0, label: "С кем идёте", value: "С друзьями" }]);
    expect(answeredRows(filled, 2).map((row) => row.value)).toEqual(["С друзьями", "Спокойно"]);
  });

  it("пропускает вопрос, который ещё не отвечен", () => {
    expect(answeredRows(answers({ mood: "calm" }), 2)).toEqual([{ at: 1, label: "Настроение", value: "Спокойно" }]);
  });
});

describe("wizardStepIndex", () => {
  it("ставит выдачу за последним вопросом", () => {
    expect(wizardStepIndex({ step: "ask", at: 0 })).toBe(0);
    expect(wizardStepIndex({ step: "ask", at: 2 })).toBe(2);
    expect(wizardStepIndex({ step: "result", query: { company: "alone", mood: "calm", budget: "any" } })).toBe(3);
  });
});

describe("resultTitle", () => {
  it("пишет число словом, как макет", () => {
    expect(resultTitle(5)).toBe("Пять вариантов");
    expect(resultTitle(2)).toBe("Два варианта");
    expect(resultTitle(1)).toBe("Один вариант");
  });

  it("пустую выдачу называет состоянием, а не нулём", () => {
    expect(resultTitle(0)).toBe("Подборка пуста");
  });
});

describe("restLabel", () => {
  it("считает остаток под героем", () => {
    expect(restLabel(4)).toBe("Ещё четыре под те же ответы");
    expect(restLabel(1)).toBe("Ещё один под те же ответы");
  });
});

describe("formatWheretoWhen", () => {
  it("различает сегодня, завтра и дальнюю дату", () => {
    expect(formatWheretoWhen("2026-09-12T19:00:00+03:00", NOW)).toBe("Сегодня 19:00");
    expect(formatWheretoWhen("2026-09-13T21:00:00+03:00", NOW)).toBe("Завтра 21:00");
    expect(formatWheretoWhen("2026-09-19T12:00:00+03:00", NOW)).toContain("19 сентября");
  });
});

describe("formatWheretoPrice", () => {
  it("платное печатает ценой, бесплатное — словом", () => {
    // Разряды по-русски разделяет неразрывный пробел — именно он и обязан доехать до карточки
    expect(formatWheretoPrice({ isPaid: true, priceRub: 1500 })).toBe("1 500 ₽");
    expect(formatWheretoPrice({ isPaid: false, priceRub: null })).toBe("бесплатно");
  });

  it("платное без цены не выдаёт за бесплатное", () => {
    expect(formatWheretoPrice({ isPaid: true, priceRub: null })).toBe("платно");
  });
});

describe("WheretoView: вопросы (экран 11)", () => {
  it("рисует первый вопрос без сводки и без кнопки назад к шагу", () => {
    const html = viewHtml({ step: "ask", at: 0 });

    expect(html).toContain("Куда пойдём?");
    expect(html).toContain("1 из 3");
    expect(html).toContain("С кем идёте?");
    for (const label of Object.values(COMPANY_LABELS)) expect(html).toContain(label);
    expect(html).not.toContain("Изменить");
    expect(html).toContain("Настроение — следующий вопрос");
  });

  it("на втором вопросе показывает ответ первого и подсказки настроений", () => {
    const html = viewHtml({ step: "ask", at: 1 }, { answers: answers({ company: "friends" }) });

    expect(html).toContain("2 из 3");
    expect(html).toContain("С кем идёте");
    expect(html).toContain("С друзьями");
    expect(html).toContain("Изменить");
    expect(html).toContain("Какое настроение?");
    for (const hint of Object.values(MOOD_HINTS)) expect(html).toContain(hint);
    expect(html).toContain("Бюджет — следующий вопрос");
  });

  it("не обещает персонализации", () => {
    const html = viewHtml({ step: "ask", at: 1 }, { answers: answers({ company: "friends" }) });

    expect(html).toContain("Подбор работает по правилам");
    expect(html).toContain("Вкусы и история посещений не учитываются");
  });

  it("держит «Дальше» выключенной, пока ответа нет", () => {
    const empty = viewHtml({ step: "ask", at: 0 });
    const chosen = viewHtml({ step: "ask", at: 0 }, { answers: answers({ company: "alone" }) });

    expect(empty).toContain("disabled");
    expect(chosen).not.toContain("disabled");
    expect(chosen).toContain('aria-checked="true"');
  });

  it("на последнем вопросе меняет подпись кнопки и снимает предпросмотр", () => {
    const html = viewHtml({ step: "ask", at: 2 }, { answers: answers({ company: "alone", mood: "calm" }) });

    expect(html).toContain("3 из 3");
    expect(html).toContain("Показать варианты");
    expect(html).not.toContain("следующий вопрос");
  });
});

describe("WheretoView: выдача (экран 12)", () => {
  const query = { company: "friends", mood: "calm", budget: "under_3000" } as const;
  const ready: WheretoResult = { status: "ready", items: picks };

  it("выносит первый вариант в герой, остальные — в нумерованный список", () => {
    const html = viewHtml({ step: "result", query }, { result: ready });

    expect(picks).toHaveLength(5);
    expect(html).toContain("Пять вариантов");
    expect(html).toContain(picks[0].title);
    expect(html).toContain(restLabel(4));
    for (const pick of picks.slice(1)) expect(html).toContain(pick.title);
    expect(html).toContain("app-wt-hero");
  });

  it("повторяет ответы чипами и даёт начать заново", () => {
    const html = viewHtml({ step: "result", query }, { result: ready });

    expect(html).toContain("С друзьями");
    expect(html).toContain("Спокойно");
    expect(html).toContain("До 3000 ₽");
    expect(html).toContain("Ответить заново");
  });

  it("печатает на герое расстояние и цену", () => {
    const hero = { ...picks[0], distanceKm: 1.2, isPaid: true, priceRub: 800, paymentUrl: "https://tickets.example.com/hero" };
    const html = viewHtml({ step: "result", query }, { result: { status: "ready", items: [hero] } });

    expect(html).toContain("1,2 км");
    expect(html).toContain("800 ₽");
  });

  it("на пустой выдаче предлагает изменить бюджет или ответить заново", () => {
    const html = viewHtml({ step: "result", query }, { result: { status: "ready", items: [] } });

    expect(html).toContain("Подборка пуста");
    expect(html).toContain("Под такие ответы ничего нет");
    expect(html).toContain("Изменить бюджет");
    expect(html).not.toContain("app-wt-hero");
  });

  it("рисует загрузку и ошибку вместо карточек", () => {
    const loading = viewHtml({ step: "result", query }, { result: { status: "loading" } });
    const failed = viewHtml({ step: "result", query }, { result: { status: "error" } });

    expect(loading).toContain("Загрузка");
    expect(loading).not.toContain("app-wt-row");
    expect(failed).toContain("Не удалось собрать подборку");
    expect(failed).toContain("app-state--error");
  });
});
