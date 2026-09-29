import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Posts inserted by 20260928180000 talked about taking the photo.
 * Databases that already ran that migration keep those sentences until this update.
 * A database that inserts the revised sentences does not match the old text, so this is a no-op there.
 */
const CAPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["Встретились у арки Парка Горького и сразу снялись. Йога началась через десять минут.", "Утренняя йога у арки Парка Горького. Собрались на лужайке сразу за воротами."],
  ["Экскурсия по Царицыну. Я у пруда, дворец за спиной — так и хотела снять.", "Экскурсия по Царицыну. Гуляли у пруда, Большой дворец напротив."],
  ["Джаз в Нескучном саду. Трио играло у столиков, я сняла их почти в упор.", "Джаз в Нескучном саду. Трио играло у столиков, без сцены."],
  ["Авторская песня в «Циферблате». Гитара на нашем столе, я в кадре с бокалом.", "Авторская песня в «Циферблате». Гитара на столе, зал маленький и тихий."],
  ["После лекции в Третьяковке осталась в зале. Сняла, как стою у большого полотна.", "После лекции остались в зале Третьяковки у большого полотна."],
  ["Пять километров в Сокольниках. Снялся на аллее, ещё не отдышался.", "Пять километров в Сокольниках. На главной аллее ещё не отдышался."],
  ["Субботник в Измайловском парке. Мешок собрали вдвоём и сразу сфотографировались.", "Субботник в Измайловском парке. Мешок собрали вдвоём за час."],
  ["После клуба осталась в «Даблби» на Мясницкой. Кофе у окна, я в кадре.", "Разговорный клуб в «Даблби» на Мясницкой. После занятия остались за кофе у окна."],
  ["В Коломенском дошли по дорожке до деревянного дворца и церкви. Сняла именно этот вид.", "В Коломенском дошли по дорожке до деревянного дворца и церкви."],
  ["Ушли от Третьяковки во дворы Замоскворечья. Жёлтый дом с зелёной аркой — мой кадр с прогулки.", "Ушли от Третьяковки во дворы Замоскворечья. Жёлтый дом с зелёной аркой."],
  ["До субботника у арки Парка Горького успели сняться. Площадь перед входом уже наша.", "Субботник у арки Парка Горького. Час на площади перед входом."],
];

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function captionValues(direction: "forward" | "back"): string {
  return CAPTIONS.map(([previous, next]) => {
    const from = direction === "forward" ? previous : next;
    const to = direction === "forward" ? next : previous;
    return `(${sqlText(from)}::varchar, ${sqlText(to)}::varchar)`;
  }).join(",\n");
}

export class PlainDemoPostCaptions20260928200000 implements MigrationInterface {
  name = "PlainDemoPostCaptions20260928200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "feed_posts" AS fp
      SET "text" = v.next
      FROM (VALUES
        ${captionValues("forward")}
      ) AS v(prev, next)
      WHERE fp."text" = v.prev
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "feed_posts" AS fp
      SET "text" = v.next
      FROM (VALUES
        ${captionValues("back")}
      ) AS v(prev, next)
      WHERE fp."text" = v.prev
    `);
  }
}
