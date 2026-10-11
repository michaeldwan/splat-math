export const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const jitter = (amp: number) => (Math.random() * 2 - 1) * amp;

/** Rattles an element for a moment, settling back where it started. */
export function shake(el: HTMLElement | null, power: number) {
  if (!el || reducedMotion()) return;
  const frames: Keyframe[] = [];
  for (let i = 0; i < 5; i++) {
    const amp = power * (1 - i / 5);
    frames.push({ translate: `${jitter(amp)}px ${jitter(amp)}px` });
  }
  frames.push({ translate: "0 0" });
  el.animate(frames, { duration: 220, easing: "ease-out" });
}

/** A quick swell and settle. */
export function punch(el: HTMLElement | null, scale: number) {
  if (!el || reducedMotion()) return;
  el.animate([{ scale: "1" }, { scale: String(scale) }, { scale: "1" }], {
    duration: 200,
    easing: "cubic-bezier(.2, 1.6, .4, 1)",
  });
}

/** Restarts the CSS animation that a class applies, even if it's mid-run. */
export function replay(el: Element | null | undefined, className: string) {
  if (!el) return;
  el.classList.remove(className);
  // Reading layout makes the browser notice the class was gone.
  void el.getBoundingClientRect();
  el.classList.add(className);
}
