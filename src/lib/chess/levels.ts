import type { ClockId, Difficulty } from "./types";

export const LEVELS: Record<
  Difficulty,
  { label: string; blurb: string; depth: number; movetime: number; noise: number; quiesce: boolean }
> = {
  novice: { label: "Novice", blurb: "Plays loose", depth: 1, movetime: 200, noise: 0.72, quiesce: false },
  casual: { label: "Casual", blurb: "Sees one reply", depth: 2, movetime: 450, noise: 0.2, quiesce: false },
  club: { label: "Club", blurb: "Punishes slips", depth: 3, movetime: 800, noise: 0.04, quiesce: true },
  strong: { label: "Strong", blurb: "Hunts tactics", depth: 4, movetime: 1400, noise: 0, quiesce: true },
  master: { label: "Master", blurb: "Slow and sharp", depth: 5, movetime: 2200, noise: 0, quiesce: true },
};

export const LEVEL_ORDER: Difficulty[] = ["novice", "casual", "club", "strong", "master"];

export const CLOCKS: { id: ClockId; label: string }[] = [
  { id: "off", label: "None" },
  { id: "10", label: "10 min" },
  { id: "5", label: "5 min" },
  { id: "3+2", label: "3+2" },
  { id: "1", label: "1 min" },
];

export function clockParts(id: ClockId): { ms: number; inc: number } | null {
  switch (id) {
    case "off":
      return null;
    case "10":
      return { ms: 10 * 60 * 1000, inc: 0 };
    case "5":
      return { ms: 5 * 60 * 1000, inc: 0 };
    case "3+2":
      return { ms: 3 * 60 * 1000, inc: 2000 };
    case "1":
      return { ms: 60 * 1000, inc: 0 };
  }
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped > 0 && clamped < 10_000) {
    return (Math.ceil(clamped / 100) / 10).toFixed(1);
  }
  const total = Math.ceil(clamped / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
