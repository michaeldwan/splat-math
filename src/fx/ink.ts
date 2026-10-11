import { reducedMotion } from "./motion";
import { mulberry32 } from "./rng";

const INKS = ["#ff2d8a", "#b8f400", "#12d6ff", "#ff8a1f", "#a35bff", "#ffe21a"] as const;
const OUTLINE = "#130b2e";

export type Point = { x: number; y: number };

/** Position and size are fractions of the screen, so splats survive a resize. */
type Splat = { nx: number; ny: number; nr: number; color: string; seed: number; born: number };
type Drop = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
};
type Shot = {
  from: Point;
  to: Point;
  color: string;
  start: number;
  dur: number;
  onLand?: () => void;
};
type Word = {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rot: number;
  born: number;
  life: number;
};

type SplatOptions = { color?: string; scale?: number; drops?: number };
type WordOptions = { size: number; life: number; color?: string };

const TAU = Math.PI * 2;
const GROW_MS = 260;
const DRIP_MS = 1500;
const MAX_DROPS = 500;

const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
/**
 * Scale for something popping in over `ms`. Never negative: rounding can put
 * the easing a hair below zero at the start, and a negative radius throws.
 */
const popIn = (age: number, ms: number) => Math.max(0, easeOutBack(Math.min(1, age / ms)));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Darkens an ink toward the outline color, for the underside of a splat. */
function shade(hex: string, keep: number) {
  const mix = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    const o = parseInt(OUTLINE.slice(i, i + 2), 16);
    return Math.round(c * keep + o * (1 - keep));
  };
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}

/**
 * Draws the ink on three full-screen canvases: `paint` holds splats that have
 * landed and is only redrawn on resize, `wet` holds splats still spreading and
 * dripping, and `front` sits above the page for droplets, shots, and words.
 */
class Ink {
  private paint!: CanvasRenderingContext2D;
  private wetCtx!: CanvasRenderingContext2D;
  private front!: CanvasRenderingContext2D;
  private canvases: HTMLCanvasElement[] = [];
  private w = 0;
  private h = 0;

