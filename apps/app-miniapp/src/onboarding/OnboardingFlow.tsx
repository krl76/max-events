// START_MODULE_CONTRACT
// PURPOSE: Onboarding screen (макет, экран 02): вступление (3 слайда) → город → друзья → интересы, after which the viewer lands on the feed.
// SCOPE: The screen and its wiring — profile read/write through apiClient, the follow write through apiClient.followFriends, the "run once" flag through ./onboarding.js, the swipe through ../ui/gestures.js. Step order, content and labels live in ./onboarding.ts; the gate that mounts this screen is in ../App.tsx.
// DEPENDS: ./onboarding.js, ../api/client.js (apiClient.getProfile/updateProfile/listFriendSuggestions/followFriends), ../auth/EntryPage.js (AfishaWordmark), ../geo/viewer-origin.js, ../ui/gestures.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OnboardingViewProps - everything the presentational screen needs: current step, the four selections, load/save status, the refused-forward wording, the side the intro copy enters from and one handler per action
// - OnboardingView - the presentational onboarding screen by step (intro slides with their hero gradients crossfading as layers, then city picker, people grid and interest chips inside one shell whose rail outlives the steps while the step body is keyed and slides in) under one horizontal swipe
// - OnboardingFlow - route container: step state, the intro slide direction, profile and suggestion fetch, the follow and profile writes, the done flag
// END_MODULE_MAP

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { FriendSuggestion } from "../api/client";
import { apiClient } from "../api/client";
import { AfishaWordmark } from "../auth/EntryPage";
import { useViewerOrigin } from "../geo/viewer-origin";
import { useSwipeDrag } from "../ui/gestures";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppChip, AppState } from "../ui/primitives";
import { INTRO_SLIDES, MIN_INTERESTS, ONBOARDING_CITIES, ONBOARDING_INTERESTS, cityDetectionHint, contactsLine, followCtaLabel, interestsCtaLabel, introDirection, markOnboardingDone, nearestOnboardingCity, nextOnboardingStep, onboardingForwardBlock, onboardingRailIndex, previousOnboardingStep, type IntroDirection, type OnboardingStep } from "./onboarding";

const RAIL_LABELS = ["Город", "Друзья", "Интересы"] as const;

/**
 * Насколько экран поддаётся пальцу. Слайд под жестом ровно один — следующего под ним нет, — и
 * тянуть его за палец во всю ширину значило бы обещать то, чего за краем не лежит. Затухающие
 * сорок пикселей отвечают движением, но ничего не обещают.
 */
const ONBOARDING_LEAN_PX = 40;

export interface OnboardingViewProps {
  step: OnboardingStep;
  intro: number;
  /** The side the intro copy enters from; the container derives it from the slide it came from. Forward when absent. */
  introDirection?: IntroDirection;
  city: string;
  citySource: "geo" | "fallback";
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
}

