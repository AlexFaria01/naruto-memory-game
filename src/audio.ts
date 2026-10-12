// Original Konoha-inspired background theme, synthesized live with Web Audio.
// Pentatonic flute lead + koto arps + bass + taiko drums. No audio files needed.

export type MusicMode = "menu" | "battle" | "urgent";
export type SfxName =
  | "start" | "flip" | "match" | "miss" | "turn" | "shuffle" | "win" | "lose"
  | "tick" | "peek" | "rasengan" | "sage" | "perfect" | "click" | "count" | "unlock" | "bonus";

const BPM = 100;
const STEP = 60 / BPM / 4; // 16th note
const LOOP_STEPS = 64;

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// One 4-bar loop. Chord roots + koto tones per bar.
const BAR_ROOTS = [38, 34, 41, 36]; // Dm Bb F C
const BAR_TONES = [
  [62, 65, 69, 72],
  [58, 62, 65, 70],
  [65, 69, 72, 77],
  [60, 67, 69, 72],
];
// Original sparse flute motif: [step, midi, lenSteps]
const MELODY: Array<[number, number, number]> = [
  [0, 74, 4], [6, 77, 2], [8, 79, 4], [14, 81, 2],
  [16, 84, 6], [24, 81, 2], [26, 79, 2], [28, 77, 4],
  [32, 79, 4], [36, 81, 2], [40, 84, 4], [46, 86, 2],
  [48, 84, 4], [52, 81, 2], [54, 79, 2], [56, 77, 2], [58, 74, 6],
];

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readVolume(key: string, fallback: number): number {
  const value = Number(read(key, String(fallback)));
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

class KonohaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private mode: MusicMode = "menu";

  musicOn = read("nmq-music-on", "1") === "1";
  sfxOn = read("nmq-sfx-on", "1") === "1";
  musicVol = readVolume("nmq-music-vol", 0.7);
  sfxVol = readVolume("nmq-sfx-vol", 0.9);

  /** Create context + start scheduler. Must be called from a user gesture first. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 6;
        comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(comp);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? this.musicVol * 0.9 : 0;
        this.musicBus.connect(this.master);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = this.sfxOn ? this.sfxVol : 0;
        this.sfxBus.connect(this.master);
        // Spacey slap-back for the flute
        const delay = ctx.createDelay(1);
        delay.delayTime.value = 0.31;
        const fb = ctx.createGain();
        fb.gain.value = 0.32;
        const wet = ctx.createGain();
        wet.gain.value = 0.22;
        this.delaySend = ctx.createGain();
        this.delaySend.gain.value = 1;
        this.delaySend.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        wet.connect(this.musicBus);
        // Shared noise buffer for drums
        const len = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.timer === null && this.ctx) {
        this.step = 0;
        this.nextTime = this.ctx.currentTime + 0.08;
        this.timer = window.setInterval(() => this.schedule(), 30);
      }
    } catch {
      /* audio unavailable */
    }
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    write("nmq-music-on", on ? "1" : "0");
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(on ? this.musicVol * 0.9 : 0, this.ctx.currentTime, 0.15);
    }
  }
  setSfxOn(on: boolean) {
    this.sfxOn = on;
    write("nmq-sfx-on", on ? "1" : "0");
    if (this.ctx && this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(on ? this.sfxVol : 0, this.ctx.currentTime, 0.05);
    }
  }
  setMusicVolume(v: number) {
    this.musicVol = v;
    write("nmq-music-vol", String(v));
    if (this.ctx && this.musicBus && this.musicOn) {
      this.musicBus.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.08);
    }
  }
  setSfxVolume(v: number) {
    this.sfxVol = v;
    write("nmq-sfx-vol", String(v));
    if (this.ctx && this.sfxBus && this.sfxOn) {
      this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }
  setMode(mode: MusicMode) {
    this.mode = mode;
  }

  // ---------------------------------------------------------- sequencer
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.timer === null) return;
    while (this.nextTime < ctx.currentTime + 0.16) {
      if (this.musicOn) this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % LOOP_STEPS;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const barStep = step % 16;
    const mode = this.mode;
    // Flute melody
    for (const [s, m, len] of MELODY) {
      if (s === step) this.flute(midi(m), t, len * STEP * 0.92, mode === "menu" ? 0.16 : 0.19);
    }
    // Koto arps
    const tones = BAR_TONES[bar] ?? BAR_TONES[0];
    if (step % 4 === 0 && (mode !== "menu" || step % 8 === 0)) {
      const idx = (step / 4) % 4;
      this.koto(midi(tones[idx] ?? tones[0]), t, mode === "menu" ? 0.09 : 0.11);
    }
    // Bass
    const root = midi(BAR_ROOTS[bar] ?? BAR_ROOTS[0]);
    if (barStep === 0) this.bass(root, t, STEP * 6, 0.16);
    else if (barStep === 8) this.bass(root, t, STEP * 3, 0.11);
    else if (mode !== "menu" && (barStep === 4 || barStep === 12)) this.bass(root, t, STEP * 2, 0.08);
    // Pad swell at bar starts
    if (barStep === 0) this.pad([root * 2, root * 3], t, STEP * 14, 0.028);
    // Drums
    if (mode === "menu") {
      if (barStep === 0) this.taiko(t, true, 0.5);
      if (barStep % 8 === 0) this.shaker(t, 0.1);
    } else if (mode === "battle") {
      if (barStep === 0) this.taiko(t, true, 0.6);
      else if (barStep === 8) this.taiko(t, true, 0.45);
      if (barStep === 4 || barStep === 12) this.taiko(t, false, 0.32);
      if (step % 2 === 0) this.shaker(t, barStep % 4 === 0 ? 0.11 : 0.07);
    } else {
      if (barStep % 4 === 0) this.taiko(t, true, 0.65);
      if (barStep % 4 === 2) this.taiko(t, false, 0.38);
      if (step % 2 === 0) this.shaker(t, 0.13);
    }
  }

  // ---------------------------------------------------------- instruments
  private flute(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = freq;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freq * 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfoGain.connect(osc2.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.09);
    gain.gain.setValueAtTime(vol, t + Math.max(0.09, dur - 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    osc.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    if (this.delaySend) gain.connect(this.delaySend);
    osc.start(t);
    osc2.start(t);
    lfo.start(t);
    const stop = t + dur + 0.15;
    osc.stop(stop);
    osc2.stop(stop);
    lfo.stop(stop);
  }

  private koto(freq: number, t: number, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * 1.01, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  private bass(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private pad(freqs: number[], t: number, dur: number, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out) return;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 9;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private taiko(t: number, low: boolean, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const from = low ? 165 : 330;
    const to = low ? 48 : 120;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + (low ? 0.16 : 0.1));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.34 : 0.2));
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
    if (this.noiseBuf && low) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.35, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(lp);
      lp.connect(ng);
      ng.connect(out);
      src.start(t, Math.random() * 0.4);
      src.stop(t + 0.15);
    }
  }

  private shaker(t: number, vol: number) {
    const ctx = this.ctx, out = this.musicBus;
    if (!ctx || !out || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(out);
    src.start(t, Math.random() * 0.6);
    src.stop(t + 0.09);
  }

  // ---------------------------------------------------------- SFX
  play(name: SfxName) {
    if (!this.sfxOn) return;
    try {
      this.unlock();
      const ctx = this.ctx, out = this.sfxBus;
      if (!ctx || !out) return;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime + 0.01;
      const note = (freq: number, delay: number, dur: number, vol: number, type: OscillatorType = "sine", slideTo?: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + delay + dur);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.03);
      };
      const noise = (delay: number, dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "highpass") => {
        if (!this.noiseBuf) return;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const flt = ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.value = filterFreq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        src.connect(flt);
        flt.connect(gain);
        gain.connect(out);
        src.start(now + delay, Math.random() * 0.5);
        src.stop(now + delay + dur + 0.02);
      };

      switch (name) {
        case "flip": note(420, 0, 0.075, 0.035, "triangle"); break;
        case "click": note(660, 0, 0.05, 0.03, "triangle"); break;
        case "count": note(880, 0, 0.09, 0.05, "square"); break;
        case "unlock":
          [740, 988, 1480].forEach((f, i) => note(f, i * 0.07, 0.22, 0.04, "triangle"));
          break;
        case "bonus":
          [784, 1175, 1568].forEach((f, i) => note(f, i * 0.045, 0.15, 0.027, "sine"));
          break;
        case "tick": note(1350, 0, 0.045, 0.045, "square"); break;
        case "start":
          note(330, 0, 0.13, 0.055, "triangle");
          note(495, 0.08, 0.17, 0.045, "triangle");
          break;
        case "match":
          note(523, 0, 0.18, 0.065, "triangle");
          note(784, 0.09, 0.26, 0.06, "sine");
          note(1047, 0.18, 0.3, 0.045, "sine");
          break;
        case "miss":
          note(180, 0, 0.16, 0.04, "triangle");
          note(135, 0.08, 0.18, 0.025, "sine");
          break;
        case "turn":
          note(294, 0, 0.12, 0.035, "triangle");
          note(392, 0.09, 0.16, 0.03, "triangle");
          break;
        case "shuffle":
          [392, 494, 587, 740].forEach((f, i) => note(f, i * 0.045, 0.11, 0.03, "square"));
          break;
        case "peek":
          note(620, 0, 0.14, 0.05, "sine");
          note(930, 0.09, 0.16, 0.045, "sine");
          note(1240, 0.18, 0.26, 0.05, "triangle");
          noise(0, 0.4, 0.02, 5000);
          break;
        case "rasengan":
          note(180, 0, 0.45, 0.06, "sawtooth", 920);
          note(90, 0, 0.45, 0.05, "sine", 460);
          noise(0.05, 0.4, 0.05, 1200);
          note(1047, 0.42, 0.3, 0.05, "triangle");
          break;
        case "sage":
          note(98, 0, 1.1, 0.08, "sine");
          note(147, 0.02, 1.0, 0.05, "sine");
          note(196, 0.05, 0.8, 0.04, "triangle");
          [784, 988, 1175, 1568].forEach((f, i) => note(f, 0.1 + i * 0.07, 0.3, 0.03, "sine"));
          break;
        case "perfect":
          [523, 659, 784, 988, 1319].forEach((f, i) => note(f, i * 0.07, 0.3, 0.05, "triangle"));
          break;
        case "win":
          [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.1, 0.36, 0.06, "triangle"));
          [587, 880, 1175].forEach((f, i) => note(f, 0.42 + i * 0.08, 0.4, 0.035, "sine"));
          break;
        case "lose":
          note(220, 0, 0.45, 0.035, "sine");
          note(165, 0.15, 0.5, 0.03, "sine");
          break;
      }
    } catch {
      /* gameplay continues without audio */
    }
  }
}

export const audio = new KonohaAudio();
