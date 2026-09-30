// START_MODULE_CONTRACT
// PURPOSE: Схема проезда на метро между двумя точками Москвы: пешком до станции, линия и станции, пересадки, пешком от выхода.
// SCOPE: Клиентская схема центральных линий. Минуты на плашке приходят с API; здесь только как ехать. Точка дальше 1,4 км от любой станции схемы — маршрута нет, минуты остаются «по прямой».
// DEPENDS: ./format.js (pluralRu)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MetroItinerary - steps a person can follow and how many line changes they contain
// - planMetroRide - itinerary between two coordinates, or null when the metro is not nearby
// END_MODULE_MAP

import { pluralRu } from "./format";
import { walkingRoute } from "./walkingRoute";

export interface MetroStation {
  name: string;
  lat: number;
  lng: number;
}

export interface MetroItinerary {
  transfers: number;
  steps: string[];
  stations: MetroStation[];
  /** Walk to the station, ride, transfers and walk from the exit. */
  minutes: number;
}

/** Дальше этого метро «рядом» уже не честно: человек дойдёт пешком быстрее, чем дойдёт до станции. */
const MAX_STATION_M = 1400;
const WALK_M_PER_MIN = 80;

interface Stop {
  name: string;
  line: string;
  lat: number;
  lng: number;
}

type EdgeKind = "ride" | "transfer";

const LINES: readonly { line: string; stops: readonly (readonly [string, number, number])[] }[] = [
  {
    line: "Сокольническая",
    stops: [
      ["Сокольники", 55.7892, 37.6796],
      ["Красносельская", 55.78, 37.6663],
      ["Комсомольская", 55.7764, 37.6553],
      ["Красные Ворота", 55.7688, 37.6488],
      ["Чистые пруды", 55.7648, 37.6386],
      ["Лубянка", 55.7596, 37.6266],
      ["Охотный Ряд", 55.7571, 37.6156],
      ["Библиотека имени Ленина", 55.7512, 37.61],
      ["Кропоткинская", 55.7453, 37.6038],
      ["Парк культуры", 55.7356, 37.5931],
      ["Фрунзенская", 55.7274, 37.5805],
      ["Спортивная", 55.7233, 37.5638],
    ],
  },
  {
    line: "Замоскворецкая",
    stops: [
      ["Динамо", 55.7894, 37.5582],
      ["Белорусская", 55.7758, 37.5823],
      ["Маяковская", 55.7701, 37.5958],
      ["Тверская", 55.7651, 37.6037],
      ["Театральная", 55.7586, 37.6176],
      ["Новокузнецкая", 55.7424, 37.6293],
      ["Павелецкая", 55.7298, 37.6384],
      ["Автозаводская", 55.7074, 37.6576],
    ],
  },
  {
    line: "Арбатско-Покровская",
    stops: [
      ["Семёновская", 55.7831, 37.7193],
      ["Курская", 55.7586, 37.6593],
      ["Площадь Революции", 55.7566, 37.6233],
      ["Арбатская", 55.7521, 37.6014],
      ["Смоленская", 55.7474, 37.5823],
      ["Киевская", 55.7446, 37.5656],
    ],
  },
  {
    line: "Филёвская",
    stops: [
      ["Александровский сад", 55.7523, 37.6084],
      ["Арбатская", 55.752, 37.6016],
      ["Смоленская", 55.7488, 37.5835],
      ["Киевская", 55.7436, 37.5669],
      ["Выставочная", 55.7501, 37.5414],
    ],
  },
  {
    line: "Кольцевая",
    stops: [
      ["Парк культуры", 55.7352, 37.5929],
      ["Октябрьская", 55.7296, 37.6112],
      ["Добрынинская", 55.729, 37.6227],
      ["Павелецкая", 55.7318, 37.6366],
      ["Таганская", 55.7424, 37.6532],
      ["Курская", 55.7586, 37.6611],
      ["Комсомольская", 55.7756, 37.6547],
      ["Проспект Мира", 55.7796, 37.6334],
      ["Новослободская", 55.7799, 37.6013],
      ["Белорусская", 55.7764, 37.5844],
      ["Краснопресненская", 55.7603, 37.5773],
      ["Киевская", 55.7438, 37.5674],
    ],
  },
  {
    line: "Калужско-Рижская",
    stops: [
      ["Рижская", 55.7936, 37.6361],
      ["Проспект Мира", 55.7798, 37.6333],
      ["Сухаревская", 55.7724, 37.6322],
      ["Тургеневская", 55.7657, 37.6366],
      ["Китай-город", 55.7565, 37.6338],
      ["Третьяковская", 55.7407, 37.6259],
      ["Октябрьская", 55.731, 37.6127],
      ["Шаболовская", 55.7188, 37.608],
    ],
  },
  {
    line: "Таганско-Краснопресненская",
    stops: [
      ["Баррикадная", 55.7608, 37.5813],
      ["Пушкинская", 55.7656, 37.6038],
      ["Кузнецкий Мост", 55.7614, 37.6244],
      ["Китай-город", 55.7544, 37.6331],
      ["Таганская", 55.7418, 37.6533],
      ["Пролетарская", 55.7318, 37.6662],
    ],
  },
  {
    line: "Калининская",
    stops: [
      ["Третьяковская", 55.7406, 37.6268],
      ["Марксистская", 55.7411, 37.656],
      ["Площадь Ильича", 55.7469, 37.6807],
    ],
  },
  {
    line: "Серпуховско-Тимирязевская",
    stops: [
      ["Менделеевская", 55.7817, 37.5993],
      ["Цветной бульвар", 55.7712, 37.6208],
      ["Чеховская", 55.7658, 37.6082],
      ["Боровицкая", 55.7506, 37.6093],
      ["Полянка", 55.7378, 37.6184],
      ["Серпуховская", 55.728, 37.6245],
      ["Тульская", 55.7088, 37.6226],
    ],
  },
  {
    line: "Люблинско-Дмитровская",
    stops: [
      ["Трубная", 55.7678, 37.6219],
      ["Сретенский бульвар", 55.7668, 37.6392],
      ["Чкаловская", 55.756, 37.6594],
      ["Римская", 55.7463, 37.6817],
      ["Крестьянская Застава", 55.7326, 37.6655],
    ],
  },
];

