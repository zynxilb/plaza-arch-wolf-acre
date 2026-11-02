export type Color = "w" | "b";

export type Promotion = "q" | "r" | "b" | "n";

export type Mode = "ai" | "local" | "puzzle";

export type Difficulty = "novice" | "casual" | "club" | "strong" | "master";

export type SidePref = "w" | "b" | "random";

export type ClockId = "off" | "10" | "5" | "3+2" | "1";

export type ResultKind =
  | "checkmate"
  | "stalemate"
  | "repetition"
  | "insufficient"
  | "fifty"
  | "draw"
  | "resign"
  | "timeout"
  | "solved";

export type Result = {
  kind: ResultKind;
  /** Side that won, or "draw". */
  winner: Color | "draw";
};

export type MoveRec = {
  from: string;
  to: string;
  promotion?: Promotion;
  san: string;
  color: Color;
  captured?: string;
  castle: "k" | "q" | null;
  /** Clocks (ms) just before this move was played. */
  clocksBefore: { w: number; b: number } | null;
};

export type EngineMove = {
  from: string;
  to: string;
  promotion?: Promotion;
  san: string;
};

export type RecordScore = { win: number; loss: number; draw: number };
