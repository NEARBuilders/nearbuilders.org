import { useEffect, useRef, useState } from "react";
import nearkatPeekRest from "@/assets/nearkat-peek.png";
import { cn } from "@/lib/utils";
import { FIRST_DELAY_RANGE, getRandomDelay, REPEAT_DELAY_RANGE } from "./nearkat-peek-schedule";

const PLAYBACK_DURATION_MS = 8_050;

let animationUrlPromise: Promise<string> | undefined;

function loadAnimationUrl() {
  animationUrlPromise ??= import("@/assets/nearkat-peek.webp")
    .then((module) => module.default)
    .catch((error: unknown) => {
      animationUrlPromise = undefined;
      throw error;
    });
  return animationUrlPromise;
}

export function NearkatPeek({ className }: { className?: string }) {
  const [animationUrl, setAnimationUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const isPlayingRef = useRef(false);
  const stopTimeoutRef = useRef<number | undefined>(undefined);
  const scheduleNextRef = useRef<() => void>(() => undefined);

  const stopPlaying = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (stopTimeoutRef.current !== undefined) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = undefined;
    }
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supportsIdleCallback = typeof window.requestIdleCallback === "function";
    let hasAppeared = false;
    let timeoutId: number | undefined;
    let waitingForVisibility = false;
    let disposed = false;

    const prefetch = () => {
      void loadAnimationUrl().catch(() => undefined);
    };

    const prefetchId = reducedMotion.matches
      ? undefined
      : supportsIdleCallback
        ? window.requestIdleCallback(prefetch)
        : window.setTimeout(prefetch, 2_000);

    const clearTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const startPlayback = (url: string) => {
      setAnimationUrl(url);
      setIsPlaying(true);
      if (stopTimeoutRef.current !== undefined) {
        window.clearTimeout(stopTimeoutRef.current);
      }
      stopTimeoutRef.current = window.setTimeout(() => {
        stopTimeoutRef.current = undefined;
        if (disposed) return;
        stopPlaying();
        scheduleNextRef.current();
      }, PLAYBACK_DURATION_MS);
    };

    const trigger = () => {
      waitingForVisibility = false;
      clearTimer();
      if (reducedMotion.matches || isPlayingRef.current) {
        return;
      }

      hasAppeared = true;
      isPlayingRef.current = true;
      void loadAnimationUrl()
        .then((url) => {
          if (disposed || !isPlayingRef.current) return;
          startPlayback(url);
        })
        .catch(() => {
          if (disposed || !isPlayingRef.current) return;
          stopPlaying();
          scheduleNextRef.current();
        });
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
      stopPlaying();
      if (!reducedMotion.matches) scheduleNext();
    };

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") trigger();
    };

    const root = rootRef.current;
    scheduleNextRef.current = scheduleNext;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.addEventListener("change", handleMotionPreferenceChange);
    root?.addEventListener("pointerenter", handlePointerEnter);
    scheduleNext();

    return () => {
      disposed = true;
      clearTimer();
      stopPlaying();
      scheduleNextRef.current = () => undefined;
      if (prefetchId !== undefined) {
        if (supportsIdleCallback) window.cancelIdleCallback(prefetchId);
        else window.clearTimeout(prefetchId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handleMotionPreferenceChange);
      root?.removeEventListener("pointerenter", handlePointerEnter);
    };
  }, []);

  return (
    <span ref={rootRef} aria-hidden="true" className={cn("relative block h-12 w-20", className)}>
      <img
        src={nearkatPeekRest}
        alt=""
        draggable={false}
        className={cn(
          "absolute left-1/2 top-1/2 h-full w-auto -translate-x-1/2 -translate-y-1/2",
          isPlaying ? "opacity-0" : "opacity-100",
        )}
      />
      {isPlaying && animationUrl ? (
        <img
          src={animationUrl}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 h-full w-auto -translate-x-1/2 -translate-y-1/2"
        />
      ) : null}
    </span>
  );
}
