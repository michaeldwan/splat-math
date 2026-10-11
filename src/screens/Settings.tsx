import { useEffect, useId, useRef } from "react";
import { FACTORS } from "../game/facts";
import { type Config, LIMITS, clamp, formatDuration } from "../game/storage";

type Props = {
  open: boolean;
  config: Config;
  onConfig: (config: Config) => void;
  onClose: () => void;
};

type StepperProps = {
  label: string;
  value: number;
  /** How the value reads on screen, when it isn't just the number. */
  display?: string;
  limits: { min: number; max: number; step: number };
  lessLabel: string;
  moreLabel: string;
  onChange: (value: number) => void;
};

function Stepper({ label, value, display, limits, lessLabel, moreLabel, onChange }: StepperProps) {
  const id = useId();
  return (
    <div className="setting">
      <span id={id}>{label}</span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-label={lessLabel}
          onClick={() => onChange(clamp(value - limits.step, limits))}
        >
          −
        </button>
        <output>{display ?? value}</output>
        <button
          type="button"
          aria-label={moreLabel}
          onClick={() => onChange(clamp(value + limits.step, limits))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Settings({ open, config, onConfig, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const toggleTable = (n: number) => {
    const tables = FACTORS.filter((f) => config.tables.includes(f) !== (f === n));
    // At least one table has to stay on, or there'd be nothing to ask.
    if (tables.length > 0) onConfig({ ...config, tables });
  };

  return (
    <dialog ref={dialog} className="sticker settings" onClose={onClose}>
      <h2>Settings</h2>

      <Stepper
        label="Round length"
        value={config.durationSec}
        display={formatDuration(config.durationSec)}
        limits={LIMITS.durationSec}
        lessLabel="Shorter round"
        moreLabel="Longer round"
        onChange={(durationSec) => onConfig({ ...config, durationSec })}
      />
      <Stepper
        label="Goal, in right answers"
        value={config.target}
        limits={LIMITS.target}
        lessLabel="Lower goal"
        moreLabel="Higher goal"
        onChange={(target) => onConfig({ ...config, target })}
      />

      <div className="setting stacked">
        <span id="tables-label">Times tables to practice</span>
        <div className="tables" role="group" aria-labelledby="tables-label">
          {FACTORS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={config.tables.includes(n)}
              onClick={() => toggleTable(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="setting">
        <span>Sound</span>
        <input
          type="checkbox"
          checked={config.sound}
          onChange={(e) => onConfig({ ...config, sound: e.target.checked })}
        />
      </label>

      <button className="sticker done" type="button" onClick={onClose}>
        Done
      </button>
      <a
        className="source"
        href="https://github.com/michaeldwan/splat-math"
        target="_blank"
        rel="noreferrer"
      >
        Source code on GitHub
      </a>
    </dialog>
  );
}
