// START_MODULE_CONTRACT
// PURPOSE: Переиспользуемое всплывающее окно выбора друга: поиск по имени, выбор одного или нескольких, подтверждение и отмена. Открывается по «Добавить друга» в календаре; тем же контрактом пользуются сбор компании, приглашение в план и голосование.
// SCOPE: Презентационно поверх готового Friend[] — окно ничего не грузит и никуда не ходит: список приносит вызывающий, он же решает, что делать с выбором. Пустой список предлагает «Пригласить в MAX». Клавиатура живёт здесь: Escape, ловушка фокуса внутри окна и возврат фокуса на кнопку-открывашку.
// DEPENDS: react, @max-events/api-contracts (Friend), ../friends/invite.js, ./icons.js (ActionIcon), ./theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - filterFriends - список под строку поиска: без учёта регистра, по любой части имени; пустой запрос отдаёт список целиком
// - toggleFriendSelection - выбор по клику: в множественном режиме добавляет или снимает, в одиночном заменяет
// - friendPickerConfirmLabel - надпись подтверждения со счётчиком, когда выбрано больше одного
// - FriendPickerProps - контракт окна: кого показывать, как назвать, один или несколько, что делать по подтверждению и отмене
// - FriendPicker - само окно: поиск, список, подтверждение; закрытие крестиком, фоном и Escape, фокус внутри и возврат на открывашку
// END_MODULE_MAP

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Friend } from "@max-events/api-contracts";
import { PersonAvatar } from "../friends/avatar";
import { FriendsInviteButton, useInviteFriends } from "../friends/invite";
import { friendHandle } from "./friend-handle";
import { ActionIcon } from "./icons";
import { useSheetSwipe } from "./sheet";

/** Что считается фокусируемым внутри окна: ровно то, что окно и рисует. */
const FOCUSABLE = "button:not([disabled]), input:not([disabled])";

export function filterFriends(friends: Friend[], query: string): Friend[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return friends;
  return friends.filter((friend) => friend.name.toLowerCase().includes(needle) || friendHandle(friend).toLowerCase().includes(needle) || (friend.username ?? "").toLowerCase().includes(needle));
}

/**
 * Одиночный режим ведёт себя как радио с правом передумать: повторный клик по выбранному снимает
 * выбор, клик по другому — заменяет. Без этого из окна на одного человека нельзя выйти в «никого».
 */
export function toggleFriendSelection(picked: string[], friendId: string, multiple: boolean): string[] {
  if (!multiple) return picked.includes(friendId) ? [] : [friendId];
  return picked.includes(friendId) ? picked.filter((id) => id !== friendId) : [...picked, friendId];
}

/** «Добавить» на одного и «Добавить · 3» на троих: счётчик появляется там, где он что-то сообщает. */
export function friendPickerConfirmLabel(label: string, picked: number): string {
  return picked > 1 ? `${label} · ${picked}` : label;
}

export interface FriendPickerProps {
  /** Кого показывать. Список приносит вызывающий — окно не знает, откуда друзья взялись. */
  friends: Friend[];
  /** Заголовок окна; он же его доступное имя. */
  title?: string;
  /** Строка под заголовком: зачем выбираем. */
  hint?: string | null;
  /** Надпись подтверждения без счётчика. */
  confirmLabel?: string;
  /** Что сказать, когда выбирать некого: у каждого вызова своя причина пустоты. */
  emptyText?: string;
  /** Множественный выбор; по умолчанию окно выбирает одного. */
  multiple?: boolean;
  /** Уже выбранные id, чтобы окно открылось с галочками. */
  selectedIds?: readonly string[];
  /** Подтверждение в работе: кнопки заперты, пока вызывающий не закроет окно. */
  busy?: boolean;
  onConfirm: (friendIds: string[]) => void;
  onClose: () => void;
}

export function FriendPicker({ friends, title = "Выбери друга", hint = null, confirmLabel = "Добавить", emptyText = "Друзей пока нет.", multiple = false, selectedIds, busy = false, onConfirm, onClose }: FriendPickerProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(() => (selectedIds ? [...selectedIds] : []));
  const sheet = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const swipe = useSheetSwipe(onClose);
  const inviteFriends = useInviteFriends();

  // Фокус уезжает в окно на открытии и возвращается на открывашку на закрытии. Без возврата
  // клавиатура и экранный диктор оказываются в начале страницы — окно как будто отбросило их назад.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    search.current?.focus();
    return () => opener?.focus();
  }, []);

  const shown = filterFriends(friends, query);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || sheet.current === null) return;
    const nodes = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    // Escape и ловушка Tab ловятся на корне окна: пока фокус внутри, слушатель на document не нужен
    <div className="app-fpick" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}>
      {/* tabIndex=-1: закрыть фоном — мышиный жест, у клавиатуры для этого есть крестик и Escape */}
      <button type="button" className="app-fpick-scrim" tabIndex={-1} aria-label="Закрыть" onClick={onClose} />
      <div className="app-fpick-sheet app-sheet" ref={sheet} style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <div className="app-fpick-head">
          <h2 className="app-fpick-title">{title}</h2>
        </div>
        {hint !== null && <p className="app-fpick-hint">{hint}</p>}
        <input ref={search} className="app-fpick-search" type="text" value={query} aria-label="Поиск по имени" placeholder="Имя друга" onChange={(change) => setQuery(change.target.value)} />
        {shown.length === 0 ? (
          <div className="app-fpick-empty-block">
            <p className="app-fpick-empty">{query.trim() === "" ? emptyText : "Никого не нашлось."}</p>
            {query.trim() === "" && <FriendsInviteButton onClick={inviteFriends} />}
          </div>
        ) : (
          <ul className="app-fpick-list">
            {shown.map((friend) => {
              const on = picked.includes(friend.id);
              return (
                <li key={friend.id}>
                  <button type="button" className={on ? "app-fpick-row app-fpick-row--on" : "app-fpick-row"} aria-pressed={on} onClick={() => setPicked((current) => toggleFriendSelection(current, friend.id, multiple))}>
                    {friend.avatarUrl ? <img className="app-fpick-avatar" src={friend.avatarUrl} alt="" /> : <PersonAvatar id={friend.id} name={friend.name} size={36} />}
                    <span className="app-fpick-name">
                      {friend.name}
                      <span className="app-fpick-handle">@{friendHandle(friend)}</span>
                    </span>
                    {on && (
                      <span className="app-fpick-mark" aria-hidden="true">
                        <ActionIcon name="check" size={16} strokeWidth={2.4} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="app-fpick-actions">
          <button type="button" className="app-fpick-cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="app-fpick-confirm" disabled={busy || picked.length === 0} onClick={() => onConfirm(picked)}>
            {friendPickerConfirmLabel(confirmLabel, picked.length)}
          </button>
        </div>
      </div>
    </div>
  );
}