/** Пары «Линия:станция». Одно имя на разных линиях — пересадка на месте, разные имена — переход внутри узла. */
const TRANSFERS: readonly (readonly [string, string])[] = [
  ["Сокольническая:Комсомольская", "Кольцевая:Комсомольская"],
  ["Сокольническая:Чистые пруды", "Калужско-Рижская:Тургеневская"],
  ["Сокольническая:Чистые пруды", "Люблинско-Дмитровская:Сретенский бульвар"],
  ["Калужско-Рижская:Тургеневская", "Люблинско-Дмитровская:Сретенский бульвар"],
  ["Сокольническая:Лубянка", "Таганско-Краснопресненская:Кузнецкий Мост"],
  ["Сокольническая:Охотный Ряд", "Замоскворецкая:Театральная"],
  ["Сокольническая:Охотный Ряд", "Арбатско-Покровская:Площадь Революции"],
  ["Замоскворецкая:Театральная", "Арбатско-Покровская:Площадь Революции"],
  ["Сокольническая:Библиотека имени Ленина", "Филёвская:Александровский сад"],
  ["Сокольническая:Библиотека имени Ленина", "Арбатско-Покровская:Арбатская"],
  ["Сокольническая:Библиотека имени Ленина", "Серпуховско-Тимирязевская:Боровицкая"],
  ["Филёвская:Александровский сад", "Арбатско-Покровская:Арбатская"],
  ["Филёвская:Александровский сад", "Серпуховско-Тимирязевская:Боровицкая"],
  ["Арбатско-Покровская:Арбатская", "Серпуховско-Тимирязевская:Боровицкая"],
  ["Сокольническая:Парк культуры", "Кольцевая:Парк культуры"],
  ["Замоскворецкая:Белорусская", "Кольцевая:Белорусская"],
  ["Замоскворецкая:Тверская", "Таганско-Краснопресненская:Пушкинская"],
  ["Замоскворецкая:Тверская", "Серпуховско-Тимирязевская:Чеховская"],
  ["Таганско-Краснопресненская:Пушкинская", "Серпуховско-Тимирязевская:Чеховская"],
  ["Замоскворецкая:Новокузнецкая", "Калужско-Рижская:Третьяковская"],
  ["Замоскворецкая:Новокузнецкая", "Калининская:Третьяковская"],
  ["Калужско-Рижская:Третьяковская", "Калининская:Третьяковская"],
  ["Замоскворецкая:Павелецкая", "Кольцевая:Павелецкая"],
  ["Арбатско-Покровская:Курская", "Кольцевая:Курская"],
  ["Арбатско-Покровская:Курская", "Люблинско-Дмитровская:Чкаловская"],
  ["Кольцевая:Курская", "Люблинско-Дмитровская:Чкаловская"],
  ["Арбатско-Покровская:Киевская", "Филёвская:Киевская"],
  ["Арбатско-Покровская:Киевская", "Кольцевая:Киевская"],
  ["Филёвская:Киевская", "Кольцевая:Киевская"],
  ["Кольцевая:Октябрьская", "Калужско-Рижская:Октябрьская"],
  ["Кольцевая:Добрынинская", "Серпуховско-Тимирязевская:Серпуховская"],
  ["Кольцевая:Таганская", "Таганско-Краснопресненская:Таганская"],
  ["Кольцевая:Таганская", "Калининская:Марксистская"],
  ["Таганско-Краснопресненская:Таганская", "Калининская:Марксистская"],
  ["Кольцевая:Проспект Мира", "Калужско-Рижская:Проспект Мира"],
  ["Кольцевая:Новослободская", "Серпуховско-Тимирязевская:Менделеевская"],
  ["Кольцевая:Краснопресненская", "Таганско-Краснопресненская:Баррикадная"],
  ["Калужско-Рижская:Китай-город", "Таганско-Краснопресненская:Китай-город"],
  ["Калининская:Площадь Ильича", "Люблинско-Дмитровская:Римская"],
  ["Таганско-Краснопресненская:Пролетарская", "Люблинско-Дмитровская:Крестьянская Застава"],
  ["Серпуховско-Тимирязевская:Цветной бульвар", "Люблинско-Дмитровская:Трубная"],
];

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))) * 1000);
}

