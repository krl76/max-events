import type { EventCategory } from "@max-events/api-contracts";
import type { OrganizerEvent } from "../api/client";

/** «Московское бюро событий» — кабинетный пул: концерты, кино, беседки, стендап, экскурсии и книжные клубы. */
export const CABINET_ORGANIZER_NAME = "Московское бюро событий";

export interface CabinetEvent {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  tags: string[];
  age: string;
  city: string;
  place: string;
  address: string;
  startsAt: string;
  endsAt: string;
  isPaid: boolean;
  priceRub: number | null;
  capacity: number;
  sold: number;
  draft: boolean;
}

const moscow = (day: string, start: string, end: string): { startsAt: string; endsAt: string } => ({
  startsAt: `${day}T${start}:00+03:00`,
  endsAt: `${day}T${end}:00+03:00`,
});

export const CABINET_EVENTS: CabinetEvent[] = [
  { id: "c00000e1-0000-4000-8000-000000000001", title: "Вечер джаза на Патриарших", summary: "Живой джаз у пруда, авторская кухня и напитки.", description: "Погрузитесь в атмосферу живого джаза в самом сердце Москвы. Вечер с лучшими музыкантами и уютной атмосферой.", category: "afisha", tags: ["Музыка", "Джаз", "Концерт"], age: "16+", city: "Москва", place: "Клуб «Ритм»", address: "Патриаршие пруды, 12", ...moscow("2026-10-03", "19:00", "23:00"), isPaid: true, priceRub: 1800, capacity: 80, sold: 64, draft: false },
  { id: "c00000e2-0000-4000-8000-000000000002", title: "Ночной забег по набережной", summary: "10 километров вдоль Москвы-реки с отметкой на финише.", description: "Ночной забег от Парка Горького до Крымского моста. Темп свободный, вода и медали на финише.", category: "sport", tags: ["Спорт", "Забег"], age: "12+", city: "Москва", place: "Парк Горького", address: "Крымский Вал, 9", ...moscow("2026-10-04", "21:00", "23:00"), isPaid: false, priceRub: null, capacity: 200, sold: 112, draft: false },
  { id: "c00000e3-0000-4000-8000-000000000003", title: "Премьера «Анора»", summary: "Первый показ в зале «Иллюзион» с разбором после сеанса.", description: "Премьерный показ и короткая беседа с киноведом. Билет включает место в партере.", category: "afisha", tags: ["Кино", "Премьера"], age: "18+", city: "Москва", place: "Кинотеатр «Иллюзион»", address: "Котельническая наб., 1/15", ...moscow("2026-10-05", "19:30", "22:00"), isPaid: true, priceRub: 650, capacity: 120, sold: 86, draft: false },
  { id: "c00000e4-0000-4000-8000-000000000004", title: "Стендап в Stand Up Club", summary: "Четыре комика и один ведущий, без записи телешоу.", description: "Вечер стендапа: новые тексты, живой зал на Китай-городе. 18+.", category: "afisha", tags: ["Стендап", "Юмор"], age: "18+", city: "Москва", place: "Stand Up Club #1", address: "ул. Покровка, 2/1", ...moscow("2026-10-08", "20:00", "22:00"), isPaid: true, priceRub: 1500, capacity: 90, sold: 71, draft: false },
  { id: "c00000e5-0000-4000-8000-000000000005", title: "Беседка у Голицынских прудов", summary: "Аренда беседки на компанию, мангал и стол уже стоят.", description: "Четыре часа в беседке Парка Горького: мангал, стол на 8 человек, уголь можно купить на входе.", category: "tourism", tags: ["Аренда", "Пикник"], age: "0+", city: "Москва", place: "Парк Горького", address: "Крымский Вал, 9", ...moscow("2026-10-10", "12:00", "16:00"), isPaid: true, priceRub: 3500, capacity: 8, sold: 8, draft: false },
  { id: "c00000e6-0000-4000-8000-000000000006", title: "Экскурсия по Замоскворечью", summary: "Пеший маршрут от Третьяковки к набережной.", description: "Два часа по купеческим дворам и церквям Замоскворечья. Группа до 25 человек.", category: "tourism", tags: ["Экскурсия", "История"], age: "6+", city: "Москва", place: "Третьяковская галерея", address: "Лаврушинский пер., 10", ...moscow("2026-10-11", "12:00", "14:00"), isPaid: true, priceRub: 900, capacity: 25, sold: 18, draft: false },
  { id: "c00000e7-0000-4000-8000-000000000007", title: "Книжный клуб «Подписные»", summary: "Разбираем один роман, чай на столе.", description: "Встреча клуба в магазине «Подписные издания». Книгу месяца называем заранее, вход свободный.", category: "afisha", tags: ["Книги", "Клуб"], age: "12+", city: "Москва", place: "Подписные издания", address: "Потаповский пер., 5", ...moscow("2026-10-12", "18:00", "20:00"), isPaid: false, priceRub: null, capacity: 20, sold: 14, draft: false },
  { id: "c00000e8-0000-4000-8000-000000000008", title: "Концерт в Доме музыки", summary: "Камерный оркестр, программа Рахманинова.", description: "Симфонические фрагменты Рахманинова в Светлановском зале. Антракт 20 минут.", category: "afisha", tags: ["Музыка", "Концерт"], age: "6+", city: "Москва", place: "Дом музыки", address: "Космодамианская наб., 52", ...moscow("2026-10-15", "19:00", "21:15"), isPaid: true, priceRub: 2200, capacity: 400, sold: 286, draft: false },
  { id: "c00000e9-0000-4000-8000-000000000009", title: "Премьера в «Художественном»", summary: "Вечерний сеанс на большой площади экрана.", description: "Премьерный показ в кинотеатре «Художественный». Места нумерованные.", category: "afisha", tags: ["Кино", "Премьера"], age: "16+", city: "Москва", place: "Кинотеатр «Художественный»", address: "Арбатская пл., 14", ...moscow("2026-10-16", "20:00", "22:20"), isPaid: true, priceRub: 750, capacity: 180, sold: 140, draft: false },
  { id: "c00000ea-0000-4000-8000-00000000000a", title: "Беседка в Коломенском", summary: "Мангальная зона у реки на полдня.", description: "Аренда беседки в музее-заповеднике «Коломенское». До 10 гостей, шампуры свои.", category: "tourism", tags: ["Аренда", "Пикник"], age: "0+", city: "Москва", place: "Коломенское", address: "пр-т Андропова, 39", ...moscow("2026-10-17", "11:00", "16:00"), isPaid: true, priceRub: 2800, capacity: 10, sold: 6, draft: false },
  { id: "c00000eb-0000-4000-8000-00000000000b", title: "Стендап на Стрелке", summary: "Открытый микрофон и три приглашённых комика.", description: "Стендап во дворе института «Стрелка». Если дождь — перенос в лекционный зал.", category: "afisha", tags: ["Стендап"], age: "18+", city: "Москва", place: "Институт «Стрелка»", address: "Берсеневская наб., 14", ...moscow("2026-10-18", "19:00", "21:00"), isPaid: true, priceRub: 1200, capacity: 70, sold: 44, draft: false },
  { id: "c00000ec-0000-4000-8000-00000000000c", title: "Экскурсия по ВДНХ", summary: "Павильоны, фонтаны и история выставки.", description: "Пешая экскурсия от арки главного входа до павильона «Космос».", category: "tourism", tags: ["Экскурсия"], age: "6+", city: "Москва", place: "ВДНХ", address: "пр-т Мира, 119", ...moscow("2026-10-19", "11:00", "13:30"), isPaid: true, priceRub: 700, capacity: 30, sold: 22, draft: false },
  { id: "c00000ed-0000-4000-8000-00000000000d", title: "Книжный клуб в «Фаланстере»", summary: "Обсуждаем нон-фикшн месяца.", description: "Свободный вход в книжный «Фаланстер» на Малой Бронной. Чай свой.", category: "afisha", tags: ["Книги", "Клуб"], age: "16+", city: "Москва", place: "Фаланстер", address: "ул. Малая Бронная, 2", ...moscow("2026-10-20", "19:00", "21:00"), isPaid: false, priceRub: null, capacity: 16, sold: 11, draft: false },
  { id: "c00000ee-0000-4000-8000-00000000000e", title: "Кинопоказ в «Пионере»", summary: "Реставрация классики, один сеанс.", description: "Дневной показ отреставрированной копии в кинотеатре «Пионер».", category: "afisha", tags: ["Кино"], age: "12+", city: "Москва", place: "Кинотеатр «Пионер»", address: "Кутузовский пр-т, 21", ...moscow("2026-10-21", "15:00", "17:10"), isPaid: true, priceRub: 500, capacity: 90, sold: 40, draft: false },
  { id: "c00000ef-0000-4000-8000-00000000000f", title: "Концерт в зале «Зарядье»", summary: "Симфонический вечер, дирижёр — гость из Петербурга.", description: "Большой зал «Зарядье». Программа: Чайковский и Стравинский.", category: "afisha", tags: ["Музыка", "Концерт"], age: "6+", city: "Москва", place: "Концертный зал «Зарядье»", address: "ул. Варварка, 6", ...moscow("2026-10-22", "19:00", "21:00"), isPaid: true, priceRub: 2500, capacity: 500, sold: 360, draft: false },
  { id: "c1000001-0000-4000-8000-000000000011", title: "Беседка в Сокольниках", summary: "Мангал, стол и свет до 22:00.", description: "Аренда беседки в парке Сокольники на компанию до 12 человек.", category: "tourism", tags: ["Аренда", "Пикник"], age: "0+", city: "Москва", place: "Парк «Сокольники»", address: "Сокольнический Вал, 1", ...moscow("2026-10-24", "13:00", "18:00"), isPaid: true, priceRub: 2200, capacity: 12, sold: 5, draft: false },
  { id: "c1000001-0000-4000-8000-000000000012", title: "Экскурсия по Китай-городу", summary: "Бесплатная прогулка с волонтёром-гидом.", description: "Маршрут от Лубянской площади до Варварки. Сбор у памятника первопечатникам.", category: "tourism", tags: ["Экскурсия"], age: "6+", city: "Москва", place: "Китай-город", address: "пл. Революции", ...moscow("2026-10-25", "12:00", "14:00"), isPaid: false, priceRub: null, capacity: 25, sold: 9, draft: true },
  { id: "c1000001-0000-4000-8000-000000000013", title: "Клуб «Ритм»", summary: "Черновик джазового вечера, афиша ещё не открыта.", description: "Готовим вечер малого состава. Дата и зал согласованы, текст афиши в работе.", category: "afisha", tags: ["Музыка"], age: "16+", city: "Москва", place: "Клуб «Ритм»", address: "Патриаршие пруды, 12", ...moscow("2026-10-12", "20:00", "23:00"), isPaid: true, priceRub: 1600, capacity: 150, sold: 0, draft: true },
  { id: "c1000001-0000-4000-8000-000000000014", title: "Фестиваль уличной еды", summary: "Черновик: корты и сцена ещё не подтверждены.", description: "Осенний фестиваль еды на набережной. Публикация после подтверждения площадки.", category: "afisha", tags: ["Еда", "Фестиваль"], age: "0+", city: "Москва", place: "Набережная у Парка Горького", address: "Крымский Вал, 2", ...moscow("2026-10-25", "12:00", "20:00"), isPaid: false, priceRub: null, capacity: 300, sold: 0, draft: true },
  { id: "c1000001-0000-4000-8000-000000000015", title: "Джаз в клубе «Эссе»", summary: "Квартет, два сета.", description: "Прошедший вечер: акустический квартет в «Эссе». Зал был полный.", category: "afisha", tags: ["Музыка", "Джаз"], age: "18+", city: "Москва", place: "Клуб «Эссе»", address: "ул. Остоженка, 3/14", ...moscow("2026-09-12", "20:00", "23:00"), isPaid: true, priceRub: 2000, capacity: 60, sold: 60, draft: false },
  { id: "c1000001-0000-4000-8000-000000000016", title: "Премьера в «Октябре»", summary: "Вечерний сеанс на Пречистенке.", description: "Прошедшая премьера в кинотеатре «Октябрь».", category: "afisha", tags: ["Кино", "Премьера"], age: "16+", city: "Москва", place: "Кинотеатр «Октябрь»", address: "ул. Новый Арбат, 24", ...moscow("2026-09-14", "19:00", "21:30"), isPaid: true, priceRub: 800, capacity: 200, sold: 154, draft: false },
  { id: "c1000001-0000-4000-8000-000000000017", title: "Стендап в Stand Up Store", summary: "Сольный концерт приглашённого комика.", description: "Прошедший сольник. Запись зала не велась.", category: "afisha", tags: ["Стендап"], age: "18+", city: "Москва", place: "Stand Up Store", address: "ул. Арбат, 20", ...moscow("2026-09-18", "20:00", "22:00"), isPaid: true, priceRub: 1700, capacity: 100, sold: 92, draft: false },
  { id: "c1000001-0000-4000-8000-000000000018", title: "Беседка в Измайловском парке", summary: "Дневная аренда у пруда.", description: "Прошедшая аренда беседки. Мангал вернули на стойку.", category: "tourism", tags: ["Аренда"], age: "0+", city: "Москва", place: "Измайловский парк", address: "аллея Большого круга, 7", ...moscow("2026-09-20", "12:00", "17:00"), isPaid: true, priceRub: 1800, capacity: 10, sold: 10, draft: false },
  { id: "c1000001-0000-4000-8000-000000000019", title: "Экскурсия по Арбату", summary: "Бесплатная прогулка в субботу.", description: "Прошедшая пешая экскурсия от Арбатской до Смоленской.", category: "tourism", tags: ["Экскурсия"], age: "6+", city: "Москва", place: "Арбат", address: "ул. Арбат, 1", ...moscow("2026-09-06", "13:00", "15:00"), isPaid: false, priceRub: null, capacity: 20, sold: 17, draft: false },
  { id: "c1000001-0000-4000-8000-00000000001a", title: "Книжный клуб в магазине «Москва»", summary: "Утренний разговор о поэзии.", description: "Прошедшая встреча на Тверской. Вход был свободный.", category: "afisha", tags: ["Книги", "Клуб"], age: "12+", city: "Москва", place: "Дом книги «Москва»", address: "ул. Тверская, 8", ...moscow("2026-09-08", "11:00", "13:00"), isPaid: false, priceRub: null, capacity: 24, sold: 19, draft: false },
  { id: "c1000001-0000-4000-8000-00000000001b", title: "Органный вечер в соборе", summary: "Бах и Мендельсон, час без антракта.", description: "Концерт в католическом соборе Непорочного Зачатия.", category: "afisha", tags: ["Музыка", "Орган"], age: "6+", city: "Москва", place: "Собор Непорочного Зачатия", address: "ул. Малая Грузинская, 27", ...moscow("2026-09-21", "18:00", "19:15"), isPaid: true, priceRub: 900, capacity: 250, sold: 210, draft: false },
  { id: "c1000001-0000-4000-8000-00000000001c", title: "Йога в Аптекарском огороде", summary: "Утренняя практика на лужайке.", description: "Бесплатная йога для начинающих. Коврик свой.", category: "sport", tags: ["Спорт", "Йога"], age: "12+", city: "Москва", place: "Аптекарский огород", address: "пр-т Мира, 26", ...moscow("2026-10-07", "08:00", "09:15"), isPaid: false, priceRub: null, capacity: 40, sold: 27, draft: false },
  { id: "c1000001-0000-4000-8000-00000000001d", title: "Концерт в Консерватории", summary: "Большой зал, студенческий оркестр.", description: "Вечер Московской консерватории. Программа в буклете у входа.", category: "afisha", tags: ["Музыка", "Концерт"], age: "6+", city: "Москва", place: "Московская консерватория", address: "ул. Большая Никитская, 13", ...moscow("2026-10-28", "19:00", "21:00"), isPaid: true, priceRub: 1400, capacity: 350, sold: 190, draft: false },
];

