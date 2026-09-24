// Сверка имён классов `app-*` в разметке с правилами theme.css — в обе стороны.
//
// Класс без парного правила проходит все шесть проверок сборки разом: типы сходятся, тесты зелёные,
// eslint молчит, prettier доволен, сборка успешна, — а экран рисуется без элемента или без его
// отличия. За волну 9 так пропали шкала занятости микро-события и выравнивание числа в клетке
// календаря; оба нашлись только глазами в браузере. Здесь этот класс ошибок ловится статически.
//
// Модификаторы, собранные из выражения (`app-we-photo--${index}`), статически не известны: прямая
// проверка их не видит, обратная считает правило живым по началу имени.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Классы, у которых правила нет намеренно.
 *
 * `app-btn--ghost` — призрачный тон рисуется свойством ionic (`fill="clear"` в TONE_PROPS), а не CSS,
 * поэтому парного правила у него и не должно быть.
 */
const STYLED_ELSEWHERE = new Set(["app-btn--ghost"]);

/**
 * Модификаторы, доставшиеся от волн переноса дизайна: база стилизована, модификатор — нет, поэтому
 * элемент рисуется, но без своего отличия. Ни один не ловится typecheck, тестами, eslint, prettier и
 * сборкой одновременно — ровно поэтому и появился этот тест. Список закрывается по #531, новых записей
 * в нём быть не должно: добавили класс — добавьте правило.
 */
const KNOWN_UNPAIRED = new Set(["app-feed-chip--live", "app-feed-post--place", "app-onboarding--intro", "app-poll-voter--more", "app-post-compose-row--event", "app-review-category-label", "app-swipe-action--gather", "app-swipe-action--undo"]);

function screenFiles(dir: string, extension: ".tsx" | ".ts" | "" = ".tsx"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(full, extension);
    if (!entry.isFile()) return [];
    const wanted = extension === "" ? entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") : entry.name.endsWith(extension);
    return wanted ? [full] : [];
  });
}

/**
 * Любое упоминание имени класса в исходниках — для обратной проверки этого достаточно и надёжнее
 * разбора `className`: имя может собираться тернарником, приходить из хелпера вроде `appButtonClass`
 * или лежать в таблице. Правило считается мёртвым, только если имени нет в коде вообще.
 */
function mentionedNames(): Set<string> {
  const names = new Set<string>();
  for (const file of screenFiles(SRC, "")) {
    if (file.endsWith("theme.classes.test.ts")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(/\bapp-[A-Za-z0-9_-]+/g)) names.add(match[0]);
  }
  return names;
}

/**
 * Имена классов из литералов `className`. Подстановки `${...}` вырезаются, а не разбираются: класс,
 * собранный из выражения, статически не известен, и притворяться, что известен, хуже, чем пропустить.
 */
function usedClasses(): Map<string, string> {
  const owners = new Map<string, string>();
  for (const file of screenFiles(SRC)) {
    if (file.endsWith(".test.tsx")) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
      const literal = (match[1] ?? match[2] ?? match[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
      for (const token of literal.split(/\s+/)) {
        // Хвост вида `app-we-photo--`, оставшийся от вырезанной подстановки, — это не имя класса.
        if (token.startsWith("app-") && !token.endsWith("-") && !owners.has(token)) owners.set(token, file);
      }
    }
  }
  return owners;
}

/**
 * Правила, оставшиеся от экранов, которые волны переноса дизайна переписали целиком: разметки под них
 * больше нет. Держатся в списке до отдельной уборки — снимать их посреди сведения веток нельзя, потому
 * что сборка `theme.css` из базы и хвостов требует, чтобы база не менялась.
 */
const DEAD_RULES: string[] = ["app-friends-group", "app-friends-join", "app-friends-name", "app-friends-person", "app-home-ctas", "app-list-actions", "app-list-row", "app-mycity", "app-mycity-summary", "app-participation-select", "app-participation-summary", "app-profile", "app-profile-cell", "app-profile-cell-photo", "app-profile-city", "app-profile-grid", "app-profile-header", "app-profile-interest", "app-profile-interests", "app-profile-stat", "app-profile-stat-label", "app-profile-stat-value", "app-profile-stats", "app-profile-topbar", "app-profile-topbar-action", "app-profile-topbar-name", "app-promo-code", "app-vote-badge", "app-vote-hint", "app-vote-option", "app-vote-option--winner", "app-vote-options", "app-vote-title", "app-whereto-cta"];

function styledClasses(): Set<string> {
  const css = readFileSync(join(SRC, "ui", "theme.css"), "utf8");
  return new Set([...css.matchAll(/\.(app-[A-Za-z0-9_-]+)/g)].map((match) => match[1]!));
}

describe("имена классов и правила theme.css", () => {
  const used = usedClasses();
  const styled = styledClasses();

  // Дефект, который проходит все шесть проверок волны: класс в разметке есть, правила нет, экран
  // рисуется без элемента или без его отличия. Так на экране 25 пропала шкала занятости, а на 22 —
  // выравнивание числа в клетке календаря: оба нашлись только в браузере.
  it("не оставляет класс в разметке без парного правила", () => {
    const unpaired = [...used.keys()].filter((name) => !styled.has(name) && !STYLED_ELSEWHERE.has(name) && !KNOWN_UNPAIRED.has(name)).sort();

    expect(unpaired.map((name) => `${name} (${used.get(name)})`)).toEqual([]);
  });

  it("держит список известных непарных классов закрытым: починили — уберите из списка", () => {
    const stillUnpaired = [...KNOWN_UNPAIRED].filter((name) => !styled.has(name) && used.has(name));

    expect(stillUnpaired.sort()).toEqual([...KNOWN_UNPAIRED].sort());
  });

  // Обратная сторона той же ошибки: правило переименовали, разметку нет. Мёртвое правило само по себе
  // безвредно, но обычно означает, что рядом есть элемент, потерявший оформление.
  it("не копит правил, которых никто не носит", () => {
    const mentioned = mentionedNames();
    // Имя, собранное из выражения (`app-we-photo--${index}`), встречается в коде огрызком-основой,
    // поэтому правило живо, если хоть какое-то упоминание является его началом.
    const orphaned = [...styled].filter((name) => ![...mentioned].some((token) => name.startsWith(token))).sort();

    expect(orphaned).toEqual(DEAD_RULES);
  });
});
