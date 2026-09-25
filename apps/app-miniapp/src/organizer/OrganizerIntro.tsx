// START_MODULE_CONTRACT
// PURPOSE: Organizer intro (макет, экран 43): three slides about the panel, built as the user intro is — hero with the brand gradients, «Пропустить», dots and «Дальше»/«Начать».
// SCOPE: The screen and the slide state; the slides themselves and the "already seen" flag live in ./organizer-onboarding.ts, the finger comes from the shared ../ui/gestures.js mechanism. Shown once, on the first visit behind the organizer login.
// DEPENDS: react, ./organizer-onboarding.js, ../auth/EntryPage.js (AfishaWordmark), ../ui/gestures.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerIntroDirection - forward | back: the side the next slide's copy enters from
// - OrganizerIntroViewProps - what the presentational intro needs: the current slide, the side its copy enters from and one handler per action
// - OrganizerIntroView - the presentational three slides under one horizontal swipe, hero gradients crossfading as layers
// - OrganizerIntro - container: slide state, the swipe direction and the done flag written on the way out
// END_MODULE_MAP

import { useState } from "react";
import { AfishaWordmark } from "../auth/EntryPage";
import { useSwipeDrag } from "../ui/gestures";
import { AppButton } from "../ui/primitives";
import { ORGANIZER_INTRO_SLIDES, markOrganizerIntroDone } from "./organizer-onboarding";

/**
 * Та же уступка пальцу, что и во вступлении пользователя: следующего слайда под этим не лежит, и
 * тянуть его во всю ширину значило бы обещать то, чего за краем нет. Сорок затухающих пикселей
 * отвечают движением, ничего не обещая.
 */
const ORGANIZER_INTRO_LEAN_PX = 40;

/** Куда въезжает текст следующего слайда: назад — слева, вперёд и на месте — справа. */
export type OrganizerIntroDirection = "forward" | "back";

export interface OrganizerIntroViewProps {
  slide: number;
  direction: OrganizerIntroDirection;
  onSlide: (index: number) => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function OrganizerIntroView({ slide, direction, onSlide, onSkip, onNext, onBack }: OrganizerIntroViewProps) {
  const current = ORGANIZER_INTRO_SLIDES[slide];
  const last = slide === ORGANIZER_INTRO_SLIDES.length - 1;
  const copyClass = `app-onboarding-copy app-onboarding-copy--${direction}`;
  // Жест общий с онбордингом пользователя: влево — следующий слайд, вправо — предыдущий.
  const drag = useSwipeDrag({ axis: "x", dampPx: ORGANIZER_INTRO_LEAN_PX, onSwipe: (swipe) => (swipe === "right" ? onBack() : onNext()) });

  return (
    <div className={drag.settling ? "app-onboarding-slide app-onboarding-slide--settling" : "app-onboarding-slide"} {...drag.gesture} style={{ ...drag.gesture.style, transform: drag.offset === 0 ? undefined : `translateX(${drag.offset}px)` }}>
      <section className="app-onboarding app-onboarding--intro">
        <div className={`app-onboarding-hero app-onboarding-hero--${current.hero}`}>
          {/* Три градиента лежат слоями и перетекают по opacity: сам background браузер не анимирует */}
          {ORGANIZER_INTRO_SLIDES.map((item) => (
            <span key={item.hero} aria-hidden="true" className={item.hero === current.hero ? `app-onboarding-hero-bg app-onboarding-hero-bg--${item.hero} app-onboarding-hero-bg--on` : `app-onboarding-hero-bg app-onboarding-hero-bg--${item.hero}`} />
          ))}
          <div className="app-onboarding-hero-top">
            <AfishaWordmark className="app-wordmark--on-media" />
            <button type="button" className="app-onboarding-skip" onClick={onSkip}>
              Пропустить
            </button>
          </div>
          <p key={slide} className={`app-onboarding-hero-label ${copyClass}`}>
            {current.label}
          </p>
        </div>
        <div className="app-onboarding-intro-body">
          <div key={slide} className={`app-onboarding-copy-text ${copyClass}`}>
            <h1 className="app-onboarding-intro-title">{current.title}</h1>
            <p className="app-onboarding-intro-text">{current.description}</p>
          </div>
          <div className="app-onboarding-dots">
            {ORGANIZER_INTRO_SLIDES.map((item, position) => (
              <button key={item.title} type="button" aria-label={`Слайд ${position + 1}`} aria-current={position === slide ? "true" : undefined} className={position === slide ? "app-onboarding-dot app-onboarding-dot--on" : "app-onboarding-dot"} onClick={() => onSlide(position)} />
            ))}
          </div>
        </div>
        <div className="app-onboarding-footer">
          <AppButton stretched onClick={onNext}>
            {last ? "Начать" : "Дальше"}
          </AppButton>
        </div>
      </section>
    </div>
  );
}

export function OrganizerIntro({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<OrganizerIntroDirection>("forward");

  function go(next: number): void {
    setDirection(next < slide ? "back" : "forward");
    setSlide(next);
  }

  // Вступление засчитано и когда его пролистали, и когда пропустили: второй раз показывать нечего.
  function finish(): void {
    markOrganizerIntroDone();
    onDone();
  }

  return <OrganizerIntroView slide={slide} direction={direction} onSlide={go} onSkip={finish} onNext={() => (slide < ORGANIZER_INTRO_SLIDES.length - 1 ? go(slide + 1) : finish())} onBack={() => go(Math.max(0, slide - 1))} />;
}
