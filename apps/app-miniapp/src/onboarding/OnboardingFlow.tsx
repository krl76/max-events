// START_MODULE_CONTRACT
// PURPOSE: Onboarding screen (макет, экран 02): вступление (3 слайда) → город → друзья → интересы, after which the viewer lands on the feed.
// SCOPE: The screen and its wiring — profile read/write through apiClient, the follow write through apiClient.followFriends, the "run once" flag through ./onboarding.js, the swipe through ../ui/gestures.js. Step order, content and labels live in ./onboarding.ts; the gate that mounts this screen is in ../App.tsx.
// DEPENDS: ./onboarding.js, ../api/client.js (apiClient.getProfile/updateProfile/listFriendSuggestions/followFriends), ../auth/EntryPage.js (AfishaWordmark), ../geo/viewer-origin.js, ../ui/gestures.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OnboardingViewProps - everything the presentational screen needs: current step, the four selections, load/save status, the refused-forward wording, the side the intro copy enters from and one handler per action
// - OnboardingView - the presentational onboarding screen by step (intro is an animated brand field; a swipe morphs the bits around the places, then city picker, people grid and interest chips inside one shell whose rail outlives the steps while the step body is keyed and slides in) under one horizontal swipe
// - OnboardingFlow - route container: step state, the intro slide direction, profile and suggestion fetch, the follow and profile writes, the done flag
// END_MODULE_MAP

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FriendSuggestion } from "../api/client";
import { apiClient } from "../api/client";
import { AfishaWordmark } from "../auth/EntryPage";
import { getWebApp } from "../max/bridge";
import { useSwipe } from "../ui/gestures";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppChip, AppState } from "../ui/primitives";
import { useViewerOrigin, requestViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { INTRO_SLIDES, MIN_INTERESTS, ONBOARDING_CITIES, ONBOARDING_INTERESTS, cityCardMeta, cityDetectionHint, cityForwardBlock, contactsLine, followCtaLabel, interestsCtaLabel, introDirection, markOnboardingDone, matchedOnboardingCity, nextOnboardingStep, onboardingForwardBlock, onboardingRailIndex, previousOnboardingStep, type CityDetectState, type IntroDirection, type OnboardingStep } from "./onboarding";

const RAIL_LABELS = ["Город", "Друзья", "Интересы"] as const;

/** Real places stay on the cards. The field behind them is abstract and does not swipe. */
const INTRO_PLACES = [
  { src: "/onboarding/gorky.jpg", title: "Парк Горького", meta: "Москва", slot: 1 },
  { src: "/onboarding/kazan.jpg", title: "Кул-Шариф", meta: "Казань", slot: 2 },
  { src: "/covers/kolomenskoe.jpg", title: "Коломенское", meta: "Москва", slot: 3 },
] as const;

const INTRO_FRIENDS = ["Анна", "Дима", "Катя", "Лёша"] as const;

function Orbit({ slot, children }: { slot: number; children: ReactNode }) {
  return (
    <span className={`app-onboarding-orbit app-onboarding-orbit--${slot}`}>
      <span className="app-onboarding-orbit-spin">{children}</span>
    </span>
  );
}

/** Rings behind the cards. Each swipe fades in another ring, the places stay. */
function IntroDraw({ kind }: { kind: 1 | 2 | 3 }) {
  return (
    <svg className="app-onboarding-drawings" viewBox="0 0 390 520" aria-hidden="true">
      <g className={kind === 1 ? "app-onboarding-draw app-onboarding-draw--on" : "app-onboarding-draw"}>
        <circle cx="195" cy="280" r="138" />
        <circle cx="195" cy="280" r="92" />
      </g>
      <g className={kind === 2 ? "app-onboarding-draw app-onboarding-draw--on" : "app-onboarding-draw"}>
        <circle cx="195" cy="280" r="112" />
        <circle className="app-onboarding-ink" cx="195" cy="160" r="5" />
        <circle className="app-onboarding-ink" cx="308" cy="320" r="4" />
        <circle className="app-onboarding-ink" cx="84" cy="300" r="3.5" />
      </g>
      <g className={kind === 3 ? "app-onboarding-draw app-onboarding-draw--on" : "app-onboarding-draw"}>
        <path d="M64 310 C 120 200, 270 200, 326 310" />
        <circle cx="326" cy="310" r="9" />
        <circle className="app-onboarding-ink" cx="326" cy="310" r="3.5" />
      </g>
    </svg>
  );
}

function IntroBits({ kind }: { kind: 1 | 2 | 3 }) {
  return (
    <div className="app-onboarding-bits" aria-hidden="true">
      <div className={kind === 1 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        {INTRO_FRIENDS.map((name, index) => (
          <Orbit key={name} slot={index + 1}>
            <span className="app-onboarding-friend">
              {name.slice(0, 1)}
              <span>{name}</span>
            </span>
          </Orbit>
        ))}
      </div>
      <div className={kind === 2 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        <span className="app-onboarding-blob">
          <ActionIcon name="spark" size={22} />
        </span>
        <Orbit slot={1}>
          <span className="app-onboarding-ask">
            <ActionIcon name="spark" size={16} />
            Ассистент
          </span>
        </Orbit>
        <Orbit slot={2}>
          <span className="app-onboarding-chip-float">джаз вечером</span>
        </Orbit>
        <Orbit slot={3}>
          <span className="app-onboarding-chip-float">парк</span>
        </Orbit>
        <Orbit slot={4}>
          <span className="app-onboarding-chip-float">Казань</span>
        </Orbit>
      </div>
      <div className={kind === 3 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        <Orbit slot={1}>
          <span className="app-onboarding-meet">
            <ActionIcon name="pin" size={14} />у входа
          </span>
        </Orbit>
        <Orbit slot={2}>
          <span className="app-onboarding-meet">
            <ActionIcon name="comment" size={14} />
            соберёмся?
          </span>
        </Orbit>
        <Orbit slot={3}>
          <span className="app-onboarding-meet">
            <ActionIcon name="clock" size={14} />
            напомним
          </span>
        </Orbit>
        <Orbit slot={4}>
          <span className="app-onboarding-meet">4 в компании</span>
        </Orbit>
      </div>
    </div>
  );
}

export interface OnboardingViewProps {
  step: OnboardingStep;
  intro: number;
  /** The side the intro copy enters from; the container derives it from the slide it came from. Forward when absent. */
  introDirection?: IntroDirection;
  city: string | null;
  cityDetect: CityDetectState;
  /** True once the viewer tapped a city. The card must not keep saying the fix chose it. */
  cityPicked: boolean;
  suggestions: FriendSuggestion[];
  followed: string[];
  interests: string[];
  status: "loading" | "error" | "ready";
  saveFailed: boolean;
  /** Почему шаг не выпустил вперёд, или null. Отказ на жесте обязан быть слышен — молчание читается как поломка. */
  blocked: string | null;
  onIntro: (index: number) => void;
  onSkipIntro: () => void;
  onCity: (city: string) => void;
  onLocate: () => void;
  onToggleFriend: (userId: string) => void;
  onToggleInterest: (interest: string) => void;
  onNext: () => void;
  onBack: () => void;
  /** Set when this visit was opened on purpose. The first slide can leave instead of doing nothing. */
  onLeave?: () => void;
}

function StepRail({ step, onBack }: { step: OnboardingStep; onBack: () => void }) {
  const index = onboardingRailIndex(step);
  return (
    <div className="app-onboarding-nav">
      {/* Назад по шагам даёт смахивание вправо — и ровно то же обязано быть доступно тапом */}
      <button type="button" className="app-onboarding-back" aria-label="Назад" onClick={onBack}>
        <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
        Назад
      </button>
      <ol className={`app-onboarding-rail app-onboarding-rail--${index}`} aria-label="Шаги онбординга">
        {RAIL_LABELS.map((label, position) => (
          <li key={label} className={position <= index ? "app-onboarding-rail-step app-onboarding-rail-step--on" : "app-onboarding-rail-step"} aria-current={position === index ? "step" : undefined}>
            <span className="app-onboarding-rail-dot" aria-hidden="true" />
            <span className="app-onboarding-rail-label">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IntroFilm({ index, direction = "forward", showBack, shift = 0, settle = false, onBack, onSkip, onIntro, onNext }: { index: number; direction?: IntroDirection; showBack: boolean; shift?: number; settle?: boolean; onBack: () => void; onSkip: () => void; onIntro: (index: number) => void; onNext: () => void }) {
  const slide = INTRO_SLIDES[index] ?? INTRO_SLIDES[0];
  const last = index === INTRO_SLIDES.length - 1;
  const lean = Math.max(-32, Math.min(32, shift * 0.16));
  return (
    <div className="app-onboarding-film">
      <div className="app-onboarding-field" aria-hidden="true">
        <span className="app-onboarding-orb app-onboarding-orb--a" />
        <span className="app-onboarding-orb app-onboarding-orb--b" />
        <span className="app-onboarding-orb app-onboarding-orb--c" />
        <span className="app-onboarding-orb app-onboarding-orb--d" />
        <span className="app-onboarding-sheen" />
      </div>
      <p className="app-onboarding-credit">Парк Горького: общественное достояние. Кул-Шариф: Yulesha, CC BY-SA 3.0.</p>
      <div className="app-onboarding-chrome">
        {showBack ? (
          <button type="button" className="app-onboarding-back" aria-label="Назад" onClick={onBack}>
            <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
            Назад
          </button>
        ) : (
          <span />
        )}
        <AfishaWordmark className="app-wordmark--on-media" />
        <button type="button" className="app-onboarding-skip" onClick={onSkip}>
          Пропустить
        </button>
      </div>
      <div className={settle ? "app-onboarding-stage app-onboarding-stage--settle" : "app-onboarding-stage"} style={{ transform: `translate3d(${lean}px, 0, 0)` }}>
        <div className="app-onboarding-places">
          {INTRO_PLACES.map((place) => (
            <article key={place.title} className={`app-onboarding-place app-onboarding-place--${place.slot}`}>
              <div className="app-onboarding-place-tilt">
                <img alt="" src={place.src} />
                <span>
                  <strong>{place.title}</strong>
                  {place.meta}
                </span>
              </div>
            </article>
          ))}
        </div>
        <IntroDraw kind={slide.hero} />
        <IntroBits kind={slide.hero} />
      </div>
      <div key={slide.title} className={`app-onboarding-line app-onboarding-copy app-onboarding-copy--${direction}`}>
        <p className={`app-onboarding-kicker app-onboarding-copy app-onboarding-copy--${direction}`}>{slide.label}</p>
        <h1 className="app-onboarding-intro-title">{slide.title}</h1>
        <p className="app-onboarding-intro-text">{slide.description}</p>
      </div>
      <div className="app-onboarding-film-foot">
        <div className="app-onboarding-dots">
          {INTRO_SLIDES.map((item, position) => (
            <button key={item.title} type="button" aria-label={`Слайд ${position + 1}`} aria-current={position === index ? "true" : undefined} className={position === index ? "app-onboarding-dot app-onboarding-dot--on" : "app-onboarding-dot"} onClick={() => onIntro(position)} />
          ))}
        </div>
        <AppButton stretched onClick={onNext}>
          {last ? "Начать" : "Дальше"}
        </AppButton>
      </div>
    </div>
  );
}

function CityStep({ city, cityDetect, cityPicked, onCity, onLocate, onNext }: Pick<OnboardingViewProps, "city" | "cityDetect" | "cityPicked" | "onCity" | "onLocate" | "onNext">) {
  const name = city ?? (cityDetect === "pending" ? "Определяем…" : "Не выбран");
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Твой город</h1>
        <p className="app-onboarding-lead">{cityDetectionHint(cityDetect)}</p>
      </header>
      <div className="app-onboarding-body">
        <div className="app-onboarding-city-card">
          <span className="app-onboarding-city-icon" aria-hidden="true">
            <ActionIcon name="pin" size={22} strokeWidth={2} />
          </span>
          <span className="app-onboarding-city-text">
            <span className="app-onboarding-city-name">{name}</span>
            <span className="app-onboarding-city-meta">{cityCardMeta(cityDetect, cityPicked)}</span>
          </span>
          <span className="app-onboarding-city-live" aria-hidden="true" />
        </div>
        <AppButton className="app-onboarding-locate" tone="secondary" stretched onClick={onLocate}>
          Определить по геолокации
        </AppButton>
        <ul className="app-onboarding-city-list">
          {ONBOARDING_CITIES.map((option) => (
            <li key={option.name}>
              <button type="button" className="app-onboarding-city-option" aria-pressed={option.name === city} onClick={() => onCity(option.name)}>
                <span>{option.name}</span>
                {option.name === city && <ActionIcon name="check" size={20} strokeWidth={3} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="app-onboarding-footer">
        <AppButton stretched onClick={onNext}>
          Дальше
        </AppButton>
      </div>
    </>
  );
}

function FriendsStep({ suggestions, followed, saveFailed, onToggleFriend, onNext }: Pick<OnboardingViewProps, "suggestions" | "followed" | "saveFailed" | "onToggleFriend" | "onNext">) {
  return (
    <>
      <header className="app-onboarding-head app-onboarding-head--center">
        <h1 className="app-onboarding-title app-onboarding-title--headline">
          Твои люди <span className="app-onboarding-accent">уже здесь</span>
        </h1>
        <p className="app-onboarding-lead">{contactsLine(suggestions.length)}</p>
      </header>
      <div className="app-onboarding-body">
        <ul className="app-onboarding-people">
          {suggestions.map((suggestion, position) => {
            const on = followed.includes(suggestion.friend.id);
            return (
              <li key={suggestion.friend.id}>
                <button type="button" aria-pressed={on} className="app-onboarding-person" onClick={() => onToggleFriend(suggestion.friend.id)}>
                  <span className={on ? "app-onboarding-person-avatar app-onboarding-person-avatar--on" : "app-onboarding-person-avatar"}>
                    <span className={`app-onboarding-person-face app-onboarding-person-face--${(position % 5) + 1}`}>{suggestion.friend.avatarUrl === null ? <span aria-hidden="true">{suggestion.friend.name.slice(0, 1)}</span> : <img alt="" src={suggestion.friend.avatarUrl} />}</span>
                    <span className="app-onboarding-person-mark" aria-hidden="true">
                      <ActionIcon name={on ? "check" : "plus"} size={12} strokeWidth={3.5} />
                    </span>
                  </span>
                  <span className="app-onboarding-person-text">
                    <span className="app-onboarding-person-name">{suggestion.friend.name}</span>
                    {suggestion.hint !== null && <span className="app-onboarding-person-hint">{suggestion.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="app-onboarding-footer app-onboarding-footer--divided">
        {saveFailed && <p className="app-onboarding-error">Не удалось сохранить подписки. Попробуй ещё раз.</p>}
        <button type="button" className="app-onboarding-cta" onClick={onNext}>
          {followCtaLabel(followed.length)}
        </button>
      </div>
    </>
  );
}

function InterestsStep({ interests, saveFailed, blocked, onToggleInterest, onNext }: Pick<OnboardingViewProps, "interests" | "saveFailed" | "blocked" | "onToggleInterest" | "onNext">) {
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Что тебе близко?</h1>
        <p className="app-onboarding-lead">Выбери хотя бы три. Подборка и «Куда пойдём?» подстроятся.</p>
      </header>
      <div className="app-onboarding-body">
        <div className="app-onboarding-chips" role="group" aria-label="Интересы">
          {ONBOARDING_INTERESTS.map((interest) => {
            const on = interests.includes(interest);
            return (
              <AppChip key={interest} className="app-onboarding-chip" pressed={on} onClick={() => onToggleInterest(interest)}>
                {on && <ActionIcon name="check" size={16} strokeWidth={3} />}
                {interest}
              </AppChip>
            );
          })}
        </div>
      </div>
      <div className="app-onboarding-footer app-onboarding-footer--divided">
        {saveFailed && <p className="app-onboarding-error">Не удалось сохранить выбор. Попробуй ещё раз.</p>}
        {/* Смахнули вперёд с незаполненного шага: жест не сработал, и экран говорит почему */}
        {blocked !== null && (
          <p className="app-onboarding-nudge" role="status">
            {blocked}
          </p>
        )}
        {/* Экран сам просит выбрать хотя бы три — кнопка не должна выпускать раньше */}
        <button type="button" className="app-onboarding-cta" disabled={interests.length < MIN_INTERESTS} onClick={onNext}>
          {interestsCtaLabel(interests.length)}
        </button>
      </div>
    </>
  );
}

/**
 * Рамка трёх шагов профиля. Полоса шагов — один элемент на все три: так её заливка и точки едут
 * переходом от шага к шагу, а не появляются готовыми. Сам шаг пересобирается по key и въезжает.
 */
function StepShell({ step, onBack, children }: { step: OnboardingStep; onBack: () => void; children: ReactNode }) {
  return (
    <section className="app-onboarding">
      <StepRail step={step} onBack={onBack} />
      <div key={step} className="app-onboarding-step">
        {children}
      </div>
    </section>
  );
}

/** The page follows the finger, then finishes the slide. A 40px lean read as a cut, not a swipe. */
function usePageTurn(allow: (direction: "left" | "right") => boolean, commit: (direction: "left" | "right") => void, frameWidth: { current: number }, morph: { current: boolean }) {
  const allowRef = useRef(allow);
  const commitRef = useRef(commit);
  allowRef.current = allow;
  commitRef.current = commit;
  const busy = useRef(false);
  const [motion, setMotion] = useState({ offset: 0, animate: false });
  const gesture = useSwipe({
    axis: "x",
    onOffset: (value) => {
      if (busy.current) return;
      setMotion({ offset: value, animate: false });
    },
    onCancel: () => setMotion({ offset: 0, animate: true }),
    onSwipe: (direction) => {
      if (busy.current || (direction !== "left" && direction !== "right")) return;
      if (!allowRef.current(direction)) {
        setMotion({ offset: 0, animate: true });
        return;
      }
      // Вступление не листает фотографию: жест только сменяет детали вокруг мест.
      if (morph.current) {
        commitRef.current(direction);
        setMotion({ offset: 0, animate: true });
        return;
      }
      const width = frameWidth.current || (typeof window === "undefined" ? 390 : window.innerWidth);
      busy.current = true;
      setMotion({ offset: direction === "left" ? -width : width, animate: true });
      window.setTimeout(() => {
        commitRef.current(direction);
        setMotion({ offset: 0, animate: false });
        busy.current = false;
      }, 440);
    },
  });
  return { offset: motion.offset, animate: motion.animate, gesture };
}

export function OnboardingView(props: OnboardingViewProps) {
  const frame = useRef<HTMLDivElement>(null);
  const frameWidth = useRef(0);
  const morph = useRef(props.step === "intro");
  morph.current = props.step === "intro";
  const turn = usePageTurn(
    (direction) => {
      if (direction === "right") return props.step !== "intro" || props.intro > 0 || props.onLeave !== undefined;
      if (props.step === "interests" && props.interests.length < MIN_INTERESTS) return false;
      if (props.step === "city" && props.city === null) return false;
      return true;
    },
    (direction) => (direction === "right" ? props.onBack() : props.onNext()),
    frameWidth,
    morph,
  );
  const trackClass = !turn.animate && turn.offset !== 0 ? "app-onboarding-track" : "app-onboarding-track app-onboarding-track--move";
  const trackStyle = { transform: props.step === "intro" ? `translate3d(calc(${-props.intro * 100}% + ${turn.offset}px), 0, 0)` : `translate3d(${turn.offset}px, 0, 0)` };
  const showBack = props.step !== "intro" || props.intro > 0 || props.onLeave !== undefined;

  if (props.step !== "intro" && props.status === "loading") return <AppState>Загрузка…</AppState>;
  if (props.step !== "intro" && props.status === "error") return <AppState error>Не удалось загрузить данные онбординга.</AppState>;

  return (
    <div
      className="app-onboarding-pager"
      ref={(node) => {
        frame.current = node;
        frameWidth.current = node?.clientWidth ?? 0;
      }}
      {...turn.gesture}
    >
      {props.step === "intro" ? (
        <IntroFilm index={props.intro} direction={props.introDirection ?? "forward"} showBack={showBack} shift={turn.offset} settle={turn.animate} onBack={props.onBack} onSkip={props.onSkipIntro} onIntro={props.onIntro} onNext={props.onNext} />
      ) : (
        <div className={trackClass} style={trackStyle}>
          <StepShell step={props.step} onBack={props.onBack}>
            {props.step === "city" ? <CityStep city={props.city} cityDetect={props.cityDetect} cityPicked={props.cityPicked} onCity={props.onCity} onLocate={props.onLocate} onNext={props.onNext} /> : props.step === "friends" ? <FriendsStep suggestions={props.suggestions} followed={props.followed} saveFailed={props.saveFailed} onToggleFriend={props.onToggleFriend} onNext={props.onNext} /> : <InterestsStep interests={props.interests} saveFailed={props.saveFailed} blocked={props.blocked} onToggleInterest={props.onToggleInterest} onNext={props.onNext} />}
          </StepShell>
        </div>
      )}
    </div>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function OnboardingFlow({ onDone, onLeave }: { onDone: () => void; onLeave?: () => void }) {
  const origin = useViewerOrigin();
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [intro, setIntro] = useState(0);
  // Сторона входа текста считается по тому, откуда пришли: точки, свайп и «назад» листают и назад
  const [slideDirection, setSlideDirection] = useState<IntroDirection>("forward");
  const [loaded, setLoaded] = useState<{ city: string; interests: string[]; suggestions: FriendSuggestion[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [interests, setInterests] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    // Подсказки по друзьям — украшение шага, а не его условие: без них шаг просто пуст, и человек
    // идёт дальше. Профиль — другое дело, на нём держатся город и интересы, и без него экрану нечего
    // показать. Поэтому падение подсказок гасится здесь, а не поднимает весь экран в ошибку: на живом
    // сервере эндпоинта подсказок пока нет вовсе (#532), и онбординг из-за этого не проходился.
    Promise.all([apiClient.getProfile(), apiClient.listFriendSuggestions().catch(() => [])]).then(
      ([profile, suggestions]) => {
        if (!alive) return;
        setLoaded({ city: profile.city, interests: profile.interests.filter((item) => ONBOARDING_INTERESTS.includes(item)), suggestions });
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Город профиля при создании — всегда «Москва», поэтому он не подставляется. Явный тап побеждает.
  // Геопозиция выбирает город, только если точка реально рядом с ним, а не «ближайший из пяти» за тысячу километров.
  const cityDetect: CityDetectState = origin.state === "pending" ? "pending" : origin.source !== "geo" ? "denied" : matchedOnboardingCity(origin.latitude, origin.longitude) === null ? "outside" : "matched";
  const detected = useMemo(() => (origin.source === "geo" ? (matchedOnboardingCity(origin.latitude, origin.longitude)?.name ?? null) : null), [origin]);
  const city = picked ?? detected;
  // Обновления идут функционально: пока выбор не тронут, его база — загруженные данные, и два
  // быстрых тапа подряд не должны считаться от одного и того же снимка.
  const seededFollows = loaded?.suggestions.filter((item) => item.followed).map((item) => item.friend.id) ?? [];
  const currentFollowed = followed ?? seededFollows;
  const currentInterests = interests ?? loaded?.interests ?? [];

  function advance(): void {
    const next = nextOnboardingStep(step);
    if (next === null) {
      markOnboardingDone();
      onDone();
      return;
    }
    setStep(next);
  }

  function save(write: Promise<unknown>): void {
    setSaveFailed(false);
    write.then(advance, () => setSaveFailed(true));
  }

  function goIntro(next: number): void {
    setSlideDirection(introDirection(intro, next));
    setIntro(next);
  }

  function onBack(): void {
    setBlocked(null);
    // Во вступлении «назад» — это предыдущий слайд: сама карусель и есть шаг, точки дублируют жест.
    if (step === "intro") {
      if (intro === 0) onLeave?.();
      else goIntro(intro - 1);
      return;
    }
    const previous = previousOnboardingStep(step);
    if (previous !== null) setStep(previous);
  }

  function onNext(): void {
    const block = onboardingForwardBlock(step, currentInterests.length);
    if (block !== null) {
      setBlocked(block);
      return;
    }
    setBlocked(null);
    if (step === "intro") {
      if (intro < INTRO_SLIDES.length - 1) goIntro(intro + 1);
      else {
        // Повторный запрос из жеста: в iframe мини-приложения браузер часто молчит на вызов без тапа.
        requestViewerOrigin();
        setStep("city");
      }
      return;
    }
    if (step === "city") {
      const cityBlock = cityForwardBlock(city, cityDetect);
      if (cityBlock !== null || city === null) {
        setBlocked(cityBlock ?? "Выбери город из списка");
        return;
      }
      save(apiClient.updateProfile({ city }));
      return;
    }
    if (step === "friends") {
      // Пустой шаг нечего сохранять: подписки не на кого ставить, и запрос свёлся бы к тому, чтобы
      // записать пустоту поверх пустоты. Заодно это единственный способ пройти шаг там, где сервер
      // подписок ещё не умеет (#532) — иначе «Дальше» упирается в ошибку сохранения навсегда.
      if (loaded?.suggestions.length === 0) {
        advance();
        return;
      }
      save(apiClient.followFriends(currentFollowed));
      return;
    }
    if (step === "interests") {
      save(apiClient.updateProfile(city === null ? { interests: currentInterests } : { city, interests: currentInterests }));
    }
  }

  const backRef = useRef(onBack);
  backRef.current = onBack;
  useEffect(() => {
    const handler = () => backRef.current();
    let timer = 0;
    const bind = () => {
      const button = getWebApp()?.BackButton;
      if (!button) return;
      button.offClick(handler);
      button.onClick(handler);
      if (step === "intro" && intro === 0 && onLeave === undefined) button.hide();
      else button.show();
    };
    bind();
    // Оболочка маршрута прячет кнопку в своём эффекте уже после этого. Повтор через тик забирает её себе.
    timer = window.setTimeout(bind, 0);
    return () => {
      window.clearTimeout(timer);
      getWebApp()?.BackButton?.offClick(handler);
    };
  }, [step, intro, onLeave]);

  // Отказ живёт ровно до следующего выбора: человек услышал и сделал — напоминать больше не о чем.
  function onToggleInterest(interest: string): void {
    setBlocked(null);
    setInterests((current) => toggle(current ?? loaded?.interests ?? [], interest));
  }

  return (
    <OnboardingView
      step={step}
      intro={intro}
      introDirection={slideDirection}
      city={city}
      cityDetect={cityDetect}
      cityPicked={picked !== null}
      suggestions={loaded?.suggestions ?? []}
      followed={currentFollowed}
      interests={currentInterests}
      status={failed ? "error" : loaded === null ? "loading" : "ready"}
      saveFailed={saveFailed}
      blocked={blocked}
      onIntro={goIntro}
      onSkipIntro={() => {
        requestViewerOrigin();
        setStep("city");
      }}
      onCity={setPicked}
      onLocate={() => {
        setPicked(null);
        requestViewerOrigin();
      }}
      onToggleFriend={(userId) => setFollowed((current) => toggle(current ?? seededFollows, userId))}
      onToggleInterest={onToggleInterest}
      onNext={onNext}
      onBack={onBack}
      onLeave={onLeave}
    />
  );
}

/** Replay from settings. Finishing returns to the previous screen and does not make the next launch wait on the gate. */
export function OnboardingReplayPage() {
  const { back } = useRoute();
  return <OnboardingFlow onDone={() => back()} onLeave={() => back()} />;
}
