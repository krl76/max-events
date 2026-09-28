import { useEffect, useState } from "react";
import { apiClient, type OrganizerEvent } from "../api/client";
import { AppState } from "../ui/primitives";

export function OrganizerFinance() {
  const [events, setEvents] = useState<OrganizerEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerEvents().then(
      (items) => {
        if (alive) setEvents(items.filter((item) => item.isPaid && !item.draft));
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="app-gathering" aria-label="Финансы">
      <h1 className="app-section-title">Финансы</h1>
      <article className="app-set-group">
        <p className="app-set-row-title">Оплата проходит на внешнем сайте</p>
        <p className="app-set-row-hint">Данные о поступлениях и выплатах в MAX Афишу не передаются. Переход по ссылке оплаты не считается покупкой, поэтому выручки «0 ₽» здесь нет. Переходы к покупке не считаются — для них нет данных.</p>
      </article>
      {failed && <AppState error>Не удалось загрузить события с внешней оплатой.</AppState>}
      {events !== null && events.length === 0 && <p className="app-gathering-hint">Платных событий с ссылкой на оплату пока нет. Бесплатные события в этот раздел не попадают.</p>}
      {events?.map((item) => (
        <article key={item.id} className="app-set-group">
          <p className="app-set-row-title">{item.title}</p>
          <p className="app-set-row-hint">{item.priceRub === null ? "Цена на стороне организатора" : `${item.priceRub} ₽ на стороне организатора`}</p>
          {item.paymentUrl !== null && (
            <a className="app-org-head-link" href={item.paymentUrl} target="_blank" rel="noreferrer">
              Открыть сервис продажи
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
