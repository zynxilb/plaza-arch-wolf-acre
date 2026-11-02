import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { clockParts, LEVELS } from "@/lib/chess/levels";
import { PUZZLES } from "@/lib/chess/puzzles";
import {
  balance,
  castleRook,
  classify,
  INITIAL_FEN,
  opposite,
  replay,
  resultCopy,
  statusLine,
  toRecord,
} from "@/lib/chess/rules";
import { findBestMove, type SearchRequest } from "@/lib/chess/engine";
import { playSound, type SoundKind } from "@/lib/chess/sounds";
import type { ClockId, Color, Difficulty, EngineMove, Mode, MoveRec, Promotion, Result, SidePref } from "@/lib/chess/types";

const KEY = "kingside-v1";

export type Persisted = {
  version: 1;
  startFen: string;
  moves: MoveRec[];
  mode: Mode;
  difficulty: Difficulty;
  humanColor: Color;
  sidePref: SidePref;
  clock: ClockId;
  clocks: { w: number; b: number } | null;
  clockRunning: boolean;
  result: Result | null;
  orientation: Color;
  autoflip: boolean;
  sound: boolean;
  puzzleIndex: number;
  viewCount: number | null;
  record: { win: number; loss: number; draw: number };
};

function fresh(over: Partial<Persisted> = {}): Persisted {
  return {
    version: 1,
    startFen: INITIAL_FEN,
    moves: [],
    mode: "ai",
    difficulty: "casual",
    humanColor: "w",
    sidePref: "w",
    clock: "off",
    clocks: null,
    clockRunning: false,
    result: null,
    orientation: "w",
    autoflip: true,
    sound: true,
    puzzleIndex: 0,
    viewCount: null,
    record: { win: 0, loss: 0, draw: 0 },
    ...over,
  };
}

function scoreRecord(record: Persisted["record"], result: Result, human: Color): Persisted["record"] {
  if (result.winner === "draw") return { ...record, draw: record.draw + 1 };
  if (result.winner === human) return { ...record, win: record.win + 1 };
  return { ...record, loss: record.loss + 1 };
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (data.version !== 1 || !Array.isArray(data.moves)) return null;
    replay(data.startFen, data.moves);
    return data;
  } catch {
    return null;
  }
}

function createEngineWorker() {
  return new Worker(new URL("../../lib/chess/engine.worker.ts", import.meta.url), { type: "module" });
}

