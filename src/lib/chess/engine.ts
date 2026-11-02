import { Chess, type Move, type Square } from "chess.js";
import type { Color, EngineMove, Promotion } from "./types";

const TIME = "time-up";

const VAL: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

/** Piece-square tables, index 0 = a8 … 63 = h1, from white's side. */
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
    5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5,
    0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
};

const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30,
  20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20,
  30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

const LINES: string[][] = [
  ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"],
  ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"],
  ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4"],
  ["e4", "e5", "Nf3", "Nf6", "Nxe5", "d6", "Nf3", "Nxe4"],
  ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"],
  ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6"],
  ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7"],
  ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"],
  ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6"],
  ["e4", "g6", "d4", "Bg7", "Nc3", "d6", "Nf3", "Nf6"],
  ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O"],
  ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "e6"],
  ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O"],
  ["d4", "Nf6", "c4", "e6", "Nf3", "b6", "g3", "Bb7", "Bg2"],
  ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O"],
  ["d4", "Nf6", "Nf3", "d5", "Bf4", "e6", "e3", "c5"],
  ["c4", "e5", "Nc3", "Nf6", "Nf3", "Nc6", "g3", "Bb4"],
  ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6", "O-O", "Be7"],
  ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4"],
];

let book: Map<string, string[]> | null = null;

function bookKey(chess: Chess): string {
  return chess.fen().split(" ").slice(0, 4).join(" ");
}

export function openingBook(): Map<string, string[]> {
  if (book) return book;
  const map = new Map<string, string[]>();
  for (const line of LINES) {
    const chess = new Chess();
    for (const san of line) {
      const key = bookKey(chess);
      const played = chess.move(san);
      const uci = played.from + played.to + (played.promotion ?? "");
      const list = map.get(key) ?? [];
      if (!list.includes(uci)) list.push(uci);
      map.set(key, list);
    }
  }
  book = map;
  return map;
}

type Internal = {
  from: number;
  to: number;
  piece: string;
  captured?: string;
  promotion?: Promotion;
  flags: number;
};

type FastChess = Chess & {
  _hash: number;
  _board: Record<number, { type: string; color: Color } | undefined>;
  _moves(): Internal[];
  _makeMove(move: Internal): void;
  _undoMove(): Internal | null;
  _incPositionCount(): void;
  _decPositionCount(hash: number): void;
};

const PROMOTE = 16;
const CASTLE = 96;

function fast(chess: Chess): FastChess {
  return chess as unknown as FastChess;
}

function algebraic(square: number): string {
  const file = square & 0xf;
  const rank = square >> 4;
  return "abcdefgh"[file]! + "87654321"[rank]!;
}

function mirrorIndex(color: Color, square: string): number {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  const row = color === "w" ? 7 - rank : rank;
  return row * 8 + file;
}

function evaluate(chess: Chess): number {
  const board = fast(chess)._board;
  let nongKing = 0;
  let queens = 0;
  const pieces: { color: Color; type: string; square: string }[] = [];
  for (let sq = 0; sq <= 119; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = board[sq];
    if (!piece) continue;
    pieces.push({ color: piece.color, type: piece.type, square: algebraic(sq) });
    if (piece.type !== "k") nongKing += VAL[piece.type] ?? 0;
    if (piece.type === "q") queens += 1;
  }
  const endgame = nongKing < 2200 && queens === 0;
  let white = 0;
  for (const piece of pieces) {
    const table = piece.type === "k" && endgame ? KING_END : PST[piece.type];
    const extra = table?.[mirrorIndex(piece.color, piece.square)] ?? 0;
    white += piece.color === "w" ? (VAL[piece.type] ?? 0) + extra : -((VAL[piece.type] ?? 0) + extra);
  }
  if (chess.inCheck()) white += chess.turn() === "w" ? -18 : 18;
  return chess.turn() === "w" ? white : -white;
}

function playFast(chess: FastChess, move: Internal) {
  chess._makeMove(move);
  chess._incPositionCount();
}

function undoFast(chess: FastChess) {
  const hash = chess._hash;
  chess._undoMove();
  chess._decPositionCount(hash);
}

function quiet(chess: Chess): boolean {
  return (
    chess.isDrawByFiftyMoves() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()
  );
}

function orderScore(move: Internal, hint: Internal | null): number {
  let score = 0;
  if (hint && move.from === hint.from && move.to === hint.to && move.promotion === hint.promotion) {
    score += 10_000;
  }
  if (move.captured) score += 10 * (VAL[move.captured] ?? 0) - (VAL[move.piece] ?? 0);
  if (move.flags & PROMOTE) score += move.promotion === "q" ? 900 : 200;
  if (move.flags & CASTLE) score += 50;
  return score;
}

function ordered(moves: Internal[], hint: Internal | null): Internal[] {
  return moves.sort((a, b) => orderScore(b, hint) - orderScore(a, hint));
}

