"use client";

import { useReducedMotion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CalendarDays, CheckCircle2, Compass, MapPinned, ShieldCheck, Store, Truck, WalletCards } from "lucide-react";
const EMPTY_ICONS = {"driver-online": Truck,"route-delivery": MapPinned,"storefront": Store,"business-store": Store,"calendar-schedule": CalendarDays,"analytics-rise": WalletCards,"verification-shield": ShieldCheck,"success-check": CheckCircle2};
import { bundledLottieAsset } from "@/lib/generated/lottie-assets";

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
  const animation = bundledLottieAsset(name);
  const promise = animation
    ? Promise.resolve(animation)
    : Promise.reject(new Error(`Animation ${name} is not bundled.`));
  animationCache.set(name, promise);
  promise.catch(() => animationCache.delete(name));
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
 * All assets are first-party bundled data. Reduced-motion users receive a still frame.
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
  const toneClass = tone === "business" ? "bg-business-soft text-business" : tone === "driver" ? "bg-driver-soft text-driver" : tone === "admin" ? "bg-admin-soft text-admin" : "bg-[var(--accent-soft)] text-[var(--accent)]";
  const Illustration = EMPTY_ICONS[name] || Compass;
  return (
    <div className={cn("flex min-h-[280px] flex-col items-center justify-center px-5 py-10 text-center", className)}>
      <span className={cn("flex h-20 w-20 items-center justify-center rounded-[22px]", toneClass)} aria-hidden="true"><Illustration className="h-9 w-9" strokeWidth={1.7} /></span>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