export function cabinetAsOrganizerEvent(item: CabinetEvent): OrganizerEvent {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    city: item.city,
    placeId: null,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    isPaid: item.isPaid,
    priceRub: item.priceRub,
    paymentUrl: item.isPaid ? "https://afisha.moscow/pay" : null,
    capacity: item.capacity,
    chatLink: null,
    promoted: false,
    bookingOpensAt: null,
    weather: null,
    coverUrl: null,
    published: !item.draft,
    draft: item.draft,
  };
}

export function mergeCabinetEvents(items: OrganizerEvent[]): OrganizerEvent[] {
  const ids = new Set(items.map((item) => item.id));
  return [...items, ...CABINET_EVENTS.filter((item) => !ids.has(item.id)).map(cabinetAsOrganizerEvent)];
}

/** The «В афише» chip: published events that have not ended yet, earliest first. */
export function posterEvents(items: OrganizerEvent[], now = Date.now()): OrganizerEvent[] {
  return items
    .filter((item) => !item.draft && new Date(item.endsAt ?? item.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

export function cabinetSold(event: Pick<CabinetEvent, "draft" | "sold">): number {
  return event.draft ? 0 : event.sold;
}

/** The same occupied-seat figure the events list prints on a card. */
export function displayBooked(event: Pick<OrganizerEvent, "id" | "draft" | "capacity">): number {
  const known = CABINET_EVENTS.find((row) => row.id === event.id);
  if (known) return cabinetSold(known);
  if (event.draft || event.capacity === null) return 0;
  return Math.min(event.capacity, Math.round(event.capacity * 0.6));
}

export function cabinetIncome(events: CabinetEvent[]): number {
  return events.reduce((sum, event) => sum + (event.isPaid && event.priceRub !== null ? event.priceRub * cabinetSold(event) : 0), 0);
}

export function cabinetInRange(events: CabinetEvent[], from: Date, to: Date): CabinetEvent[] {
  return events.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return start >= from.getTime() && start <= to.getTime();
  });
}

export interface CabinetFillRow {
  id: string;
  title: string;
  booked: number;
  capacity: number;
  fill: number;
  category: EventCategory;
  startsAt: string;
}

export function fillCaption(booked: number, capacity: number, _fill?: number): string {
  if (capacity <= 0) return "Без лимита мест";
  if (booked <= 0) return `свободны все ${capacity} мест`;
  if (booked >= capacity) return "мест нет";
  return `занято ${booked} из ${capacity}`;
}

export const CABINET_TRAFFIC: Array<{ source: "chats" | "feed" | "search"; percent: number }> = [
  { source: "chats", percent: 62 },
  { source: "feed", percent: 24 },
  { source: "search", percent: 14 },
];

export const CABINET_ATTENDED_PERCENT = 74;
export const CABINET_REPEAT_PERCENT = 28;
export const CABINET_CANCELLED_PERCENT = 8;

export function cabinetViews(tickets: number): number {
  if (tickets <= 0) return 0;
  return Math.max(tickets, Math.round(tickets * 5.6));
}

export const CABINET_LEAD: Array<{ bucket: "same_day" | "days_1_3" | "days_4_7" | "earlier"; percent: number }> = [
  { bucket: "same_day", percent: 12 },
  { bucket: "days_1_3", percent: 28 },
  { bucket: "days_4_7", percent: 41 },
  { bucket: "earlier", percent: 19 },
];

export const CABINET_LEAD_LABELS: Record<(typeof CABINET_LEAD)[number]["bucket"], string> = {
  same_day: "В день",
  days_1_3: "1–3 дня",
  days_4_7: "За неделю",
  earlier: "Раньше",
};

export function cabinetLeadTitle(lead: Array<{ bucket: "same_day" | "days_1_3" | "days_4_7" | "earlier"; percent: number }> = CABINET_LEAD): string {
  const top = [...lead].sort((left, right) => right.percent - left.percent)[0];
  if (top === undefined || top.percent === 0) return "Когда записываются";
  if (top.bucket === "same_day") return `${top.percent}% в день`;
  if (top.bucket === "days_1_3") return `${top.percent}% за 1–3 дня`;
  if (top.bucket === "days_4_7") return `${top.percent}% за неделю`;
  return `${top.percent}% заранее`;
}

export function cabinetSoldOut(events: CabinetEvent[], from: Date, to: Date): number {
  return cabinetFillRows(events, from, to).filter((row) => row.capacity > 0 && row.booked >= row.capacity).length;
}

export const CABINET_TRAFFIC_LABELS: Record<(typeof CABINET_TRAFFIC)[number]["source"], string> = {
  chats: "Чаты MAX",
  feed: "Лента",
  search: "Поиск",
};

export function cabinetTrafficLead(sources: Array<{ source: "chats" | "feed" | "search"; percent: number }> = CABINET_TRAFFIC): string {
  const lead = [...sources].sort((left, right) => right.percent - left.percent)[0];
  if (lead === undefined) return "Пока не из чего считать";
  return `${lead.percent}% ${lead.source === "chats" ? "из чатов" : lead.source === "feed" ? "из ленты" : "из поиска"}`;
}

export function cabinetOccupancy(events: CabinetEvent[], from: Date, to: Date): { booked: number; capacity: number; fill: number } {
  const rows = cabinetFillRows(events, from, to);
  const booked = rows.reduce((sum, row) => sum + row.booked, 0);
  const capacity = rows.reduce((sum, row) => sum + row.capacity, 0);
  return { booked, capacity, fill: capacity === 0 ? 0 : Math.round((booked / capacity) * 100) };
}

/** Upcoming published events under 60% full — one CRM nudge, not a second catalog. */
export function cabinetWeakUpcoming(events: CabinetEvent[], now: Date): CabinetFillRow[] {
  return events
    .filter((event) => !event.draft && new Date(event.startsAt).getTime() >= now.getTime())
    .map((event) => {
      const booked = cabinetSold(event);
      const fill = event.capacity <= 0 ? 0 : Math.round((booked / event.capacity) * 100);
      return { id: event.id, title: event.title, booked, capacity: event.capacity, fill, category: event.category, startsAt: event.startsAt };
    })
    .filter((row) => row.capacity > 0 && row.fill < 60)
    .sort((a, b) => a.fill - b.fill || a.title.localeCompare(b.title, "ru"));
}

export function cabinetWeekdayBookings(events: CabinetEvent[], from: Date, to: Date): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const event of cabinetInRange(events, from, to).filter((item) => !item.draft)) {
    const weekday = (new Date(event.startsAt).getDay() + 6) % 7;
    days[weekday] += cabinetSold(event);
  }
  return days;
}

