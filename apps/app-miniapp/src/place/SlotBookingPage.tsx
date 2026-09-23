// START_MODULE_CONTRACT
// PURPOSE: Экран 19 «Бронирование слота»: the week strip with a forecast per day, the windows of the chosen day with their forecast and availability, what the rent includes, the paid add-ons, the company the bill is split between and the bill itself.
// SCOPE: Reads apiClient.getSlotBoard (mock-backed, #492) and writes apiClient.createSlotBooking; the booking it creates opens экран 20. Picking a day refetches the board, everything else is local until «Забронировать слот».
// DEPENDS: ../api/client.js (apiClient, SlotBoard, PlaceSlot, SlotExtra), ../auth/AuthContext.js, ./slots.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Friend), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - slotMetaLine - «3 часа · 2 400 ₽» under a window; a taken window says when it frees instead
// - slotBoardSubtitle - «Серебряный Бор · 800 ₽/час» under the unit name
// - splitNote - «счёт делится на 3» next to the company
// - SlotDayStrip - the week of the design: weekday, day number and the forecast glyph, dimmed where nothing is published
// - SlotRow - one window: clock, hours, price with its forecast, and what it is («Свободно» / «Выбрано» / «Занято»)
// - SlotBookingState - union of the board fetch states (loading / error / ready)
// - SlotBookingView - presentational: the whole screen with the day, window, add-on and company choices lifted out
// - SlotBookingPage - route container: loads the board of a venue, holds the choices, books the window
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { apiClient, type PlaceSlot, type SlotBoard, type SlotExtra } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";
import { companyLabel, formatRub, formatSlotDayTitle, formatSlotDuration, formatSlotWindow, formatTemperature, formatTime, slotBill, slotDayCell, slotStatusLabel, weatherIcon } from "./slots";

/** «3 часа · 2 400 ₽» for a window on offer, «занято до 13:30» for one that is not. */
export function slotMetaLine(slot: PlaceSlot): string {
  const status = slotStatusLabel(slot);
  if (!status.free) return status.hint ?? "недоступно";
  const price = slot.priceRub === null ? "бесплатно" : formatRub(slot.priceRub);
  return `${formatSlotDuration(slot)} · ${price}`;
}

export function slotBoardSubtitle(board: Pick<SlotBoard, "place" | "pricePerHourRub">): string {
  return board.pricePerHourRub === null ? board.place.title : `${board.place.title} · ${board.pricePerHourRub.toLocaleString("ru-RU")} ₽/час`;
}

/** «счёт делится на 3» — the sentence the company block ends with once there is someone to split with. */
export function splitNote(partySize: number): string | null {
  return partySize < 2 ? null : `счёт делится на ${partySize}`;
}

