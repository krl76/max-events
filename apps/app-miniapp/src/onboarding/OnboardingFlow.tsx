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
import { getWebApp, shareResult } from "../max/bridge";
import { maxAppLink } from "../max/links";
import { useSwipe } from "../ui/gestures";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppState } from "../ui/primitives";
import { useViewerOrigin, requestViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { INTRO_SLIDES, MIN_INTERESTS, ONBOARDING_CITIES, ONBOARDING_INTERESTS, cityCardMeta, cityForwardBlock, interestsCtaLabel, introDirection, markOnboardingDone, matchedOnboardingCity, nextOnboardingStep, onboardingForwardBlock, onboardingRailIndex, previousOnboardingStep, type CityDetectState, type IntroDirection, type OnboardingStep } from "./onboarding";

const RAIL_LABELS = ["Город", "Сообщество", "Интересы"] as const;

/** Real places stay on the cards. The field behind them is abstract and does not swipe. */
const INTRO_PLACES = [
  { src: "/onboarding/gorky.jpg", title: "Парк Горького", meta: "Москва", slot: 1 },
  { src: "/onboarding/kazan.jpg", title: "Кул-Шариф", meta: "Казань", slot: 2 },
  { src: "/covers/kolomenskoe.jpg", title: "Коломенское", meta: "Москва", slot: 3 },
] as const;

const INTRO_FACES = ["Анна", "Дима", "Катя", "Лёша"] as const;

/** Illustrated people, not letters and not a generated animal. Hair uses the brand palette so the face stays a product avatar. */
function PersonFace({ variant }: { variant: number }) {
  const hair = ["#060708", "#6813ff", "#007aff", "#ff9315"][variant % 4];
  const bob = variant % 2 === 0;
  return (
    <svg className="app-onboarding-person-art" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#479fff" />
      <path d={bob ? "M14 34c1-16 35-18 36 2 0 8-4 10-8 8-6-8-16-8-20 0-4 2-8 0-8-10z" : "M12 28c2-14 38-14 40 2v8H12z"} fill={hair} />
      <circle cx="32" cy="38" r="14" fill="#ffffff" />
      <circle cx="26" cy="38" r="1.8" fill="#060708" />
      <circle cx="38" cy="38" r="1.8" fill="#060708" />
      {variant % 4 === 2 && <path d="M20 37h10M34 37h10" stroke="#060708" strokeWidth="1.4" fill="none" />}
      <path d="M22 58c4-8 16-8 20 0" fill={hair} />
    </svg>
  );
}

function OnboardingField() {
  return (
    <div className="app-onboarding-field" aria-hidden="true">
      <span className="app-onboarding-orb app-onboarding-orb--a" />
      <span className="app-onboarding-orb app-onboarding-orb--b" />
      <span className="app-onboarding-orb app-onboarding-orb--c" />
      <span className="app-onboarding-orb app-onboarding-orb--d" />
      <span className="app-onboarding-sheen" />
    </div>
  );
}

function AssistBot() {
  return (
    <svg className="app-onboarding-bot" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="44" r="28" fill="#007aff" />
      <circle cx="40" cy="42" r="18" fill="#ffffff" />
      <circle cx="33" cy="40" r="3" fill="#007aff" />
      <circle cx="47" cy="40" r="3" fill="#007aff" />
      <path d="M34 48h12" stroke="#007aff" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 8v10" stroke="#479fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="8" r="3.5" fill="#ff9315" />
      <path d="M18 36h8M54 36h8" stroke="#479fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IntroMark({ name, slot }: { name: "spark" | "clock" | "comment" | "pin"; slot: number }) {
  return (
    <span className={`app-onboarding-mark app-onboarding-mark--${slot}`}>
      <ActionIcon name={name} size={18} />
    </span>
  );
}

function IntroBits({ kind }: { kind: 1 | 2 | 3 }) {
  return (
    <div className="app-onboarding-bits" aria-hidden="true">
      <div className={kind === 1 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        {INTRO_FACES.map((name, index) => (
          <span key={name} className={`app-onboarding-face app-onboarding-face--${index + 1}`}>
            <PersonFace variant={index} />
            <span>{name}</span>
          </span>
        ))}
      </div>
      <div className={kind === 2 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        <AssistBot />
        <IntroMark name="spark" slot={1} />
        <IntroMark name="spark" slot={2} />
        <IntroMark name="spark" slot={4} />
      </div>
      <div className={kind === 3 ? "app-onboarding-bitset app-onboarding-bitset--on" : "app-onboarding-bitset"}>
        <IntroMark name="clock" slot={1} />
        <IntroMark name="comment" slot={2} />
        <IntroMark name="pin" slot={3} />
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
  onToggleFriend: (userId: string) => void;
  onToggleInterest: (interest: string) => void;
  onNext: () => void;
  onBack: () => void;
  /** Leave the whole flow. The second part keeps the same «Пропустить» as the intro. */
  onSkip?: () => void;
  onShareApp?: () => void;
  /** Set when this visit was opened on purpose. The first slide can leave instead of doing nothing. */
  onLeave?: () => void;
  onRetry?: () => void;
}

function StepRail({ step }: { step: OnboardingStep }) {
  const index = onboardingRailIndex(step);
  return (
    <div className="app-onboarding-nav">
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
  const travel = Math.max(-56, Math.min(56, shift * 0.28));
  const haze = Math.min(Math.abs(shift) / 22, 9);
  return (
    <div className="app-onboarding-film">
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
      <ol className={`app-onboarding-rail app-onboarding-rail--${index}`} aria-label="Шаги онбординга">
        {INTRO_SLIDES.map((item, position) => (
          <li key={item.title} className={position <= index ? "app-onboarding-rail-step app-onboarding-rail-step--on" : "app-onboarding-rail-step"} aria-current={position === index ? "step" : undefined}>
            <button type="button" className="app-onboarding-rail-dot" aria-label={`Слайд ${position + 1}`} onClick={() => onIntro(position)} />
            <span className="app-onboarding-rail-label">{item.label}</span>
          </li>
        ))}
      </ol>
      <div key={slide.title} className={`app-onboarding-line app-onboarding-copy app-onboarding-copy--${direction}`}>
        <h1 className="app-onboarding-intro-title">{slide.title}</h1>
      </div>
      <div className={settle ? "app-onboarding-cast app-onboarding-cast--settle" : "app-onboarding-cast"} style={{ transform: `translate3d(${travel}px, 0, 0)`, filter: haze > 0.4 ? `blur(${haze}px)` : "none" }}>
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
        <IntroBits kind={slide.hero} />
      </div>
      <div className="app-onboarding-film-foot">
        <button type="button" className="app-onboarding-cta" onClick={onNext}>
          {last ? "Начать" : "Дальше"}
        </button>
      </div>
    </div>
  );
}

function CityStep({ city, cityDetect, cityPicked, onCity, onNext }: Pick<OnboardingViewProps, "city" | "cityDetect" | "cityPicked" | "onCity" | "onNext">) {
  const shown = city ?? "Москва";
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Где ищем события?</h1>
      </header>
      <div className="app-onboarding-body">
        <div className="app-onboarding-city-deck">
          {ONBOARDING_CITIES.map((option) => {
            const on = option.name === shown;
            const meta = cityCardMeta(cityDetect, cityPicked);
            const metaVisible = on && (meta === "Твой выбор" || meta === "Рядом с тобой");
            return (
              <button key={option.name} type="button" className={on ? "app-onboarding-city-tile app-onboarding-city-tile--on" : "app-onboarding-city-tile"} aria-pressed={on} onClick={() => onCity(option.name)}>
                <span>{option.name}</span>
                {metaVisible && <small>{meta}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="app-onboarding-footer">
        <button type="button" className="app-onboarding-cta" onClick={onNext}>
          Дальше
        </button>
      </div>
    </>
  );
}

function FriendsStep({ saveFailed, onShare, onNext }: { saveFailed: boolean; onShare: () => void; onNext: () => void }) {
  return (
    <>
      <header className="app-onboarding-head app-onboarding-head--center">
        <h1 className="app-onboarding-title">Твои люди уже здесь</h1>
        <p className="app-onboarding-lead">Находи друзей по интересам и приглашай своих</p>
        <button type="button" className="app-onboarding-share" aria-label="Позвать в MAX" onClick={onShare}>
          <ActionIcon name="share" size={18} />
          Позвать в MAX
        </button>
      </header>
      <div className="app-onboarding-body" />
      <div className="app-onboarding-footer">
        {saveFailed && <p className="app-onboarding-error">Не удалось сохранить подписки. Попробуй ещё раз.</p>}
        <button type="button" className="app-onboarding-cta" onClick={onNext}>
          Дальше
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
        <p className="app-onboarding-lead">Отметь хотя бы три — и подборка подстроится под тебя.</p>
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
function StepShell({ step, onBack, onSkip, children }: { step: OnboardingStep; onBack: () => void; onSkip: () => void; children: ReactNode }) {
  return (
    <section className="app-onboarding app-onboarding--film">
      <div className="app-onboarding-chrome">
        <button type="button" className="app-onboarding-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
          Назад
        </button>
        <AfishaWordmark className="app-wordmark--on-media" />
        <button type="button" className="app-onboarding-skip" onClick={onSkip}>
          Пропустить
        </button>
      </div>
      <StepRail step={step} />
      <div key={step} className="app-onboarding-step">
        {children}
      </div>
    </section>
  );
}

/** The page follows the finger, then finishes the slide. A 40px lean read as a cut, not a swipe. */
function usePageTurn(allow: (direction: "left" | "right") => boolean, commit: (direction: "left" | "right") => void) {
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
      commitRef.current(direction);
      setMotion({ offset: 0, animate: false });
    },
  });
  return { offset: motion.offset, animate: motion.animate, gesture };
}

export function OnboardingView(props: OnboardingViewProps) {
  const frame = useRef<HTMLDivElement>(null);
  const turn = usePageTurn(
    (direction) => {
      if (direction === "right") return props.step !== "intro" || props.intro > 0 || props.onLeave !== undefined;
      if (props.step === "interests" && props.interests.length < MIN_INTERESTS) return false;
      if (props.step === "city" && props.city === null) return false;
      return true;
    },
    (direction) => (direction === "right" ? props.onBack() : props.onNext()),
  );
  const trackClass = !turn.animate && turn.offset !== 0 ? "app-onboarding-track" : "app-onboarding-track app-onboarding-track--move";
  const trackStyle = { transform: turn.offset === 0 ? undefined : `translate3d(${Math.max(-28, Math.min(28, turn.offset * 0.15))}px, 0, 0)` };
  const showBack = props.step !== "intro" || props.intro > 0 || props.onLeave !== undefined;

  if (props.step !== "intro" && props.status === "loading") return <AppState>Загрузка…</AppState>;
  if (props.step !== "intro" && props.status === "error")
    return (
      <AppState error action={props.onRetry === undefined ? undefined : { label: "Повторить", onClick: props.onRetry }}>
        Не удалось загрузить данные онбординга.
      </AppState>
    );

  return (
    <div
      className="app-onboarding-pager"
      ref={(node) => {
        frame.current = node;
      }}
      {...turn.gesture}
    >
      <OnboardingField />
      {props.step === "intro" ? (
        <IntroFilm index={props.intro} direction={props.introDirection ?? "forward"} showBack={showBack} shift={turn.offset} settle={turn.animate} onBack={props.onBack} onSkip={props.onSkipIntro} onIntro={props.onIntro} onNext={props.onNext} />
      ) : (
        <div className={trackClass} style={trackStyle}>
          <StepShell step={props.step} onBack={props.onBack} onSkip={props.onSkip ?? props.onNext}>
            {props.step === "city" ? <CityStep city={props.city} cityDetect={props.cityDetect} cityPicked={props.cityPicked} onCity={props.onCity} onNext={props.onNext} /> : props.step === "friends" ? <FriendsStep saveFailed={props.saveFailed} onShare={props.onShareApp ?? props.onNext} onNext={props.onNext} /> : <InterestsStep interests={props.interests} saveFailed={props.saveFailed} blocked={props.blocked} onToggleInterest={props.onToggleInterest} onNext={props.onNext} />}
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
  const [attempt, setAttempt] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [interests, setInterests] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
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
  }, [attempt]);

  // Город профиля при создании — всегда «Москва», поэтому он не подставляется. Явный тап побеждает.
  // Геопозиция выбирает город, только если точка реально рядом с ним, а не «ближайший из пяти» за тысячу километров.
  const cityDetect: CityDetectState = origin.state === "pending" ? "pending" : origin.source !== "geo" ? "denied" : matchedOnboardingCity(origin.latitude, origin.longitude) === null ? "outside" : "matched";
  const detected = useMemo(() => (origin.source === "geo" ? (matchedOnboardingCity(origin.latitude, origin.longitude)?.name ?? null) : null), [origin]);
  const city = picked ?? detected ?? "Москва";
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
      onToggleFriend={(userId) => setFollowed((current) => toggle(current ?? seededFollows, userId))}
      onToggleInterest={onToggleInterest}
      onNext={onNext}
      onBack={onBack}
      onSkip={() => {
        markOnboardingDone();
        onDone();
      }}
      onShareApp={() => {
        void shareResult(getWebApp(), "Афиша MAX — находи друзей по интересам и зови своих", maxAppLink(""));
      }}
      onLeave={onLeave}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

/** Replay from settings. Finishing returns to the previous screen and does not make the next launch wait on the gate. */
export function OnboardingReplayPage() {
  const { back } = useRoute();
  return <OnboardingFlow onDone={() => back()} onLeave={() => back()} />;
}
