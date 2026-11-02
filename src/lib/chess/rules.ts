import { Chess, type Move, type Square } from "chess.js";
import type { Color, Mode, MoveRec, Promotion, Result } from "./types";

export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function replay(startFen: string, moves: MoveRec[]): Chess {
  const chess = new Chess(startFen);
  for (const step of moves) {
    chess.move({
      from: step.from as Square,
      to: step.to as Square,
      promotion: step.promotion,
    });
  }
  return chess;
}

export function classify(chess: Chess): Result | null {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    return { kind: "checkmate", winner: chess.turn() === "w" ? "b" : "w" };
  }
  if (chess.isStalemate()) return { kind: "stalemate", winner: "draw" };
  if (chess.isThreefoldRepetition()) return { kind: "repetition", winner: "draw" };
  if (chess.isInsufficientMaterial()) return { kind: "insufficient", winner: "draw" };
  if (chess.isDrawByFiftyMoves()) return { kind: "fifty", winner: "draw" };
  return { kind: "draw", winner: "draw" };
}

export function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

export function balance(chess: Chess): number {
  let score = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const value = VALUE[piece.type] ?? 0;
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

export function capturedPieces(moves: MoveRec[], by: Color): string[] {
  const order = "qrnbp";
  return moves
    .filter((move) => move.color === by && move.captured)
    .map((move) => move.captured as string)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function pieceSrc(color: Color, type: string): string {
  return `/pieces/${color}${type.toUpperCase()}.svg`;
}

export function castleRook(move: { castle: "k" | "q" | null; from: string }): { from: string; to: string } | null {
  if (!move.castle) return null;
  const rank = move.from[1] ?? "1";
  if (move.castle === "k") return { from: `h${rank}`, to: `f${rank}` };
  return { from: `a${rank}`, to: `d${rank}` };
}

export function toRecord(played: Move, clocksBefore: { w: number; b: number } | null): MoveRec {
  return {
    from: played.from,
    to: played.to,
    promotion: played.promotion as Promotion | undefined,
    san: played.san,
    color: played.color,
    captured: played.captured,
    castle: played.isKingsideCastle() ? "k" : played.isQueensideCastle() ? "q" : null,
    clocksBefore: clocksBefore ? { ...clocksBefore } : null,
  };
}

export function resultCopy(result: Result, mode: Mode, human: Color): { title: string; detail: string } {
  if (result.kind === "solved") return { title: "Solved", detail: "That's checkmate." };
  const drawDetail: Record<string, string> = {
    stalemate: "Stalemate is a draw, not a win.",
    repetition: "The same position happened three times.",
    insufficient: "Not enough material left to force mate.",
    fifty: "Fifty moves with no capture or pawn move.",
    draw: "The game is drawn.",
  };
  if (result.winner === "draw") {
    return { title: "Draw", detail: drawDetail[result.kind] ?? "The game is drawn." };
  }
  if (mode === "ai") {
    const youWon = result.winner === human;
    const detail =
      result.kind === "resign"
        ? "You resigned."
        : result.kind === "timeout"
          ? youWon
            ? "The computer ran out of time."
            : "Your clock ran out."
          : "Checkmate.";
    return { title: youWon ? "You win" : "You lose", detail };
  }
  const name = result.winner === "w" ? "White" : "Black";
  const detail =
    result.kind === "resign" ? `${result.winner === "w" ? "Black" : "White"} resigned.` : result.kind === "timeout" ? `${result.winner === "w" ? "Black" : "White"} ran out of time.` : "Checkmate.";
  return { title: `${name} wins`, detail };
}

export function statusLine(input: {
  result: Result | null;
  mode: Mode;
  thinking: boolean;
  note: string | null;
  inCheck: boolean;
  turn: Color;
  human: Color;
  puzzleTitle: string | null;
  mateIn: number | null;
}): string {
  if (input.note) return input.note;
  if (input.result) return resultCopy(input.result, input.mode, input.human).title;
  if (input.thinking) return "Thinking";
  if (input.mode === "puzzle" && input.puzzleTitle) {
    return input.mateIn ? `${input.puzzleTitle} · mate in ${input.mateIn}` : input.puzzleTitle;
  }
  if (input.inCheck) return "Check";
  if (input.mode === "ai") return input.turn === input.human ? "Your move" : "Computer to move";
  return input.turn === "w" ? "White to move" : "Black to move";
}