function SlotDayStrip({ days, picked, onPick }: { days: SlotBoard["days"]; picked: string; onPick: (date: string) => void }) {
  return (
    <div className="app-slots-days">
      {days.map((day) => {
        const cell = slotDayCell(day.date);
        const className = ["app-slots-day", day.date === picked ? "app-slots-day--on" : "", day.hasFreeSlots ? "" : "app-slots-day--off"].filter(Boolean).join(" ");
        return (
          <button key={day.date} type="button" className={className} aria-pressed={day.date === picked} disabled={!day.hasFreeSlots} onClick={() => onPick(day.date)}>
            <span className="app-slots-day-weekday">{cell.weekday}</span>
            <span className="app-slots-day-number">{cell.day}</span>
            {day.weather !== null && (
              <span className="app-slots-day-weather">
                <ActionIcon name={weatherIcon(day.weather)} size={12} strokeWidth={2} />
                {formatTemperature(day.weather.temperatureC)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SlotRow({ slot, picked, onPick }: { slot: PlaceSlot; picked: boolean; onPick: () => void }) {
  const status = slotStatusLabel(slot);
  const className = ["app-slot", picked ? "app-slot--picked" : "", status.free ? "" : "app-slot--busy"].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} aria-pressed={picked} disabled={!status.free} onClick={onPick}>
      <ActionIcon name="clock" size={20} strokeWidth={2} />
      <span className="app-slot-body">
        <span className="app-slot-window">{formatSlotWindow(slot)}</span>
        <span className="app-slot-meta">
          {slotMetaLine(slot)}
          {status.free && slot.weather !== null && (
            <span className="app-slot-weather">
              {" · "}
              <ActionIcon name={weatherIcon(slot.weather)} size={13} strokeWidth={2} />
              {formatTemperature(slot.weather.temperatureC)}
            </span>
          )}
        </span>
      </span>
      <span className={picked ? "app-slot-status app-slot-status--picked" : status.free ? "app-slot-status app-slot-status--free" : "app-slot-status"}>
        {status.free && !picked && <span className="app-slot-dot" aria-hidden="true" />}
        {picked ? "Выбрано" : status.label}
      </span>
    </button>
  );
}

export type SlotBookingState = { status: "loading" } | { status: "error" } | { status: "ready"; board: SlotBoard };

interface SlotBookingViewProps {
  board: SlotBoard;
  day: string;
  slotId: string | null;
  extraIds: string[];
  company: Friend[];
  busy: boolean;
  failed: string | null;
  onBack: () => void;
  onPickDay: (date: string) => void;
  onPickSlot: (slotId: string) => void;
  onToggleExtra: (extraId: string) => void;
  onAddCompanion: () => void;
  onBook: () => void;
}

export function SlotBookingView({ board, day, slotId, extraIds, company, busy, failed, onBack, onPickDay, onPickSlot, onToggleExtra, onAddCompanion, onBook }: SlotBookingViewProps) {
  const slot = board.slots.find((item) => item.id === slotId) ?? null;
  const extras: SlotExtra[] = board.extras.filter((extra) => extraIds.includes(extra.id));
  const partySize = company.length + 1;
  const bill = slot === null ? null : slotBill(slot, extras, partySize);
  const note = splitNote(partySize);
  return (
    <section className="app-slots">
      <header className="app-slots-bar">
        <button type="button" className="app-slots-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={20} strokeWidth={2.5} />
        </button>
        <span className="app-slots-bar-titles">
          <span className="app-slots-bar-title">{board.unitTitle}</span>
          <span className="app-slots-bar-subtitle">{slotBoardSubtitle(board)}</span>
        </span>
        <span className="app-slots-bar-thumb" aria-hidden="true" />
      </header>

      <div className="app-slots-body">
        <SlotDayStrip days={board.days} picked={day} onPick={onPickDay} />

        <div className="app-place-label">
          <ActionIcon name="calendar" size={14} strokeWidth={2.2} />
          Доступные слоты · {formatSlotDayTitle(day)}
        </div>

        {board.slots.length === 0 ? (
          <AppState>На этот день площадка окон не открыла.</AppState>
        ) : (
          <div className="app-slots-list">
            {board.slots.map((item) => (
              <SlotRow key={item.id} slot={item} picked={item.id === slotId} onPick={() => onPickSlot(item.id)} />
            ))}
          </div>
        )}

        <section className="app-slots-included" aria-label="Что входит">
          <h2 className="app-slots-section-title">Что входит</h2>
          <div className="app-slots-amenities">
            {board.amenities.map((amenity) => (
              <span key={amenity} className="app-slots-amenity">
                {amenity}
              </span>
            ))}
          </div>
          {board.extras.map((extra) => (
            <div key={extra.id} className="app-slots-extra">
              <span className="app-slots-extra-body">
                <span className="app-slots-extra-title">{extra.title}</span>
                <span className="app-slots-extra-price">+{formatRub(extra.priceRub)} к брони</span>
              </span>
              <button type="button" role="switch" aria-checked={extraIds.includes(extra.id)} aria-label={extra.title} className={extraIds.includes(extra.id) ? "app-slots-switch app-slots-switch--on" : "app-slots-switch"} onClick={() => onToggleExtra(extra.id)}>
                <span className="app-slots-switch-knob" aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>

        <section className="app-slots-company" aria-label="Компания">
          <div className="app-slots-company-head">
            <h2 className="app-slots-section-title">Компания</h2>
            <button type="button" className="app-slots-company-add" disabled={board.candidates.length === 0} onClick={onAddCompanion}>
              Добавить
            </button>
          </div>
          <div className="app-slots-company-row">
            <span className="app-place-faces" role="img" aria-label={companyLabel(company)}>
              <span className="app-place-face app-place-face--small">Я</span>
              {company.map((friend) => (
                <span key={friend.id} className="app-place-face app-place-face--small">
                  {friend.name.charAt(0)}
                </span>
              ))}
            </span>
            <span className="app-slots-company-line">
              {companyLabel(company)}
              {note !== null && ` · ${note}`}
            </span>
          </div>
        </section>

        {bill === null ? (
          <AppState>Выбери окно — и мы посчитаем счёт.</AppState>
        ) : (
          <div className="app-slots-bill">
            {bill.rows.map((row) => (
              <div key={row.label} className="app-slots-bill-row">
                <span className="app-slots-bill-label">{row.label}</span>
                <span className="app-slots-bill-amount">{formatRub(row.amountRub)}</span>
              </div>
            ))}
            <div className="app-slots-bill-row app-slots-bill-row--total">
              <span className="app-slots-bill-total-label">Итого на человека</span>
              <span className="app-slots-bill-total">{formatRub(bill.perPersonRub)}</span>
            </div>
          </div>
        )}

        {failed !== null && <AppState error>{failed}</AppState>}

        <p className="app-slots-note">{board.cancelBefore === null ? "Оплата у площадки, в мини-приложении останется подтверждение и код входа." : `Бесплатная отмена до ${formatTime(board.cancelBefore)} в день брони. Оплата у площадки, в мини-приложении останется подтверждение и код входа.`}</p>
      </div>

      <footer className="app-slots-cta">
        <span className="app-slots-cta-sum">
          <span className="app-slots-cta-window">{slot === null ? "Окно не выбрано" : formatSlotWindow(slot)}</span>
          <span className="app-slots-cta-total">{bill === null ? "—" : formatRub(bill.totalRub)}</span>
        </span>
        <button type="button" className="app-slots-book" disabled={slot === null || busy} onClick={onBook}>
          {busy ? "Бронируем…" : "Забронировать слот"}
          <ActionIcon name="chevron" size={18} strokeWidth={2.6} />
        </button>
      </footer>
    </section>
  );
}

export function SlotBookingPage({ placeId }: { placeId: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [state, setState] = useState<SlotBookingState>({ status: "loading" });
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [company, setCompany] = useState<Friend[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getSlotBoard(placeId, day ?? undefined).then(
      (board) => {
        if (!alive) return;
        setState({ status: "ready", board });
        // The picked window follows the answer: a day is only ever shown with the windows it came with.
        setSlotId((current) => (board.slots.some((slot) => slot.id === current && slot.status === "free") ? current : (board.slots.find((slot) => slot.status === "free")?.id ?? null)));
        setCompany((current) => current ?? board.company);
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [placeId, day]);

  const pickDay = useCallback((date: string) => {
    setDay(date);
    setSlotId(null);
  }, []);

  const book = useCallback(() => {
    if (userId === null || slotId === null || busy) return;
    setBusy(true);
    setFailed(null);
    apiClient.createSlotBooking({ slotId, userId, companionIds: (company ?? []).map((friend) => friend.id), extraIds }).then(
      (booking) => {
        setBusy(false);
        navigate({ name: "slot-ticket", id: booking.id });
      },
      () => {
        setBusy(false);
        setFailed("Окно только что заняли. Выбери другое.");
      },
    );
  }, [userId, slotId, busy, company, extraIds, navigate]);

  if (state.status === "loading") return <AppSkeletonList rows={4} />;
  if (state.status === "error") return <AppState error>Не удалось загрузить слоты площадки.</AppState>;
  const picked = company ?? state.board.company;
  const rest = state.board.candidates.filter((candidate) => !picked.some((friend) => friend.id === candidate.id));
  return (
    <SlotBookingView
      board={state.board}
      day={state.board.date}
      slotId={slotId}
      extraIds={extraIds}
      company={picked}
      busy={busy}
      failed={failed}
      onBack={back}
      onPickDay={pickDay}
      onPickSlot={setSlotId}
      onToggleExtra={(extraId) => setExtraIds((current) => (current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId]))}
      onAddCompanion={() => {
        if (rest.length > 0) setCompany([...picked, rest[0]]);
      }}
      onBook={book}
    />
  );
}