function buildGraph(): { stops: Stop[]; ride: number[][]; transfer: number[][] } {
  const stops: Stop[] = [];
  const ride: number[][] = [];
  const transfer: number[][] = [];
  const indexById = new Map<string, number>();
  for (const line of LINES) {
    let prev = -1;
    for (const [name, lat, lng] of line.stops) {
      const index = stops.length;
      stops.push({ name, line: line.line, lat, lng });
      ride.push([]);
      transfer.push([]);
      indexById.set(`${line.line}:${name}`, index);
      if (prev >= 0) {
        ride[prev]?.push(index);
        ride[index]?.push(prev);
      }
      prev = index;
    }
  }
  for (const [left, right] of TRANSFERS) {
    const a = indexById.get(left);
    const b = indexById.get(right);
    if (a === undefined || b === undefined) continue;
    transfer[a]?.push(b);
    transfer[b]?.push(a);
  }
  return { stops, ride, transfer };
}

const GRAPH = buildGraph();

function nearest(lat: number, lng: number): { index: number; meters: number } | null {
  let index = -1;
  let meters = Infinity;
  GRAPH.stops.forEach((stop, candidate) => {
    const distance = haversineMeters(lat, lng, stop.lat, stop.lng);
    if (distance < meters) {
      meters = distance;
      index = candidate;
    }
  });
  if (index < 0 || meters > MAX_STATION_M) return null;
  return { index, meters };
}

function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

/** Кратчайший по пересадкам путь: смена линии дороже нескольких станций по одной. */
function route(from: number, to: number): { path: number[]; via: Array<EdgeKind | null> } | null {
  const count = GRAPH.stops.length;
  const cost = Array<number>(count).fill(Infinity);
  const prev = Array<number>(count).fill(-1);
  const via = Array<EdgeKind | null>(count).fill(null);
  const used = Array<boolean>(count).fill(false);
  cost[from] = 0;
  const relax = (node: number, next: number, kind: EdgeKind, weight: number) => {
    const candidate = cost[node] + weight;
    if (candidate >= cost[next]) return;
    cost[next] = candidate;
    prev[next] = node;
    via[next] = kind;
  };
  for (let step = 0; step < count; step += 1) {
    let node = -1;
    for (let index = 0; index < count; index += 1) {
      if (used[index]) continue;
      if (node < 0 || cost[index] < cost[node]) node = index;
    }
    if (node < 0 || cost[node] === Infinity) break;
    used[node] = true;
    if (node === to) break;
    for (const next of GRAPH.ride[node] ?? []) relax(node, next, "ride", 1);
    for (const next of GRAPH.transfer[node] ?? []) relax(node, next, "transfer", 8);
  }
  if (cost[to] === Infinity) return null;
  const path: number[] = [];
  for (let node = to; node >= 0; node = prev[node] ?? -1) path.push(node);
  path.reverse();
  return { path, via };
}

