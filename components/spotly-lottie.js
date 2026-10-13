"use client";

import { useReducedMotion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const animationCache = new Map();
let lottiePromise;

async function getLottie() {
  if (!lottiePromise) {
    lottiePromise = import("lottie-web").then((module) => module.default || module);
  }
  return lottiePromise;
}

async function loadAnimationData(name) {
  if (!name) return null;
  if (animationCache.has(name)) return animationCache.get(name);
  const promise = fetch(`/lottie/${name}.json`, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Animation ${name} could not be loaded.`);
      return response.json();
    })
    .catch((error) => {
      animationCache.delete(name);
      throw error;
    });
  animationCache.set(name, promise);
  return promise;
}

/**
 * Purposeful Spotly Lottie primitive.
 *
 * loop  — ambient motion only while visible.
 * once  — one explanatory animation when entering the viewport.
 * hover — a quiet resting frame that replays on pointer/focus.
 * state — replay when playKey changes (add-to-cart, success, notifications, etc.).
 *
 * All assets are first-party local JSON. Reduced-motion users receive a still frame.
 */
export function SpotlyLottie({
  name,
  className,
  mode = "once",
  playKey,
  speed = 1,
  ariaLabel,
  fallback = null,
  loop,
  preserveAspectRatio = "xMidYMid meet",
  background = false,
  eager = false
}) {
  const rootRef = useRef(null);
  const playerRef = useRef(null);
  const reduce = useReducedMotion();
  const inView = useInView(rootRef, { once: mode === "once", margin: eager ? "400px" : "140px" });
  const [animationData, setAnimationData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    if (!eager && !inView) return;
    let active = true;
    loadAnimationData(name)
      .then((data) => { if (active) { setAnimationData(data); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [eager, inView, name]);

  useEffect(() => {
    if (!animationData || !rootRef.current || failed) return undefined;
    let active = true;
    let instance;
    getLottie().then((lottie) => {
      if (!active || !rootRef.current) return;
      rootRef.current.replaceChildren();
      instance = lottie.loadAnimation({
        container: rootRef.current,
        renderer: "svg",
        loop: loop ?? mode === "loop",
        autoplay: false,
        animationData,
        rendererSettings: { preserveAspectRatio, progressiveLoad: true, hideOnTransparent: true }
      });
      playerRef.current = instance;
      instance.setSpeed(speed);
      if (reduce) instance.goToAndStop(0, true);
      else if (mode === "loop" && inView) instance.play();
      else if (mode === "once" && inView) instance.goToAndPlay(0, true);
    });
    return () => {
      active = false;
      instance?.destroy();
      if (playerRef.current === instance) playerRef.current = null;
    };
  }, [animationData, failed, inView, loop, mode, preserveAspectRatio, reduce, speed]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || reduce) return;
    player.setSpeed(speed);
    if (mode === "loop") {
      if (inView) player.play(); else player.pause();
    } else if (mode === "hover") {
      if (engaged) player.goToAndPlay(0, true); else player.goToAndStop(0, true);
    } else if (mode === "state") {
      player.goToAndPlay(0, true);
    } else if (mode === "once" && inView) {
      player.goToAndPlay(0, true);
    }
  }, [engaged, inView, mode, playKey, reduce, speed]);

  const interactions = mode === "hover" ? {
    onMouseEnter: () => setEngaged(true),
    onMouseLeave: () => setEngaged(false)
  } : {};

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden", background && "rounded-2xl bg-[var(--accent-soft)]", className)}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...interactions}
    >
      {!animationData || failed ? fallback : null}
    </span>
  );
}

export function LottieEmptyState({ name, title, description, action, className, tone = "accent" }) {
  const toneClass = tone === "business" ? "bg-business-soft" : tone === "driver" ? "bg-driver-soft" : tone === "admin" ? "bg-admin-soft" : "bg-[var(--accent-soft)]";
  return (
    <div className={cn("flex min-h-[280px] flex-col items-center justify-center px-5 py-10 text-center", className)}>
      <span className={cn("flex h-24 w-24 items-center justify-center rounded-[26px]", toneClass)}>
        <SpotlyLottie name={name} mode="loop" className="h-20 w-20" />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
