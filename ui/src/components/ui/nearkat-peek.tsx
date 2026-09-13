import { type AnimationEvent, useEffect, useRef, useState } from "react";
import nearkatPeek from "@/assets/nearkat-peek.png";
import nearkatPeekAnimation from "@/assets/nearkat-peek.webp";
import { FIRST_DELAY_RANGE, getRandomDelay, REPEAT_DELAY_RANGE } from "./nearkat-peek-schedule";

export function NearkatPeek() {
  const [isAnimating, setIsAnimating] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const isAnimatingRef = useRef(false);
  const scheduleNextRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let hasAppeared = false;
    let timeoutId: number | undefined;
    let waitingForVisibility = false;

    const clearTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const trigger = () => {
      waitingForVisibility = false;
      clearTimer();
      if (reducedMotion.matches || isAnimatingRef.current) {
        return;
      }

      hasAppeared = true;
      isAnimatingRef.current = true;
      setIsAnimating(true);
    };

    const handleTimer = () => {
      timeoutId = undefined;
      if (document.hidden) {
        waitingForVisibility = true;
        return;
      }
      trigger();
    };

    const scheduleNext = () => {
      clearTimer();
      if (reducedMotion.matches) return;

      const range = hasAppeared ? REPEAT_DELAY_RANGE : FIRST_DELAY_RANGE;
      timeoutId = window.setTimeout(handleTimer, getRandomDelay(range));
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && waitingForVisibility) trigger();
    };

    const handleMotionPreferenceChange = () => {
      clearTimer();
      waitingForVisibility = false;
      isAnimatingRef.current = false;
      setIsAnimating(false);
      if (!reducedMotion.matches) scheduleNext();
    };

    const handleLogoPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") trigger();
    };

    const logoLink = rootRef.current?.closest("a");
    scheduleNextRef.current = scheduleNext;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.addEventListener("change", handleMotionPreferenceChange);
    logoLink?.addEventListener("pointerenter", handleLogoPointerEnter);
    scheduleNext();

    return () => {
      clearTimer();
      isAnimatingRef.current = false;
      scheduleNextRef.current = () => undefined;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handleMotionPreferenceChange);
      logoLink?.removeEventListener("pointerenter", handleLogoPointerEnter);
    };
  }, []);

  const handleAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget) return;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    scheduleNextRef.current();
  };

  return (
    <span ref={rootRef} className="nearkat-peek" aria-hidden="true">
      <span
        onAnimationEnd={handleAnimationEnd}
        className={`nearkat-peek__figure${isAnimating ? " nearkat-peek__figure--animating" : ""}`}
      >
        <img
          key={isAnimating ? "animation" : "rest"}
          src={isAnimating ? nearkatPeekAnimation : nearkatPeek}
          alt=""
          draggable={false}
          className="nearkat-peek__artwork"
        />
      </span>
    </span>
  );
}
