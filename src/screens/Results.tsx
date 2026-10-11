import { useEffect, useRef, useState } from "react";
import { fx } from "../fx/ink";
import { punch } from "../fx/motion";
import { sfx } from "../fx/sfx";
import { answerOf } from "../game/facts";
import { type Config, type RoundResult, formatDuration } from "../game/storage";

type Props = {
  result: RoundResult;
  config: Config;
  /** Best score before this round, or null if this was the first. */
  previousBest: number | null;
  onAgain: () => void;
  onHome: () => void;
};

export function Results({ result, config, previousBest, onAgain, onHome }: Props) {
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(false);
  const tally = useRef<HTMLDivElement>(null);
  const score = useRef<HTMLParagraphElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const greeted = useRef(false);

  const hit = result.correct >= config.target;
  const newBest = previousBest !== null && result.correct > previousBest;

  useEffect(() => {
    if (!greeted.current) {
      greeted.current = true;
      sfx.finish();
      fx.shout("Time!", tally.current?.getBoundingClientRect().top ?? 0);
    }

    const start = performance.now() + 700;
    const duration = Math.min(2400, 300 + result.correct * 40);
    let last = 0;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const n = Math.round(t * result.correct);
      if (n !== last) {
        last = n;
        setShown(n);
        sfx.tick(n / config.target);
        punch(score.current, 1.06);
      }
      if (t < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      setSettled(true);
      if (hit) {
        sfx.win();
        fx.storm(24, () => sfx.splat());
      } else {
        sfx.cheer();
        fx.storm(3);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [result.correct, config.target, hit]);

  useEffect(() => {
    if (settled) again.current?.focus();
  }, [settled]);

  return (
    <main className="screen results">
      <div className="sticker tally" ref={tally}>
        <p className="score" ref={score}>
          {shown}
        </p>
        <p className="score-label">right in {formatDuration(config.durationSec)}</p>
      </div>

      {/* Held back until the count finishes, so a stray tap can't restart. */}
      <div className="after" inert={!settled}>
        <p className="verdict">
          {hit ? (
            `You hit ${config.target}!`
          ) : (
            <>
              <span>Can you reach {config.target}?</span> <span>Keep trying!</span>
            </>
          )}
        </p>
        {previousBest !== null && (
          <p className="tag">
            {newBest ? `New best! It was ${previousBest}.` : `Best so far: ${previousBest}`}
          </p>
        )}
        <button className="sticker go" type="button" ref={again} onClick={onAgain}>
          Play again
        </button>
        {result.missed.length > 0 && (
          <div className="missed">
            <p className="tag">Worth another look</p>
            <ul>
              {result.missed.map((f) => (
                <li key={`${f.a}x${f.b}`}>
                  {f.a} × {f.b} = {answerOf(f)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="tag" type="button" onClick={onHome}>
          Back to start
        </button>
      </div>
    </main>
  );
}