export type SearchRequest = {
  startFen: string;
  moves: { from: string; to: string; promotion?: Promotion }[];
  depth: number;
  movetime: number;
  noise: number;
  useBook: boolean;
  quiesce: boolean;
};

let nodes = 0;

function negamax(
  chess: FastChess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  deadline: number,
  quiesceOn: boolean,
): number {
  nodes += 1;
  if ((nodes & 255) === 0 && performance.now() > deadline) throw TIME;
  if (quiet(chess)) return 0;

  const moves = chess._moves();
  if (moves.length === 0) return chess.inCheck() ? -100000 + ply : 0;
  if (depth <= 0) {
    if (!quiesceOn) return evaluate(chess);
    return quiesce(chess, alpha, beta, ply, deadline, 0);
  }

  ordered(moves, null);
  let best = -1_000_000;
  let a = alpha;
  for (const move of moves) {
    playFast(chess, move);
    const score = -negamax(chess, depth - 1, -beta, -a, ply + 1, deadline, quiesceOn);
    undoFast(chess);
    if (score > best) best = score;
    if (score > a) a = score;
    if (a >= beta) break;
  }
  return best;
}

function quiesce(
  chess: FastChess,
  alpha: number,
  beta: number,
  ply: number,
  deadline: number,
  qply: number,
): number {
  nodes += 1;
  if ((nodes & 255) === 0 && performance.now() > deadline) throw TIME;
  if (quiet(chess)) return 0;

  const inCheck = chess.inCheck();
  const moves = chess._moves();
  if (moves.length === 0) return inCheck ? -100000 + ply : 0;

  let a = alpha;
  if (!inCheck) {
    const stand = evaluate(chess);
    if (stand >= beta) return stand;
    if (stand > a) a = stand;
    if (qply >= 3) return a;
  }

  const tactical = inCheck ? moves : moves.filter((move) => move.captured || move.flags & PROMOTE);
  if (tactical.length === 0) return a;
  ordered(tactical, null);
  for (const move of tactical) {
    playFast(chess, move);
    const score = -quiesce(chess, -beta, -a, ply + 1, deadline, qply + 1);
    undoFast(chess);
    if (score >= beta) return score;
    if (score > a) a = score;
  }
  return a;
}

function rebuild(req: SearchRequest): Chess {
  const chess = new Chess(req.startFen);
  for (const step of req.moves) {
    chess.move({
      from: step.from as Square,
      to: step.to as Square,
      promotion: step.promotion,
    });
  }
  return chess;
}

function asEngine(move: Move): EngineMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    san: move.san,
  };
}

function pick(scored: { move: Internal; score: number }[], noise: number): Internal {
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) throw new Error("no moves");
  if (best.score > 9000) return best.move;
  if (noise >= 0.5 && Math.random() < 0.5) {
    const safe = scored.filter((row) => row.score > -8000);
    const pool = (safe.length > 0 ? safe : scored).slice(0, 8);
    return pool[Math.floor(Math.random() * pool.length)]!.move;
  }
  if (noise > 0 && Math.random() < noise) {
    const window = noise > 0.3 ? 250 : 90;
    const pool = scored.filter((row) => row.score >= best.score - window).slice(0, 4);
    return pool[Math.floor(Math.random() * pool.length)]!.move;
  }
  return best.move;
}

export function findBestMove(req: SearchRequest): EngineMove | null {
  const chess = rebuild(req);
  if (chess.isGameOver()) return null;
  const speed = fast(chess);

  if (req.useBook) {
    const choices = openingBook().get(bookKey(chess));
    if (choices && choices.length > 0) {
      const uci = choices[Math.floor(Math.random() * choices.length)]!;
      const played = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] as Promotion | undefined,
      });
      return asEngine(played);
    }
  }

  const deadline = performance.now() + req.movetime;
  nodes = 0;
  let completed: { move: Internal; score: number }[] | null = null;
  let hint: Internal | null = null;

  for (let depth = 1; depth <= req.depth; depth++) {
    const legal = speed._moves();
    const moves = ordered(legal.slice(), hint);
    const scored: { move: Internal; score: number }[] = [];
    try {
      for (const move of moves) {
        if (performance.now() > deadline && scored.length > 0) throw TIME;
        playFast(speed, move);
        const score = -negamax(speed, depth - 1, -1_000_000, 1_000_000, 1, deadline, req.quiesce);
        undoFast(speed);
        scored.push({ move, score });
      }
    } catch (err) {
      if (err !== TIME) throw err;
      break;
    }
    if (scored.length === legal.length && scored.length > 0) {
      scored.sort((a, b) => b.score - a.score);
      completed = scored;
      hint = scored[0]!.move;
    } else break;
  }

  const chosen = completed && completed.length > 0 ? pick(completed, req.noise) : speed._moves()[0];
  if (!chosen) return null;
  const played = chess.move({
    from: algebraic(chosen.from),
    to: algebraic(chosen.to),
    promotion: chosen.promotion,
  });
  return asEngine(played);
}

export function searchNodes(): number {
  return nodes;
}