  private landed: Splat[] = [];
  private wet: Splat[] = [];
  private drops: Drop[] = [];
  private shots: Shot[] = [];
  private words: Word[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private raf = 0;
  private last = 0;
  private colorIndex = 0;

  /** Adds the canvases around the app root: two behind it and one in front. */
  mount(root: HTMLElement) {
    const make = (name: string) => {
      const canvas = document.createElement("canvas");
      canvas.className = `layer ${name}`;
      canvas.setAttribute("aria-hidden", "true");
      this.canvases.push(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D is not available");
      return { canvas, ctx };
    };
    const paint = make("paint");
    const wet = make("wet");
    const front = make("front");
    root.before(paint.canvas, wet.canvas);
    root.after(front.canvas);
    this.paint = paint.ctx;
    this.wetCtx = wet.ctx;
    this.front = front.ctx;
    this.resize();
    addEventListener("resize", this.resize);
    this.publishNextColor();
  }

  unmount() {
    removeEventListener("resize", this.resize);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    for (const canvas of this.canvases) canvas.remove();
    this.canvases = [];
    this.landed = [];
    this.wet = [];
    this.drops = [];
    this.shots = [];
    this.words = [];
  }

  get width() {
    return this.w;
  }

  get height() {
    return this.h;
  }

  /** The color the next splat will be. */
  private peekColor(): string {
    return INKS[this.colorIndex % INKS.length] as string;
  }

  /** Lands a splat at a point on the screen. */
  splat(x: number, y: number, options: SplatOptions = {}) {
    const color = options.color ?? this.takeColor();
    const splat: Splat = {
      nx: x / this.w,
      ny: y / this.h,
      nr: (0.075 + Math.random() * 0.05) * (options.scale ?? 1),
      color,
      seed: Math.floor(Math.random() * 2 ** 32),
      born: performance.now(),
    };
    if (reducedMotion()) {
      this.landed.push(splat);
      this.drawSplat(this.paint, splat, 1, 1);
    } else {
      this.wet.push(splat);
      this.kick();
    }
    this.burst(x, y, color, options.drops ?? 18, 520);
  }

  /**
   * Shoots a blob of ink from a point to an open spot on the wall, where it
   * lands as a splat. `avoid` lists areas the page covers, where a splat would
   * mostly be hidden.
   */
  fire(from: Point, avoid: readonly DOMRect[], onLand?: () => void): string {
    const color = this.takeColor();
    const to = this.pickTarget(avoid);
    if (reducedMotion()) {
      this.splat(to.x, to.y, { color });
      onLand?.();
      return color;
    }
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.shots.push({
      from,
      to,
      color,
      start: performance.now(),
      dur: Math.min(300, 140 + dist * 0.14),
      onLand,
    });
    this.kick();
    return color;
  }

  /** Sprays droplets outward from a point. */
  burst(x: number, y: number, color: string, count: number, power: number) {
    const n = reducedMotion() ? Math.ceil(count / 4) : count;
    const unit = this.unit;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * TAU;
      const speed = power * (0.3 + Math.random() * 0.9);
      const life = 0.45 + Math.random() * 0.5;
      this.drops.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 0.35,
        r: unit * (0.004 + Math.random() * 0.009),
        color: Math.random() < 0.12 ? "#ffffff" : color,
        life,
        maxLife: life,
      });
    }
    if (this.drops.length > MAX_DROPS) this.drops.splice(0, this.drops.length - MAX_DROPS);
    this.kick();
  }

  /**
   * Pops a big word into the strip above the page content, for moments like
   * "Go!". `contentTop` is where that content starts; the word shrinks to fit
   * above it rather than cover it.
   */
  shout(text: string, contentTop: number, life = 1000) {
    const size = Math.min(120, this.w * 0.13, Math.max(34, contentTop * 0.8));
    this.word(text, this.w / 2, Math.max(size * 0.6, contentTop / 2), { size, life });
  }

  /** Pops a word onto the screen, where it fades in place. */
  word(text: string, x: number, y: number, options: WordOptions) {
    this.words.push({
      text,
      x,
      y,
      size: options.size,
      color: options.color ?? "#ffffff",
      rot: (Math.random() * 2 - 1) * 0.12,
      born: performance.now(),
      life: options.life,
    });
    this.kick();
  }

  /** Covers the wall with a run of splats, one after another. */
  storm(count: number, onEach?: () => void) {
    for (let i = 0; i < count; i++) {
      this.later(i * 80, () => {
        this.splat(Math.random() * this.w, Math.random() * this.h, { drops: 26 });
        onEach?.();
      });
    }
  }

  /** Runs something later, unless the wall is cleared first. */
  later(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  /** Wipes the wall clean and cancels anything still on its way. */
  clear() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.landed = [];
    this.wet = [];
    this.shots = [];
    this.paint.clearRect(0, 0, this.w, this.h);
    this.kick();
  }

  /** Splat sizes scale with this, so they cover a phone and a desktop alike. */
  private get unit() {
    return Math.sqrt(this.w * this.h);
  }

  private takeColor(): string {
    const color = this.peekColor();
    this.colorIndex++;
    this.publishNextColor();
    return color;
  }

  /** The page reads this to tint things with the color of the next splat. */
  private publishNextColor() {
    document.documentElement.style.setProperty("--next", this.peekColor());
  }

  private resize = () => {
    this.w = innerWidth;
    this.h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const canvas of this.canvases) {
      canvas.width = Math.round(this.w * dpr);
      canvas.height = Math.round(this.h * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    for (const splat of this.landed) this.drawSplat(this.paint, splat, 1, 1);
    this.kick();
  };

  /** Tries a few random spots and keeps the one farthest from existing ink. */
  private pickTarget(avoid: readonly DOMRect[]): Point {
    const margin = this.unit * 0.05;
    const existing = [...this.landed, ...this.wet].slice(-80);
    let best: Point = { x: this.w / 2, y: this.h / 2 };
    let bestScore = -1;
    for (let i = 0; i < 10; i++) {
      const x = margin + Math.random() * (this.w - margin * 2);
      const y = margin + Math.random() * (this.h - margin * 2);
      let score = this.unit;
      for (const s of existing) {
        score = Math.min(score, Math.hypot(s.nx * this.w - x, s.ny * this.h - y));
      }
      const covered = avoid.some((r) => x > r.left && x < r.right && y > r.top && y < r.bottom);
      if (covered) score *= 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = () => {
    // Not the timestamp rAF passes in: that one marks the start of the frame,
    // so anything born from a tap or timer since then would have a negative age.
    const now = performance.now();
    const dt = Math.min(0.034, (now - this.last) / 1000);
    this.last = now;
    let busy = false;
    try {
      this.draw(now, dt);
      busy = this.wet.length + this.shots.length + this.drops.length + this.words.length > 0;
    } finally {
      // Runs even if drawing throws, so one bad frame can't stop the loop for good.
      this.raf = busy ? requestAnimationFrame(this.frame) : 0;
    }
  };

  private draw(now: number, dt: number) {
    this.wetCtx.clearRect(0, 0, this.w, this.h);
    this.front.clearRect(0, 0, this.w, this.h);

    this.wet = this.wet.filter((splat) => {
      const age = now - splat.born;
      if (age >= DRIP_MS) {
        this.landed.push(splat);
        this.drawSplat(this.paint, splat, 1, 1);
        return false;
      }
      this.drawSplat(this.wetCtx, splat, popIn(age, GROW_MS), easeOutCubic(age / DRIP_MS));
      return true;
    });

    const landing: Shot[] = [];
    this.shots = this.shots.filter((shot) => {
      const t = (now - shot.start) / shot.dur;
      if (t >= 1) {
        landing.push(shot);
        return false;
      }
      this.drawShot(shot, t);
      return true;
    });
    for (const shot of landing) {
      this.splat(shot.to.x, shot.to.y, { color: shot.color, drops: 22 });
      shot.onLand?.();
    }

    this.drops = this.drops.filter((drop) => this.stepDrop(drop, dt));
    this.words = this.words.filter((word) => this.drawWord(word, now));
  }

  /**
   * `grow` scales the body as the splat spreads; `drip` is how far the drips
   * have run. The seed fixes the shape, so every call draws the same splat.
   */
  private drawSplat(ctx: CanvasRenderingContext2D, splat: Splat, grow: number, drip: number) {
    const x = splat.nx * this.w;
    const y = splat.ny * this.h;
    const r = splat.nr * this.unit;
    this.drawSplatShape(ctx, splat.seed, x, y + r * 0.07, r, grow, drip, shade(splat.color, 0.62));
    this.drawSplatShape(ctx, splat.seed, x, y, r, grow, drip, splat.color);

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(
      x - r * 0.3 * grow,
      y - r * 0.34 * grow,
      r * 0.2 * grow,
      r * 0.09 * grow,
      -0.6,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  }

  private drawSplatShape(
    ctx: CanvasRenderingContext2D,
    seed: number,
    x: number,
    y: number,
    r: number,
    grow: number,
    drip: number,
    color: string,
  ) {
    const rng = mulberry32(seed);
    const body = r * grow;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";

    // Body: a lumpy circle.
    const n = 9 + Math.floor(rng() * 4);
    const pts: Point[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * TAU + rng() * 0.3;
      const radius = body * (0.72 + rng() * 0.4);
      pts.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
    }
    const mid = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const at = (i: number) => pts[(i + n) % n] as Point;
    const start = mid(at(-1), at(0));
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (let i = 0; i < n; i++) {
      const m = mid(at(i), at(i + 1));
      ctx.quadraticCurveTo(at(i).x, at(i).y, m.x, m.y);
    }
    ctx.fill();

    // Arms: thin necks out to a round tip.
    const arms = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < arms; i++) {
      const angle = rng() * TAU;
      const reach = body * (0.95 + rng() * 0.42);
      const tip = r * (0.08 + rng() * 0.12) * Math.min(grow, 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.lineWidth = tip * 1.4;
      ctx.beginPath();
      ctx.moveTo(x + cos * body * 0.5, y + sin * body * 0.5);
      ctx.lineTo(x + cos * reach, y + sin * reach);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + cos * reach, y + sin * reach, tip, 0, TAU);
      ctx.fill();
    }

    // Loose droplets thrown clear of the body.
    const loose = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < loose; i++) {
      const angle = rng() * TAU;
      const reach = body * (1.45 + rng() * 0.7);
      const size = r * (0.03 + rng() * 0.07) * Math.min(grow, 1);
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, size, 0, TAU);
      ctx.fill();
    }

    // Drips running down the wall.
    const drips = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < drips; i++) {
      const dx = (rng() - 0.5) * r * 1.1;
      const length = r * (0.5 + rng() * 1.1) * drip;
      const width = r * (0.1 + rng() * 0.1);
      const end = y + r * 0.6 + length;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + r * 0.3);
      ctx.lineTo(x + dx, end);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + dx, end, width * 0.72, 0, TAU);
      ctx.fill();
    }
  }

  private drawShot(shot: Shot, t: number) {
    const ctx = this.front;
    const dist = Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y);
    const head = this.unit * 0.024;
    ctx.fillStyle = shot.color;
    for (let k = 0; k < 6; k++) {
      const e = Math.max(0, t - k * 0.06) ** 2;
      const px = shot.from.x + (shot.to.x - shot.from.x) * e;
      const py = shot.from.y + (shot.to.y - shot.from.y) * e - Math.sin(Math.PI * e) * dist * 0.16;
      ctx.beginPath();
      ctx.arc(px, py, head * (1 - k * 0.14), 0, TAU);
      ctx.fill();
    }
  }

  private stepDrop(drop: Drop, dt: number): boolean {
    drop.vy += 1500 * dt;
    drop.vx *= 1 - 1.5 * dt;
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.life -= dt;
    if (drop.life <= 0 || drop.y > this.h + 40) return false;

    const r = drop.r * Math.sqrt(drop.life / drop.maxLife);
    const stretch = 1 + Math.min(1.2, Math.hypot(drop.vx, drop.vy) / 900);
    const ctx = this.front;
    ctx.fillStyle = drop.color;
    ctx.beginPath();
    ctx.ellipse(
      drop.x,
      drop.y,
      r * stretch,
      r / Math.sqrt(stretch),
      Math.atan2(drop.vy, drop.vx),
      0,
      TAU,
    );
    ctx.fill();
    return true;
  }

  private drawWord(word: Word, now: number): boolean {
    const age = now - word.born;
    const t = age / word.life;
    if (t >= 1) return false;

    const ctx = this.front;
    const still = reducedMotion();
    const pop = still ? 1 : popIn(age, 180);
    ctx.save();
    ctx.font = `${word.size}px "Bagel Fat One", system-ui, sans-serif`;
    const half = ctx.measureText(word.text).width / 2 + word.size * 0.15;
    const x = Math.min(Math.max(word.x, half), Math.max(half, this.w - half));
    ctx.translate(x, word.y);
    ctx.rotate(word.rot);
    ctx.scale(pop, pop);
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = word.size * 0.16;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText(word.text, 0, 0);
    ctx.fillStyle = word.color;
    ctx.fillText(word.text, 0, 0);
    ctx.restore();
    return true;
  }
}

export const fx = new Ink();
