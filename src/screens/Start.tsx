import { type MouseEvent, useEffect, useState } from "react";
import { fx } from "../fx/ink";
import { sfx } from "../fx/sfx";
import { type Config, formatDuration } from "../game/storage";
import { Gear } from "./Icons";
import { Settings } from "./Settings";

/** Where the opening splats land, as fractions of the screen. */
const OPENING = [
  { x: 0.2, y: 0.24, scale: 1.35 },
  { x: 0.82, y: 0.34, scale: 1.15 },
  { x: 0.26, y: 0.8, scale: 1.1 },
  { x: 0.76, y: 0.82, scale: 1.25 },
];

/** The opening splats land once per page load, not on every visit to this screen. */
let opened = false;

type Props = {
  config: Config;
  best: number | null;
  onConfig: (config: Config) => void;
  onStart: () => void;
};

export function Start({ config, best, onConfig, onStart }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!opened) {
      OPENING.forEach((spot, i) => {
        fx.later(250 + i * 170, () =>
          fx.splat(spot.x * fx.width, spot.y * fx.height, { scale: spot.scale }),
        );
      });
    }
    opened = true;
  }, []);

  useEffect(() => {
    if (settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.target instanceof HTMLButtonElement) return;
      onStart();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [settingsOpen, onStart]);

  // The wall is a toy: tapping anywhere that isn't a control splats it. It
  // listens for clicks, like the controls: taps handled on pointer-down went
  // missing on a touch device.
  const splatWall = (e: MouseEvent) => {
    if ((e.target as Element).closest("button, dialog")) return;
    sfx.unlock();
    sfx.splat();
    fx.splat(e.clientX, e.clientY);
  };

  return (
    <main className="screen start" onClick={splatWall}>
      <h1 className="title">
        <span>Splat</span>
        <span>Math</span>
      </h1>
      <p className="sticker subtitle">Multiplication practice</p>
      <p className="pitch">
        <span>Every right answer splats the wall.</span> <span>How much can you cover?</span>
      </p>
      <button className="sticker go" type="button" onClick={onStart}>
        Start
      </button>
      <p className="round-info">
        {formatDuration(config.durationSec)} round
        {best !== null && <>, best so far {best}</>}
      </p>
      <button
        className="sticker corner"
        type="button"
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <Gear />
      </button>
      <Settings
        open={settingsOpen}
        config={config}
        onConfig={onConfig}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