export function useGame() {
  const [state, setState] = useState<Persisted>(() => fresh());
  const [hydrated, setHydrated] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [solving, setSolving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [anim, setAnim] = useState<{ token: number; steps: { from: string; to: string }[] } | null>(null);
  const [pgnText, setPgnText] = useState<string | null>(null);

  const modelRef = useRef(state);
  const clocksRef = useRef(state.clocks);
  const turnRef = useRef<Color>("w");
  const reqId = useRef(0);
  const replyToken = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const noteTimer = useRef(0);
  const animToken = useRef(0);

  modelRef.current = state;

  const shownCount = state.viewCount ?? state.moves.length;
  const viewing = state.viewCount != null && state.viewCount !== state.moves.length;
  const shown = useMemo(
    () => replay(state.startFen, state.moves.slice(0, shownCount)),
    [state.startFen, state.moves, shownCount],
  );
  const live = useMemo(() => replay(state.startFen, state.moves), [state.startFen, state.moves]);
  turnRef.current = live.turn();

  function publish(next: Persisted) {
    modelRef.current = next;
    clocksRef.current = next.clocks;
    setState(next);
  }

  function flash(text: string) {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      setNote((current) => (current === text ? null : current));
    }, 1500);
  }

  function stopSearch() {
    reqId.current += 1;
    replyToken.current += 1;
    workerRef.current?.terminate();
    setThinking(false);
    setSolving(false);
  }

  function animate(played: Move) {
    const rec = toRecord(played, null);
    const steps = [{ from: played.from, to: played.to }];
    const rook = castleRook(rec);
    if (rook) steps.push(rook);
    animToken.current += 1;
    setAnim({ token: animToken.current, steps });
  }

  function voice(played: Move, chess: Chess, mode: Mode) {
    if (!modelRef.current.sound) return;
    let kind: SoundKind = "move";
    if (mode === "puzzle" && chess.isCheckmate()) kind = "solve";
    else if (chess.isGameOver()) kind = "end";
    else if (chess.inCheck()) kind = "check";
    else if (played.isCastle()) kind = "castle";
    else if (played.isPromotion()) kind = "promote";
    else if (played.isCapture()) kind = "capture";
    playSound(kind);
  }

  function finish(prev: Persisted, played: Move, chess: Chess): Persisted {
    const clocksNow = clocksRef.current;
    const rec = toRecord(played, clocksNow);
    const moves = [...prev.moves, rec];
    let result = classify(chess);
    if (prev.mode === "puzzle" && result?.kind === "checkmate") {
      result = { kind: "solved", winner: played.color };
    }
    let clocks = clocksNow;
    let clockRunning = prev.clockRunning;
    if (clocks && prev.mode !== "puzzle") {
      const inc = clockParts(prev.clock)?.inc ?? 0;
      clocks = { ...clocks, [played.color]: (clocks[played.color] ?? 0) + inc };
      clockRunning = !result;
    }
    let record = prev.record;
    if (result && prev.mode === "ai" && !prev.result) record = scoreRecord(record, result, prev.humanColor);
    let orientation = prev.orientation;
    if (prev.mode === "local" && prev.autoflip && !result) orientation = chess.turn();
    return { ...prev, moves, clocks, clockRunning: Boolean(clockRunning && !result), result, orientation, record, viewCount: null };
  }

  function accept(played: Move, chess: Chess) {
    const next = finish(modelRef.current, played, chess);
    turnRef.current = chess.turn();
    publish(next);
    animate(played);
    voice(played, chess, modelRef.current.mode === next.mode ? next.mode : next.mode);
    setPending(null);
    setSelected(null);
    setHint(null);
    setNote(null);
  }

  function place(from: string, to: string, promotion?: Promotion) {
    const prev = modelRef.current;
    if (prev.result || viewing) return;
    const chess = replay(prev.startFen, prev.moves);
    const legal = chess.moves({ verbose: true }).filter((move) => move.from === from && move.to === to);
    if (legal.length === 0) {
      setShake((n) => n + 1);
      return;
    }
    if (legal.some((move) => move.isPromotion()) && !promotion) {
      setPending({ from, to });
      setSelected(from);
      return;
    }
    const choice = promotion ? legal.find((move) => move.promotion === promotion) : legal[0];
    if (!choice) {
      setShake((n) => n + 1);
      return;
    }
    if (prev.mode === "puzzle") {
      const puzzle = PUZZLES[prev.puzzleIndex];
      const trial = replay(prev.startFen, prev.moves);
      const played = trial.move({ from: from as Square, to: to as Square, promotion: choice.promotion });
      const expected = puzzle?.line[prev.moves.length];
      if (!trial.isCheckmate() && played.san !== expected) {
        setShake((n) => n + 1);
        flash("Not that move.");
        if (prev.sound) playSound("illegal");
        return;
      }
      stopSearch();
      accept(played, trial);
      if (!trial.isCheckmate() && puzzle) {
        const reply = puzzle.line[modelRef.current.moves.length];
        if (reply) schedule(reply);
      }
      return;
    }
    const played = chess.move({ from: from as Square, to: to as Square, promotion: choice.promotion });
    stopSearch();
    accept(played, chess);
  }

  function schedule(san: string) {
    const token = ++replyToken.current;
    window.setTimeout(() => {
      if (token !== replyToken.current) return;
      const cur = modelRef.current;
      try {
        const chess = replay(cur.startFen, cur.moves);
        const played = chess.move(san);
        accept(played, chess);
      } catch {
        /* defender reply no longer legal */
      }
    }, 420);
  }

  function build(prefs: Persisted, patch: Partial<Pick<Persisted, "mode" | "sidePref" | "clock" | "puzzleIndex">> = {}): Persisted {
    const mode = patch.mode ?? prefs.mode;
    const sidePref = patch.sidePref ?? prefs.sidePref;
    const clock = patch.clock ?? prefs.clock;
    const puzzleIndex = Math.min(PUZZLES.length - 1, Math.max(0, patch.puzzleIndex ?? prefs.puzzleIndex));
    const startFen = mode === "puzzle" ? PUZZLES[puzzleIndex]!.fen : INITIAL_FEN;
    const solver = new Chess(startFen).turn();
    const humanColor: Color =
      mode === "ai" ? (sidePref === "random" ? (Math.random() < 0.5 ? "w" : "b") : sidePref) : mode === "puzzle" ? solver : "w";
    const setup = mode === "puzzle" ? null : clockParts(clock);
    return {
      ...prefs,
      version: 1,
      startFen,
      moves: [],
      mode,
      sidePref,
      clock,
      puzzleIndex,
      humanColor,
      clocks: setup ? { w: setup.ms, b: setup.ms } : null,
      clockRunning: false,
      result: null,
      orientation: humanColor,
      viewCount: null,
    };
  }

  function newGame(patch: Partial<Pick<Persisted, "mode" | "sidePref" | "clock" | "puzzleIndex">> = {}) {
    stopSearch();
    const next = build(modelRef.current, patch);
    turnRef.current = new Chess(next.startFen).turn();
    publish(next);
    setSelected(null);
    setPending(null);
    setHint(null);
    setAnim(null);
    setNote(null);
    setPgnText(null);
  }

  function undo() {
    stopSearch();
    const prev = modelRef.current;
    if ((prev.result?.kind === "resign" || prev.result?.kind === "timeout") && prev.moves.length > 0) {
      let clocks = prev.clocks;
      if (prev.result.kind === "timeout" && clocks && prev.result.winner !== "draw") {
        const loser = opposite(prev.result.winner);
        clocks = { ...clocks, [loser]: Math.max(clocks[loser], 1500) };
      }
      const next = { ...prev, result: null, clocks, clockRunning: Boolean(clocks) && prev.mode !== "puzzle" };
      turnRef.current = replay(next.startFen, next.moves).turn();
      publish(next);
      return;
    }
    if (prev.moves.length === 0) return;
    const last = prev.moves[prev.moves.length - 1]!;
    let cut = 1;
    if ((prev.mode === "ai" || prev.mode === "puzzle") && last.color !== prev.humanColor && prev.moves.length >= 2) cut = 2;
    const moves = prev.moves.slice(0, -cut);
    const clocks = prev.moves[prev.moves.length - cut]?.clocksBefore ?? prev.clocks;
    const chess = replay(prev.startFen, moves);
    const next: Persisted = {
      ...prev,
      moves,
      clocks,
      clockRunning: moves.length > 0 && Boolean(clocks) && prev.mode !== "puzzle",
      result: null,
      viewCount: null,
      orientation: prev.mode === "local" && prev.autoflip ? chess.turn() : prev.orientation,
    };
    turnRef.current = chess.turn();
    publish(next);
    setAnim(null);
    setHint(null);
    setSelected(null);
  }

  function onSquare(square: string) {
    const prev = modelRef.current;
    if (prev.result || viewing || thinking || solving) return;
    const humanTurn = prev.mode === "local" || shown.turn() === prev.humanColor;
    if (!humanTurn || shown.isGameOver()) return;
    if (pending) {
      setPending(null);
      return;
    }
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      const targets = shown.moves({ square: selected as Square, verbose: true });
      if (targets.some((move) => move.to === square)) {
        place(selected, square);
        return;
      }
      const piece = shown.get(square as Square);
      if (piece && piece.color === shown.turn()) {
        setSelected(square);
        return;
      }
      setSelected(null);
      return;
    }
    const piece = shown.get(square as Square);
    if (piece && piece.color === shown.turn()) setSelected(square);
  }

  function hintMove() {
    const prev = modelRef.current;
    if (prev.result || viewing || thinking || solving) return;
    if (prev.mode === "puzzle") {
      const puzzle = PUZZLES[prev.puzzleIndex];
      const san = puzzle?.line[prev.moves.length];
      if (!san) return;
      const chess = replay(prev.startFen, prev.moves);
      try {
        const played = chess.move(san);
        setHint({ from: played.from, to: played.to });
        setSelected(played.from);
      } catch {
        /* ignore */
      }
      return;
    }
    const id = ++reqId.current;
    const level = LEVELS[prev.mode === "ai" ? prev.difficulty : "club"];
    const req: SearchRequest = {
      startFen: prev.startFen,
      moves: prev.moves.map((move) => ({ from: move.from, to: move.to, promotion: move.promotion })),
      depth: Math.min(3, level.depth),
      movetime: 700,
      noise: 0,
      useBook: true,
      quiesce: true,
    };
    const apply = (move: EngineMove | null) => {
      if (id !== reqId.current || !move) return;
      setHint({ from: move.from, to: move.to });
      setSelected(move.from);
    };
    try {
      const worker = createEngineWorker();
      workerRef.current?.terminate();
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ id: number; move: EngineMove | null }>) => {
        if (event.data.id !== id) return;
        apply(event.data.move);
        worker.terminate();
      };
      worker.onerror = () => {
        worker.terminate();
        try {
          apply(findBestMove({ ...req, depth: 2, movetime: 250, quiesce: false }));
        } catch {
          /* ignore */
        }
      };
      worker.postMessage({ id, ...req });
    } catch {
      try {
        apply(findBestMove({ ...req, depth: 2, movetime: 250, quiesce: false }));
      } catch {
        /* ignore */
      }
    }
  }

  async function showSolution() {
    const token = ++replyToken.current;
    reqId.current += 1;
    workerRef.current?.terminate();
    setThinking(false);
    const prev = modelRef.current;
    const puzzle = PUZZLES[prev.puzzleIndex];
    if (!puzzle) return;
    const base = build(prev, { mode: "puzzle", puzzleIndex: prev.puzzleIndex });
    turnRef.current = new Chess(base.startFen).turn();
    publish(base);
    setSolving(true);
    setSelected(null);
    setHint(null);
    for (const san of puzzle.line) {
      await new Promise((resolve) => window.setTimeout(resolve, 480));
      if (token !== replyToken.current) return;
      const cur = modelRef.current;
      const chess = replay(cur.startFen, cur.moves);
      const played = chess.move(san);
      const next = finish(cur, played, chess);
      turnRef.current = chess.turn();
      publish(next);
      animate(played);
      voice(played, chess, "puzzle");
    }
    setSolving(false);
  }

  async function copyPgn() {
    const pgn = replay(modelRef.current.startFen, modelRef.current.moves).pgn();
    try {
      await navigator.clipboard.writeText(pgn);
      flash("Moves copied.");
      setPgnText(null);
    } catch {
      setPgnText(pgn);
    }
  }

  useEffect(() => {
    const saved = load();
    if (saved) {
      clocksRef.current = saved.clocks;
      turnRef.current = replay(saved.startFen, saved.moves).turn();
      modelRef.current = saved;
      setState(saved);
    }
    setHydrated(true);
    return () => {
      replyToken.current += 1;
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(modelRef.current));
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const s = modelRef.current;
    if (s.mode !== "ai" || s.result || viewing) return;
    const chess = replay(s.startFen, s.moves);
    if (chess.isGameOver() || chess.turn() === s.humanColor) return;

    const id = ++reqId.current;
    const level = LEVELS[s.difficulty];
    const req: SearchRequest = {
      startFen: s.startFen,
      moves: s.moves.map((move) => ({ from: move.from, to: move.to, promotion: move.promotion })),
      depth: level.depth,
      movetime: level.movetime,
      noise: level.noise,
      useBook: true,
      quiesce: level.quiesce,
    };
    const started = performance.now();
    let timer = 0;
    setThinking(true);

    const apply = (move: EngineMove | null) => {
      if (id !== reqId.current) return;
      const wait = Math.max(0, 260 - (performance.now() - started));
      timer = window.setTimeout(() => {
        if (id !== reqId.current || !move) {
          if (id === reqId.current) setThinking(false);
          return;
        }
        const cur = modelRef.current;
        if (cur.result || cur.mode !== "ai") {
          setThinking(false);
          return;
        }
        try {
          const board = replay(cur.startFen, cur.moves);
          if (board.turn() === cur.humanColor || board.isGameOver()) {
            setThinking(false);
            return;
          }
          const played = board.move({
            from: move.from as Square,
            to: move.to as Square,
            promotion: move.promotion,
          });
          accept(played, board);
        } catch {
          /* engine move rejected */
        }
        if (id === reqId.current) setThinking(false);
      }, wait);
    };

    let worker: Worker | null = null;
    try {
      worker = createEngineWorker();
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ id: number; move: EngineMove | null }>) => {
        if (event.data.id !== id) return;
        apply(event.data.move);
      };
      worker.onerror = () => {
        worker?.terminate();
        try {
          apply(findBestMove({ ...req, depth: Math.min(2, req.depth), movetime: 240, quiesce: false }));
        } catch {
          if (id === reqId.current) setThinking(false);
        }
      };
      worker.postMessage({ id, ...req });
    } catch {
      try {
        apply(findBestMove({ ...req, depth: Math.min(2, req.depth), movetime: 240, quiesce: false }));
      } catch {
        setThinking(false);
      }
    }

    return () => {
      window.clearTimeout(timer);
      worker?.terminate();
      reqId.current += 1;
      setThinking(false);
    };
    // accept is stable enough for this turn-based effect; it reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.mode, state.difficulty, state.humanColor, state.result, state.startFen, state.moves, state.viewCount, viewing]);

  useEffect(() => {
    if (!hydrated) return;
    let frame = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const cur = modelRef.current;
      const isViewing = cur.viewCount != null && cur.viewCount !== cur.moves.length;
      if (cur.clockRunning && cur.clocks && !cur.result && !isViewing && !document.hidden) {
        acc += dt;
        const step = (cur.clocks[turnRef.current] ?? 0) < 20_000 ? 100 : 250;
        if (acc >= step) {
          const used = acc;
          acc = 0;
          const clocks = clocksRef.current;
          if (clocks && cur.clockRunning && !modelRef.current.result) {
            const turn = turnRef.current;
            const left = clocks[turn] - used;
            if (left <= 0) {
              const winner = opposite(turn);
              const result: Result = { kind: "timeout", winner };
              const record = cur.mode === "ai" ? scoreRecord(cur.record, result, cur.humanColor) : cur.record;
              const next = { ...modelRef.current, clocks: { ...clocks, [turn]: 0 }, clockRunning: false, result, record };
              if (cur.sound) playSound("end");
              publish(next);
            } else {
              const nextClocks = { ...clocks, [turn]: left };
              clocksRef.current = nextClocks;
              modelRef.current = { ...modelRef.current, clocks: nextClocks };
              setState((current) => ({ ...current, clocks: nextClocks }));
            }
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [hydrated]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Escape") {
        setSelected(null);
        setPending(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        const cur = modelRef.current;
        const at = cur.viewCount ?? cur.moves.length;
        publish({ ...cur, viewCount: Math.max(0, at - 1) === cur.moves.length ? null : Math.max(0, at - 1) });
      }
      if (event.key === "ArrowRight") {
        const cur = modelRef.current;
        const at = cur.viewCount ?? cur.moves.length;
        const next = Math.min(cur.moves.length, at + 1);
        publish({ ...cur, viewCount: next >= cur.moves.length ? null : next });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const api = {
      fen: () => replay(modelRef.current.startFen, modelRef.current.moves).fen(),
      sans: () => modelRef.current.moves.map((move) => move.san),
      move: (from: string, to: string, promotion?: Promotion) => place(from, to, promotion),
    };
    (window as unknown as { __kingside?: typeof api }).__kingside = api;
  });

  const puzzle = PUZZLES[state.puzzleIndex] ?? PUZZLES[0]!;
  const interactive =
    hydrated && !state.result && !viewing && !thinking && !solving && (state.mode === "local" || shown.turn() === state.humanColor) && !shown.isGameOver();

  const legal = useMemo(() => {
    const map = new Map<string, { to: string; capture: boolean; promotion: boolean }[]>();
    if (!interactive) return map;
    for (const move of shown.moves({ verbose: true })) {
      const list = map.get(move.from) ?? [];
      list.push({ to: move.to, capture: move.isCapture(), promotion: move.isPromotion() });
      map.set(move.from, list);
    }
    return map;
  }, [shown, interactive]);

  const last = shownCount > 0 ? state.moves[shownCount - 1]! : null;
  const checkSquare = shown.inCheck() ? (shown.findPiece({ type: "k", color: shown.turn() })[0] ?? null) : null;
  const copy = state.result ? resultCopy(state.result, state.mode, state.humanColor) : null;

  return {
    state,
    hydrated,
    thinking,
    solving,
    note,
    selected,
    pending,
    hint,
    shake,
    anim: viewing ? null : anim,
    pgnText,
    shown,
    live,
    viewing,
    interactive,
    legal,
    last,
    checkSquare,
    puzzle,
    balance: balance(shown),
    status: statusLine({
      result: state.result,
      mode: state.mode,
      thinking,
      note,
      inCheck: shown.inCheck(),
      turn: shown.turn(),
      human: state.humanColor,
      puzzleTitle: state.mode === "puzzle" ? puzzle.title : null,
      mateIn: state.mode === "puzzle" ? Math.ceil(puzzle.line.length / 2) : null,
    }),
    copy,
    onSquare,
    onDrop: place,
    onPromote: (promotion: Promotion) => {
      if (!pending) return;
      place(pending.from, pending.to, promotion);
    },
    onCancelPromotion: () => setPending(null),
    setSelected,
    undo,
    hintMove,
    resign: () => {
      const prev = modelRef.current;
      if (prev.result || prev.moves.length === 0 || prev.mode === "puzzle") return;
      stopSearch();
      const winner = prev.mode === "ai" ? opposite(prev.humanColor) : opposite(replay(prev.startFen, prev.moves).turn());
      const result: Result = { kind: "resign", winner };
      const record = prev.mode === "ai" ? scoreRecord(prev.record, result, prev.humanColor) : prev.record;
      publish({ ...prev, result, record, clockRunning: false });
      if (prev.sound) playSound("end");
    },
    newGame,
    setDifficulty: (difficulty: Difficulty) => publish({ ...modelRef.current, difficulty }),
    setSide: (sidePref: SidePref) => {
      const prev = modelRef.current;
      if (prev.moves.length === 0 || prev.result) newGame({ sidePref });
      else publish({ ...prev, sidePref });
    },
    setClock: (clock: ClockId) => {
      const prev = modelRef.current;
      if (prev.moves.length === 0 || prev.result) newGame({ clock });
      else publish({ ...prev, clock });
    },
    setMode: (mode: Mode) => newGame({ mode }),
    toggleSound: () => publish({ ...modelRef.current, sound: !modelRef.current.sound }),
    toggleAutoflip: () => {
      const prev = modelRef.current;
      const autoflip = !prev.autoflip;
      const orientation = autoflip && prev.mode === "local" ? replay(prev.startFen, prev.moves).turn() : prev.orientation;
      publish({ ...prev, autoflip, orientation });
    },
    flip: () => publish({ ...modelRef.current, orientation: opposite(modelRef.current.orientation) }),
    viewPly: (count: number) => {
      const prev = modelRef.current;
      publish({ ...prev, viewCount: count >= prev.moves.length ? null : Math.max(0, count) });
      setSelected(null);
      setPending(null);
    },
    backToLive: () => publish({ ...modelRef.current, viewCount: null }),
    showSolution,
    prevPuzzle: () => newGame({ mode: "puzzle", puzzleIndex: (modelRef.current.puzzleIndex + PUZZLES.length - 1) % PUZZLES.length }),
    nextPuzzle: () => newGame({ mode: "puzzle", puzzleIndex: (modelRef.current.puzzleIndex + 1) % PUZZLES.length }),
    copyPgn,
    clearPgn: () => setPgnText(null),
  };
}