function StepRail({ step, onBack }: { step: OnboardingStep; onBack: () => void }) {
  const index = onboardingRailIndex(step);
  return (
    <div className="app-onboarding-nav">
      {/* Назад по шагам даёт смахивание вправо — и ровно то же обязано быть доступно тапом */}
      <button type="button" className="app-onboarding-back" aria-label="Назад" onClick={onBack}>
        <ActionIcon name="chevron" size={20} strokeWidth={2} />
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

function IntroStep({ intro, introDirection: direction = "forward", onIntro, onSkipIntro, onNext }: Pick<OnboardingViewProps, "intro" | "introDirection" | "onIntro" | "onSkipIntro" | "onNext">) {
  const slide = INTRO_SLIDES[intro];
  const last = intro === INTRO_SLIDES.length - 1;
  // Подпись hero и текст слайда пересобираются по key слайда и въезжают с той стороны, куда листали
  const copyClass = `app-onboarding-copy app-onboarding-copy--${direction}`;
  return (
    <section className="app-onboarding app-onboarding--intro">
      <div className={`app-onboarding-hero app-onboarding-hero--${slide.hero}`}>
        {/* Три градиента лежат слоями и перетекают по opacity: сам background между ними браузер не анимирует */}
        {INTRO_SLIDES.map((item) => (
          <span key={item.hero} aria-hidden="true" className={item.hero === slide.hero ? `app-onboarding-hero-bg app-onboarding-hero-bg--${item.hero} app-onboarding-hero-bg--on` : `app-onboarding-hero-bg app-onboarding-hero-bg--${item.hero}`} />
        ))}
        <div className="app-onboarding-hero-top">
          <AfishaWordmark className="app-wordmark--on-media" />
          <button type="button" className="app-onboarding-skip" onClick={onSkipIntro}>
            Пропустить
          </button>
        </div>
        <p key={intro} className={`app-onboarding-hero-label ${copyClass}`}>
          {slide.label}
        </p>
      </div>
      <div className="app-onboarding-intro-body">
        <div key={intro} className={`app-onboarding-copy-text ${copyClass}`}>
          <h1 className="app-onboarding-intro-title">{slide.title}</h1>
          <p className="app-onboarding-intro-text">{slide.description}</p>
        </div>
        <div className="app-onboarding-dots">
          {INTRO_SLIDES.map((item, position) => (
            <button key={item.title} type="button" aria-label={`Слайд ${position + 1}`} aria-current={position === intro ? "true" : undefined} className={position === intro ? "app-onboarding-dot app-onboarding-dot--on" : "app-onboarding-dot"} onClick={() => onIntro(position)} />
          ))}
        </div>
      </div>
      <div className="app-onboarding-footer">
        <AppButton stretched onClick={onNext}>
          {last ? "Начать" : "Дальше"}
        </AppButton>
      </div>
    </section>
  );
}

function CityStep({ city, citySource, onCity, onNext }: Pick<OnboardingViewProps, "city" | "citySource" | "onCity" | "onNext">) {
  return (
    <>
      <header className="app-onboarding-head">
        <h1 className="app-onboarding-title">Твой город</h1>
        <p className="app-onboarding-lead">{cityDetectionHint(citySource)}</p>
      </header>
      <div className="app-onboarding-body">
        <div className="app-onboarding-city-card">
          <span className="app-onboarding-city-icon" aria-hidden="true">
            <ActionIcon name="pin" size={22} strokeWidth={2} />
          </span>
          <span className="app-onboarding-city-text">
            <span className="app-onboarding-city-name">{city}</span>
            <span className="app-onboarding-city-meta">Рядом с тобой</span>
          </span>
          <span className="app-onboarding-city-live" aria-hidden="true" />
        </div>
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

export function OnboardingView(props: OnboardingViewProps) {
  // Жест один на весь онбординг: шаги расходятся только тем, куда ведут его концы. Влево — вперёд,
  // вправо — назад; вертикальная прокрутка списка городов и людей остаётся за прокруткой, и спор за
  // палец разбирает сам механизм.
  const drag = useSwipeDrag({ axis: "x", dampPx: ONBOARDING_LEAN_PX, onSwipe: (direction) => (direction === "right" ? props.onBack() : props.onNext()) });
  const stage = (content: ReactNode) => (
    <div className={drag.settling ? "app-onboarding-slide app-onboarding-slide--settling" : "app-onboarding-slide"} {...drag.gesture} style={{ ...drag.gesture.style, transform: drag.offset === 0 ? undefined : `translateX(${drag.offset}px)` }}>
      {content}
    </div>
  );

  if (props.step === "intro") return stage(<IntroStep intro={props.intro} introDirection={props.introDirection} onIntro={props.onIntro} onSkipIntro={props.onSkipIntro} onNext={props.onNext} />);
  // Город, друзья и интересы пишутся в профиль, поэтому дальше вступления экран ждёт загрузку.
  if (props.status === "loading") return <AppState>Загрузка…</AppState>;
  if (props.status === "error") return <AppState error>Не удалось загрузить данные онбординга.</AppState>;
  return stage(
    <StepShell step={props.step} onBack={props.onBack}>
      {props.step === "city" ? <CityStep city={props.city} citySource={props.citySource} onCity={props.onCity} onNext={props.onNext} /> : props.step === "friends" ? <FriendsStep suggestions={props.suggestions} followed={props.followed} saveFailed={props.saveFailed} onToggleFriend={props.onToggleFriend} onNext={props.onNext} /> : <InterestsStep interests={props.interests} saveFailed={props.saveFailed} blocked={props.blocked} onToggleInterest={props.onToggleInterest} onNext={props.onNext} />}
    </StepShell>,
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
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

  // Геолокация приходит позже профиля, поэтому город — производная, а не состояние: явный выбор
  // пользователя побеждает всегда, иначе побеждает геопозиция, и только потом — город из профиля.
  const detected = useMemo(() => (origin.source === "geo" ? nearestOnboardingCity(origin.latitude, origin.longitude).name : null), [origin]);
  const city = picked ?? detected ?? loaded?.city ?? ONBOARDING_CITIES[0].name;
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
      goIntro(Math.max(0, intro - 1));
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
      else setStep("city");
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
      save(apiClient.updateProfile({ city, interests: currentInterests }));
      return;
    }
    advance();
  }

  // Отказ живёт ровно до следующего выбора: человек услышал и сделал — напоминать больше не о чем.
  function onToggleInterest(interest: string): void {
    setBlocked(null);
    setInterests((current) => toggle(current ?? loaded?.interests ?? [], interest));
  }

  return <OnboardingView step={step} intro={intro} introDirection={slideDirection} city={city} citySource={origin.source} suggestions={loaded?.suggestions ?? []} followed={currentFollowed} interests={currentInterests} status={failed ? "error" : loaded === null ? "loading" : "ready"} saveFailed={saveFailed} blocked={blocked} onIntro={goIntro} onSkipIntro={() => setStep("city")} onCity={setPicked} onToggleFriend={(userId) => setFollowed((current) => toggle(current ?? seededFollows, userId))} onToggleInterest={onToggleInterest} onNext={onNext} onBack={onBack} />;
}
