import { useEffect, useState } from "react";
import { fx } from "./fx/ink";
import { sfx } from "./fx/sfx";
import {
  type Config,
  type Round,
  type RoundResult,
  bestFor,
  loadConfig,
  loadRounds,
  saveConfig,
  saveRounds,
} from "./game/storage";
import { Play } from "./screens/Play";
import { Results } from "./screens/Results";
import { Start } from "./screens/Start";

type Screen =
  | { name: "start" }
  | { name: "play" }
  | { name: "results"; result: RoundResult; previousBest: number | null };

export function App() {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [rounds, setRounds] = useState<Round[]>(loadRounds);
  const [screen, setScreen] = useState<Screen>({ name: "start" });

  useEffect(() => {
    sfx.enabled = config.sound;
    saveConfig(config);
  }, [config]);

  const startRound = () => {
    sfx.unlock();
    fx.clear();
    setScreen({ name: "play" });
  };

  const finishRound = (result: RoundResult) => {
    const next = [
      ...rounds,
      {
        at: Date.now(),
        correct: result.correct,
        attempted: result.attempted,
        durationSec: config.durationSec,
        target: config.target,
        tables: config.tables,
      },
    ];
    setRounds(next);
    saveRounds(next);
    setScreen({ name: "results", result, previousBest: bestFor(rounds, config) });
  };

  const goHome = () => setScreen({ name: "start" });

  if (screen.name === "play") {
    return <Play config={config} onDone={finishRound} onQuit={goHome} />;
  }
  if (screen.name === "results") {
    return (
      <Results
        result={screen.result}
        config={config}
        previousBest={screen.previousBest}
        onAgain={startRound}
        onHome={goHome}
      />
    );
  }
  return (
    <Start
      config={config}
      best={bestFor(rounds, config)}
      onConfig={setConfig}
      onStart={startRound}
    />
  );
}
