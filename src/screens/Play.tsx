import { useEffect, useEffectEvent, useRef, useState } from "react";
import { fx } from "../fx/ink";
import { punch, replay, shake } from "../fx/motion";
import { sfx } from "../fx/sfx";
import { type Fact, Session, answerOf, isComplete } from "../game/facts";
import type { Config, RoundResult } from "../game/storage";
import { Back, Backspace, Times } from "./Icons";

type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back";

const DIGITS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Shown at every fifth right answer in a row. */
const CHEERS = ["Nice!", "On fire!", "Whoa!", "Unstoppable!", "Legend!"];

type Props = {
  config: Config;
  onDone: (result: RoundResult) => void;
  /** Leaves the round early. Nothing about it is saved. */
  onQuit: () => void;
};

export function Play({ config, onDone, onQuit }: Props) {
  const [session] = useState(() => new Session(config.tables));
  const [fact, setFact] = useState<Fact>(session.current);
  const [typed, setTyped] = useState("");

  // Input can arrive faster than React re-renders, so the handlers read this.
  const live = useRef({ typed: "", done: false, greeted: false });
  const stage = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);

  const celebrate = (solved: Fact) => {
    const rect = slot.current?.getBoundingClientRect();
    if (!rect) return;
    const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const streak = session.streak;
    const power = Math.min(streak, 10);
    const covered = [card.current, pad.current].flatMap((el) =>
      el ? [el.getBoundingClientRect()] : [],
    );

    sfx.correct(streak);
    const color = fx.fire(from, covered, () => {
      sfx.splat();
      shake(stage.current, 3 + power * 0.6);
    });
    fx.burst(from.x, from.y, color, 10 + power * 2, 380 + power * 20);
    // Stays in the answer slot and fades fast, so it never covers the next problem.
    fx.word(String(answerOf(solved)), from.x, from.y, {
      size: rect.height * 0.9,
      color,
      life: 380,
    });
    punch(card.current, 1.05);

    if (streak % 5 === 0) {
      const cheer = CHEERS[Math.min(streak / 5, CHEERS.length) - 1] as string;
      fx.shout(cheer, card.current?.getBoundingClientRect().top ?? 0, 1100);
    }
  };

  const press = (key: Key) => {
    const state = live.current;
    if (state.done) return;
    replay(pad.current?.querySelector(`[data-key="${key}"]`), "hit");
    navigator.vibrate?.(8);
    sfx.tap();

    if (key === "back") {
      state.typed = state.typed.slice(0, -1);
      setTyped(state.typed);
      return;
    }

    state.typed += key;
    const current = session.current;
    if (!isComplete(state.typed, current)) {
      setTyped(state.typed);
      return;
    }

    // A miss moves straight on with no fanfare; the results list it afterward.
    if (session.submit(Number(state.typed))) celebrate(current);
    state.typed = "";
    setTyped("");
    setFact(session.advance());
  };

  const onKeyPress = useEffectEvent(press);
  const finish = useEffectEvent(() => {
    live.current.done = true;
    onDone({ correct: session.correct, attempted: session.attempted, missed: session.missed });
  });
  const quit = useEffectEvent(onQuit);

  useEffect(() => {
    if (!live.current.greeted) {
      live.current.greeted = true;
      fx.shout("Go!", card.current?.getBoundingClientRect().top ?? 0, 900);
    }

    // One timer for the whole round. Nothing stops it, like the real quiz.
    const timer = setTimeout(finish, config.durationSec * 1000);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9" && e.key.length === 1) onKeyPress(e.key as Key);
      else if (e.key === "Backspace") onKeyPress("back");
      else if (e.key === "Escape") quit();
      else return;
      e.preventDefault();
    };

    addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      removeEventListener("keydown", onKey);
    };
  }, [config.durationSec]);

  const keyButton = (key: Key, className = "") => (
    <button
      key={key}
      type="button"
      className={`sticker key ${className}`}
      data-key={key}
      aria-label={key === "back" ? "Erase" : undefined}
      onClick={() => press(key)}
    >
      {key === "back" ? <Backspace /> : key}
    </button>
  );

  return (
    <main className="screen play" ref={stage}>
      <div className="sticker card" ref={card}>
        <div
          className="problem"
          key={`${fact.a}x${fact.b}`}
          role="img"
          aria-label={`${fact.a} times ${fact.b}`}
        >
          <span>{fact.a}</span>
          <Times />
          <span>{fact.b}</span>
        </div>
        <div className="slot" ref={slot}>
          {typed}
        </div>
      </div>
      <div className="keypad" ref={pad}>
        {DIGITS.map((d) => keyButton(d))}
        {keyButton("0", "wide")}
        {keyButton("back")}
      </div>
      <button className="tag quit" type="button" aria-label="Quit round" onClick={onQuit}>
        <Back />
      </button>
    </main>
  );
}
