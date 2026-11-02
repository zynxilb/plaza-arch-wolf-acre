let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type SoundKind = "move" | "capture" | "castle" | "check" | "promote" | "end" | "illegal" | "solve";

export function playSound(kind: SoundKind) {
  unlockAudio();
  if (!ctx) return;
  switch (kind) {
    case "move":
      tone(540, 0.05, "sine", 0.03);
      break;
    case "capture":
      tone(180, 0.08, "triangle", 0.05);
      tone(120, 0.09, "sine", 0.03, 0.02);
      break;
    case "castle":
      tone(420, 0.06, "sine", 0.03);
      tone(560, 0.07, "sine", 0.025, 0.05);
      break;
    case "check":
      tone(680, 0.06, "sine", 0.03);
      tone(820, 0.08, "sine", 0.03, 0.07);
      break;
    case "promote":
      tone(520, 0.06, "sine", 0.03);
      tone(780, 0.1, "sine", 0.03, 0.06);
      break;
    case "solve":
      tone(523, 0.08, "sine", 0.03);
      tone(659, 0.1, "sine", 0.03, 0.09);
      tone(784, 0.14, "sine", 0.03, 0.18);
      break;
    case "end":
      tone(392, 0.1, "sine", 0.03);
      tone(311, 0.16, "sine", 0.03, 0.1);
      break;
    case "illegal":
      tone(140, 0.09, "square", 0.02);
      break;
  }
}