function rideLabel(start: Stop, end: Stop, hops: number): string {
  return `${start.line} линия: ${start.name} → ${end.name} · ${hops} ${pluralRu(hops, "станция", "станции", "станций")}`;
}

/**
 * Как доехать на метро. null — ни один конец не дотягивается до станции схемы,
 * и подпись «без пересадок» была бы выдумкой.
 */
export function planMetroRide(from: { lat: number; lng: number }, to: { lat: number; lng: number }): MetroItinerary | null {
  const start = nearest(from.lat, from.lng);
  const finish = nearest(to.lat, to.lng);
  if (start === null || finish === null) return null;
  const origin = GRAPH.stops[start.index];
  const destination = GRAPH.stops[finish.index];
  if (origin === undefined || destination === undefined) return null;
  const steps = [`Пешком до «${origin.name}» · ${walkMinutes(start.meters)} мин`];
  const asStation = (stop: Stop): MetroStation => ({ name: stop.name, lat: stop.lat, lng: stop.lng });
  const walkA = walkMinutes(start.meters);
  const walkB = walkMinutes(finish.meters);
  if (start.index === finish.index) {
    steps.push(`От «${destination.name}» пешком · ${walkB} мин`);
    return { transfers: 0, steps, stations: [asStation(origin)], minutes: walkA + walkB };
  }
  const found = route(start.index, finish.index);
  if (found === null) return null;
  let transfers = 0;
  let rideHops = 0;
  let cursor = 0;
  while (cursor < found.path.length - 1) {
    const here = GRAPH.stops[found.path[cursor] ?? -1];
    const nextIndex = found.path[cursor + 1] ?? -1;
    const kind = found.via[nextIndex];
    if (here === undefined || kind === null) break;
    if (kind === "transfer") {
      const next = GRAPH.stops[nextIndex];
      if (next === undefined) break;
      transfers += 1;
      steps.push(here.name === next.name ? `Пересадка на «${here.name}», смена линии` : `Пересадка с «${here.name}» на «${next.name}»`);
      cursor += 1;
      continue;
    }
    let hops = 0;
    while (cursor < found.path.length - 1) {
      const hopIndex = found.path[cursor + 1] ?? -1;
      const hop = GRAPH.stops[hopIndex];
      if (found.via[hopIndex] !== "ride" || hop === undefined || hop.line !== here.line) break;
      hops += 1;
      cursor += 1;
    }
    const end = GRAPH.stops[found.path[cursor] ?? -1];
    if (end !== undefined && hops > 0) {
      rideHops += hops;
      steps.push(rideLabel(here, end, hops));
    }
  }
  steps.push(`От «${destination.name}» пешком · ${walkB} мин`);
  const stations: MetroStation[] = [];
  for (const index of found.path) {
    const stop = GRAPH.stops[index];
    if (stop !== undefined) stations.push(asStation(stop));
  }
  return { transfers, steps, stations, minutes: walkA + walkB + rideHops * 2 + transfers * 4 };
}

/** Foot to the first station, the station line, foot from the last station. Null when metro is not nearby. */
export async function metroGeometry(from: [number, number], to: [number, number], fetchImpl: typeof fetch = fetch): Promise<[number, number][] | null> {
  const ride = planMetroRide({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] });
  if (ride === null || ride.stations.length === 0) return null;
  const first = ride.stations[0];
  const last = ride.stations[ride.stations.length - 1];
  if (first === undefined || last === undefined) return null;
  const head = await walkingRoute(from, [first.lat, first.lng], fetchImpl);
  const tail = await walkingRoute([last.lat, last.lng], to, fetchImpl);
  const rideLine: [number, number][] = ride.stations.map((station) => [station.lat, station.lng]);
  const joined: [number, number][] = [...head];
  for (const point of rideLine.slice(1)) joined.push(point);
  joined.push(...tail.slice(1));
  return joined.length >= 2 ? joined : null;
}
