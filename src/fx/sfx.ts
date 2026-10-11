type ToneOptions = {
  type?: OscillatorType;
  /** Seconds from now. */
  at?: number;
  dur?: number;
  gain?: number;
  /** Frequency to slide to by the end of the note. */
  to?: number;
};

/** Semitone steps of a major pentatonic scale; any run of them sounds fine. */
const SCALE = [0, 2, 4, 7, 9];
const C5 = 523.25;

const note = (step: number) => {
  const semitones = (SCALE[step % SCALE.length] ?? 0) + 12 * Math.floor(step / SCALE.length);
  return C5 * 2 ** (semitones / 12);
};

/** Every sound is synthesized, so there are no audio files to load. */
class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** Browsers only allow audio after a tap or key press; call this from one. */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(this.ctx.createDynamicsCompressor()).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  tap() {
    this.tone(430 + Math.random() * 40, { type: "sine", dur: 0.06, gain: 0.14, to: 300 });
  }

  /** Climbs the scale as the streak grows. */
  correct(streak: number) {
    const freq = note(Math.min(Math.max(streak, 1) - 1, 12));
    this.tone(freq, { dur: 0.2, gain: 0.26 });
    this.tone(freq * 1.5, { type: "sine", at: 0.06, dur: 0.22, gain: 0.16 });
  }

  splat() {
    this.noise({ dur: 0.2, gain: 0.3, from: 2200, to: 180 });
    this.tone(170, { type: "sine", dur: 0.14, gain: 0.3, to: 55 });
  }

  cheer() {
    [0, 2, 4, 5].forEach((step, i) =>
      this.tone(note(step), { at: i * 0.07, dur: 0.18, gain: 0.2 }),
    );
  }

  /** One step of the score counting up; `progress` runs 0 to 1 toward the goal. */
  tick(progress: number) {
    this.tone(380 + 700 * Math.min(1, progress), { type: "square", dur: 0.05, gain: 0.06 });
  }

  finish() {
    [2, 4, 5].forEach((step, i) => this.tone(note(step), { at: i * 0.11, dur: 0.3, gain: 0.22 }));
  }

  win() {
    [0, 2, 4, 5, 7, 9, 10].forEach((step, i) =>
      this.tone(note(step), { at: i * 0.09, dur: i === 6 ? 0.9 : 0.22, gain: 0.24 }),
    );
    this.tone(note(5) / 2, { type: "sawtooth", at: 0.54, dur: 0.9, gain: 0.08 });
  }

  private tone(freq: number, options: ToneOptions) {
    if (!this.enabled || !this.ctx || !this.out) return;
    const t0 = this.ctx.currentTime + (options.at ?? 0);
    const dur = options.dur ?? 0.15;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = options.type ?? "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.2, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of noise through a closing low-pass filter: the wet part of a splat. */
  private noise(options: { dur: number; gain: number; from: number; to: number }) {
    if (!this.enabled || !this.ctx || !this.out) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate / 2, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(options.from, t0);
    filter.frequency.exponentialRampToValueAtTime(options.to, t0 + options.dur);
    gain.gain.setValueAtTime(options.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + options.dur);
    source.connect(filter).connect(gain).connect(this.out);
    source.start(t0);
    source.stop(t0 + options.dur + 0.02);
  }
}

export const sfx = new Sfx();