export function cabinetFillRows(events: CabinetEvent[], from: Date, to: Date): CabinetFillRow[] {
  return cabinetInRange(events, from, to)
    .filter((event) => !event.draft)
    .map((event) => {
      const booked = cabinetSold(event);
      const fill = event.capacity <= 0 ? 0 : Math.round((booked / event.capacity) * 100);
      return { id: event.id, title: event.title, booked, capacity: event.capacity, fill, category: event.category, startsAt: event.startsAt };
    })
    .sort((a, b) => a.fill - b.fill || a.title.localeCompare(b.title, "ru"));
}

export interface CabinetStats {
  incomeRub: number;
  delta: number;
  events: number;
  eventsDelta: number;
  tickets: number;
  ticketsDelta: number;
  averageRub: number;
  averageDelta: number;
  conversion: number;
  conversionDelta: number;
  rows: Array<{ title: string; percent: number; amountRub: number; tone: "purple" | "coral" | "blue" | "green" }>;
  promos: number;
  promoUses: number;
  mailings: number;
  openRate: number;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

const TONES = ["purple", "coral", "blue", "green"] as const;

export function cabinetStats(events: CabinetEvent[], from: Date, to: Date): CabinetStats {
  const length = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - length);
  const current = cabinetInRange(events, from, to).filter((event) => !event.draft);
  const previous = cabinetInRange(events, previousFrom, from).filter((event) => !event.draft);
  const tickets = current.reduce((sum, event) => sum + cabinetSold(event), 0);
  const previousTickets = previous.reduce((sum, event) => sum + cabinetSold(event), 0);
  const income = cabinetIncome(current);
  const previousIncome = cabinetIncome(previous);
  const paidTickets = current.reduce((sum, event) => sum + (event.isPaid ? cabinetSold(event) : 0), 0);
  const capacity = current.reduce((sum, event) => sum + event.capacity, 0);
  const previousCapacity = previous.reduce((sum, event) => sum + event.capacity, 0);
  const rows = [...current]
    .map((event) => ({ title: event.title, amountRub: event.isPaid && event.priceRub !== null ? event.priceRub * cabinetSold(event) : 0, tone: TONES[0] }))
    .filter((row) => row.amountRub > 0)
    .sort((a, b) => b.amountRub - a.amountRub)
    .slice(0, 5);
  const rowSum = rows.reduce((sum, row) => sum + row.amountRub, 0);
  return {
    incomeRub: income,
    delta: percentChange(income, previousIncome),
    events: current.length,
    eventsDelta: percentChange(current.length, previous.length),
    tickets,
    ticketsDelta: percentChange(tickets, previousTickets),
    averageRub: paidTickets === 0 ? 0 : Math.round(income / paidTickets),
    averageDelta: percentChange(paidTickets === 0 ? 0 : income / paidTickets, previousTickets === 0 ? 0 : previousIncome / previousTickets),
    conversion: capacity === 0 ? 0 : Math.round((tickets / capacity) * 100),
    conversionDelta: percentChange(capacity === 0 ? 0 : tickets / capacity, previousCapacity === 0 ? 0 : previousTickets / previousCapacity),
    rows: rows.map((row, index) => ({ ...row, percent: rowSum === 0 ? 0 : Math.round((row.amountRub / rowSum) * 100), tone: TONES[index % TONES.length] })),
    promos: current.filter((event) => event.isPaid).length > 4 ? 5 : current.filter((event) => event.isPaid).length,
    promoUses: Math.round(tickets * 0.22),
    mailings: Math.max(1, Math.round(current.length / 4)),
    openRate: 47,
  };
}

export function defaultStatsRange(now = new Date("2026-09-26T12:00:00+03:00")): { from: string; to: string } {
  const from = new Date(now.getTime() - 30 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
