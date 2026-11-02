import { Chess } from "chess.js";

export type Puzzle = {
  id: string;
  title: string;
  detail: string;
  fen: string;
  line: string[];
};

function fenAfter(sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

function mate(fen: string, line: string[]): string {
  const chess = new Chess(fen);
  for (const san of line) chess.move(san);
  if (!chess.isCheckmate()) throw new Error(`Puzzle line is not checkmate: ${fen}`);
  return fen;
}

export const PUZZLES: Puzzle[] = [
  {
    id: "scholar",
    title: "Scholar's mate",
    detail: "The queen and the bishop both land on f7.",
    fen: mate(fenAfter(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"]), ["Qxf7#"]),
    line: ["Qxf7#"],
  },
  {
    id: "back-rank",
    title: "Back rank",
    detail: "The king is boxed in by its own pawns.",
    fen: mate("6k1/5ppp/8/8/8/8/8/R6K w - - 0 1", ["Ra8#"]),
    line: ["Ra8#"],
  },
  {
    id: "queen-king",
    title: "Queen and king",
    detail: "The king guards the queen so she can sit beside the enemy king.",
    fen: mate("7k/8/5QK1/8/8/8/8/8 w - - 0 1", ["Qg7#"]),
    line: ["Qg7#"],
  },
  {
    id: "corner",
    title: "Corner rook",
    detail: "A rook on the eighth rank, with the king cutting off the escape.",
    fen: mate("k7/8/1K6/8/8/8/8/7R w - - 0 1", ["Rh8#"]),
    line: ["Rh8#"],
  },
  {
    id: "promote",
    title: "Promote",
    detail: "A pawn on the last rank can become a queen.",
    fen: mate("7k/4P3/6K1/8/8/8/8/8 w - - 0 1", ["e8=Q#"]),
    line: ["e8=Q#"],
  },
  {
    id: "smothered",
    title: "Smothered mate",
    detail: "The knight jumps in. The king's own pieces block every square.",
    fen: mate("6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", ["Nf7#"]),
    line: ["Nf7#"],
  },
  {
    id: "step-in",
    title: "Step in",
    detail: "Sometimes the king itself delivers the finish.",
    fen: mate("k7/1p6/2K5/8/8/Q7/8/8 w - - 0 1", ["Kc7#"]),
    line: ["Kc7#"],
  },
  {
    id: "bishops",
    title: "Bishop pair",
    detail: "Two bishops and a king can close the corner.",
    fen: mate("k7/8/1KB5/2B5/8/8/8/8 w - - 0 1", ["Kc7#"]),
    line: ["Kc7#"],
  },
];
