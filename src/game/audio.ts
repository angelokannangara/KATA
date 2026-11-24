/**
 * KATA: Ink & Echo — Web Audio API Synthesizer
 * Zero external audio files: synthesizes whooshes, impact thuds, parry clangs,
 * KO gong, skill chimes, and a meditative pentatonic bamboo flute + taiko loop.
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.65;
  private musicEnabled = true;
  private ambientTimer: number | null = null;
  private ambientStep = 0;
  private recDest: MediaStreamAudioDestinationNode | null = null;

  public init(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.0;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Audio stream of everything the engine plays (used by the story film recorder). */
  public getRecordingStream(): MediaStream | null {
    this.init();
    if (!this.ctx || !this.masterGain) return null;
    if (!this.recDest) {
      this.recDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.recDest);
    }
    return this.recDest.stream;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopAmbientLoop();
    }
  }

  public startAmbientLoop(): void {
    if (!this.musicEnabled || this.ambientTimer !== null || typeof window === 'undefined') {
      return;
    }
    this.ambientTimer = window.setInterval(() => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      this.playAmbientPulse();
    }, 680);
  }

  public stopAmbientLoop(): void {
    if (this.ambientTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  private playAmbientPulse(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const step = this.ambientStep++;

    // Soft Taiko pulse on beats 0 and 3 of 6-beat measure
    if (step % 6 === 0 || step % 6 === 3) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = step % 6 === 0 ? 74 : 64;
      osc.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.28);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(step % 6 === 0 ? 0.16 : 0.1, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);
    }

    // Japanese Yo/Hirajoshi pentatonic bamboo flute phrase every ~2 beats
    const scale = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33]; // D4, E4, G4, A4, C5, D5
    const pattern = [0, -1, 2, 3, -1, 4, 2, -1, 1, -1, 3, 5];
    const idx = pattern[step % pattern.length];
    if (idx >= 0) {
      const freq = scale[idx];
      const osc = this.ctx.createOscillator();
      const breath = this.ctx.createBufferSource();
      const breathFilter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const breathGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 0.985, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.14);

      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.2);

      if (this.noiseBuffer) {
        breath.buffer = this.noiseBuffer;
        breathFilter.type = 'bandpass';
        breathFilter.frequency.setValueAtTime(freq * 2.2, now);
        breathFilter.Q.value = 6;
        breathGain.gain.setValueAtTime(0.0005, now);
        breathGain.gain.linearRampToValueAtTime(0.018, now + 0.12);
        breathGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.9);
        breath.connect(breathFilter);
        breathFilter.connect(breathGain);
        breathGain.connect(this.masterGain);
        breath.start(now);
        breath.stop(now + 0.95);
      }
    }
  }

  public playWhoosh(heavy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = heavy ? 1.8 : 2.6;
    filter.frequency.setValueAtTime((heavy ? 380 : 620) * pitchVar, now);
    filter.frequency.exponentialRampToValueAtTime((heavy ? 180 : 280) * pitchVar, now + (heavy ? 0.22 : 0.13));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(heavy ? 0.22 : 0.14, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.24 : 0.14));

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.26);
  }

  public playHit(heavy = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;

    // Low body thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((heavy ? 165 : 210) * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 42 : 68, now + (heavy ? 0.18 : 0.11));
    gain.gain.setValueAtTime(heavy ? 0.42 : 0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.2 : 0.12));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);

    // Crisp slap transient
    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(heavy ? 1800 : 2400, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(heavy ? 0.25 : 0.15, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.masterGain);
      n.start(now);
      n.stop(now + 0.08);
    }
  }

  public playBlock(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playParryClang(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Metallic inharmonic bell partials for crisp parry ring
    const freqs = [920, 1465, 2310, 3120];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, now + 0.55);
      gain.gain.setValueAtTime(0.18 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  public playStanceSwitch(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSkillTrigger(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1600, now);
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(f);
    f.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playStep(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 * (0.9 + Math.random() * 0.2), now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.05);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playGong(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [110, 165, 224, 338];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 1.5);
      gain.gain.setValueAtTime(0.22 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.65);
    });
  }
}

export const soundEngine = new SoundEngine();
