import { useState, type ReactNode } from "react";
import { Flag, Lightbulb, Redo2, RotateCcw, Undo2, Volume2, VolumeX } from "lucide-react";
import { Board } from "@/components/chess/board";
import { useGame } from "@/components/chess/use-game";
import { CLOCKS, formatClock, LEVEL_ORDER, LEVELS } from "@/lib/chess/levels";
import { PUZZLES } from "@/lib/chess/puzzles";
import { capturedPieces, pieceSrc } from "@/lib/chess/rules";
import type { ClockId, Color, MoveRec } from "@/lib/chess/types";
import { cn } from "@/lib/cn";

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "press min-h-11 rounded-md px-3 text-sm font-medium",
        pressed ? "bg-surface text-ink" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Captured({ moves, by, lead }: { moves: MoveRec[]; by: Color; lead: number }) {
  const pieces = capturedPieces(moves, by);
  const color: Color = by === "w" ? "b" : "w";
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-0.5">
      {pieces.map((type, index) => (
        <img key={`${type}-${index}`} src={pieceSrc(color, type)} alt="" className="size-4" />
      ))}
      {lead > 0 ? <span className="ml-1 text-xs font-medium text-muted tabular-nums">+{lead}</span> : null}
    </div>
  );
}

export function ChessGame() {
  const game = useGame();
  const { state } = game;
  const [confirmResign, setConfirmResign] = useState(false);
  const far: Color = state.orientation === "w" ? "b" : "w";
  const near: Color = state.orientation === "w" ? "w" : "b";
  const blackLead = game.balance < 0 ? -game.balance : 0;
  const names =
    state.mode === "ai"
      ? { w: state.humanColor === "w" ? "You" : "Computer", b: state.humanColor === "b" ? "You" : "Computer" }
      : state.mode === "puzzle"
        ? { w: "White", b: "Black" }
        : { w: "White", b: "Black" };

  const banner = game.viewing
    ? { title: "Earlier position", detail: "The live game is still here.", action: "Back to now", onAction: game.backToLive }
    : game.copy
      ? {
          title: game.copy.title,
          detail: game.copy.detail,
          action: state.mode === "puzzle" ? "Next puzzle" : "Play again",
          onAction: () => (state.mode === "puzzle" ? game.nextPuzzle() : game.newGame()),
        }
      : null;

  const pairs: { n: number; w?: (typeof state.moves)[number]; b?: (typeof state.moves)[number]; wi: number; bi: number }[] = [];
  for (let i = 0; i < state.moves.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: state.moves[i], b: state.moves[i + 1], wi: i + 1, bi: i + 2 });
  }
  const activePly = state.viewCount ?? state.moves.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/pieces/bN.svg" alt="" className="size-10" />
          <div>
            <h1 className="font-display text-3xl leading-none tracking-tight text-ink italic">Kingside</h1>
            <p className="mt-1 text-sm text-muted">Play, take back, and look for mate</p>
          </div>
        </div>
        <button
          type="button"
          className="press grid size-11 place-items-center rounded-md border border-line bg-surface text-ink"
          aria-label={state.sound ? "Sound on" : "Sound off"}
          aria-pressed={state.sound}
          onClick={game.toggleSound}
        >
          {state.sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          {state.clocks ? (
            <div className="mx-auto mb-3 grid w-full max-w-[40rem] grid-cols-2 gap-2">
              <Clock
                name={names[far]}
                ms={state.clocks[far]}
                active={!game.viewing && !state.result && game.live.turn() === far && state.clockRunning}
                low={state.clocks[far] < 20_000}
              />
              <Clock
                name={names[near]}
                ms={state.clocks[near]}
                active={!game.viewing && !state.result && game.live.turn() === near && state.clockRunning}
                low={state.clocks[near] < 20_000}
              />
            </div>
          ) : null}
          <p className="mx-auto mb-3 w-full max-w-[40rem] text-sm font-medium text-ink" aria-live="polite">
            {game.status}
          </p>
          <Board
            chess={game.shown}
            orientation={state.orientation}
            selected={game.selected}
            legal={game.legal}
            last={game.last}
            checkSquare={game.checkSquare}
            hint={game.hint}
            interactive={game.interactive}
            promotion={game.pending}
            anim={game.anim}
            shake={game.shake}
            banner={banner}
            onSquare={game.onSquare}
            onDrop={game.onDrop}
            onPromote={game.onPromote}
            onCancelPromotion={game.onCancelPromotion}
          />
          <div className="sticky bottom-3 z-30 mx-auto mt-3 grid w-full max-w-[40rem] grid-cols-4 gap-2">
            <IconButton label="Undo" onClick={game.undo} disabled={state.moves.length === 0 && !state.result}>
              <Undo2 className="size-4" />
            </IconButton>
            <IconButton label="Hint" onClick={game.hintMove} disabled={Boolean(state.result) || game.thinking || game.solving}>
              <Lightbulb className="size-4" />
            </IconButton>
            <IconButton label="Flip" onClick={game.flip}>
              <Redo2 className="size-4" />
            </IconButton>
            <IconButton label="New" onClick={() => game.newGame()}>
              <RotateCcw className="size-4" />
            </IconButton>
          </div>
        </section>

        <aside className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-line/70 p-1">
            <Chip pressed={state.mode === "ai"} onClick={() => game.setMode("ai")}>
              Computer
            </Chip>
            <Chip pressed={state.mode === "local"} onClick={() => game.setMode("local")}>
              Two players
            </Chip>
            <Chip pressed={state.mode === "puzzle"} onClick={() => game.setMode("puzzle")}>
              Puzzles
            </Chip>
          </div>

          {state.mode === "ai" ? (
            <>
              <Field label="Strength">
                <div className="flex flex-wrap gap-1 rounded-lg bg-line/70 p-1">
                  {LEVEL_ORDER.map((id) => (
                    <Chip key={id} pressed={state.difficulty === id} onClick={() => game.setDifficulty(id)}>
                      {LEVELS[id].label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">{LEVELS[state.difficulty].blurb}</p>
              </Field>
              <Field label="Your pieces">
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-line/70 p-1">
                  <Chip pressed={state.sidePref === "w"} onClick={() => game.setSide("w")}>
                    White
                  </Chip>
                  <Chip pressed={state.sidePref === "b"} onClick={() => game.setSide("b")}>
                    Black
                  </Chip>
                  <Chip pressed={state.sidePref === "random"} onClick={() => game.setSide("random")}>
                    Random
                  </Chip>
                </div>
                {state.moves.length > 0 && !state.result ? (
                  <p className="mt-1 text-xs text-muted">Side and clock apply on the next game.</p>
                ) : null}
              </Field>
              <p className="text-sm text-muted tabular-nums">
                {state.record.win} wins · {state.record.loss} losses · {state.record.draw} draws
              </p>
            </>
          ) : null}

          {state.mode === "local" ? (
            <button
              type="button"
              aria-pressed={state.autoflip}
              onClick={game.toggleAutoflip}
              className="press min-h-11 rounded-md border border-line px-3 text-left text-sm font-medium"
            >
              {state.autoflip ? "Board flips each turn" : "Board stays put"}
            </button>
          ) : null}

          {state.mode === "puzzle" ? (
            <div className="flex flex-col gap-2">
              <p className="font-display text-xl text-ink">{game.puzzle.title}</p>
              <p className="text-sm text-muted">{game.puzzle.detail}</p>
              <p className="text-xs text-muted tabular-nums">
                {state.puzzleIndex + 1} / {PUZZLES.length}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <IconButton label="Previous" onClick={game.prevPuzzle} />
                <IconButton label="Next" onClick={game.nextPuzzle} />
                <IconButton label="Retry" onClick={() => game.newGame({ mode: "puzzle", puzzleIndex: state.puzzleIndex })} />
                <IconButton label="Solution" onClick={() => void game.showSolution()} disabled={game.solving} />
              </div>
            </div>
          ) : (
            <Field label="Clock">
              <div className="flex flex-wrap gap-1 rounded-lg bg-line/70 p-1">
                {CLOCKS.map((item) => (
                  <Chip key={item.id} pressed={state.clock === item.id} onClick={() => game.setClock(item.id as ClockId)}>
                    {item.label}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          <div className="flex flex-col gap-1 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{names.w}</span>
              <Captured moves={state.moves} by="w" lead={whiteLead} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{names.b}</span>
              <Captured moves={state.moves} by="b" lead={blackLead} />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            {pairs.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Moves will show up here.</p>
            ) : (
              <ol>
                {pairs.map((row) => (
                  <li key={row.n} className="grid grid-cols-[2.5rem_1fr_1fr] items-center border-b border-line last:border-b-0">
                    <span className="pl-3 text-xs text-muted tabular-nums">{row.n}</span>
                    <MoveCell san={row.w?.san} active={activePly === row.wi} onClick={() => game.viewPly(row.wi)} />
                    <MoveCell san={row.b?.san} active={activePly === row.bi} onClick={() => row.b && game.viewPly(row.bi)} />
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <IconButton label="Copy moves" onClick={() => void game.copyPgn()} disabled={state.moves.length === 0} />
            {state.mode === "puzzle" ? null : confirmResign ? (
              <>
                <button type="button" className="press min-h-11 rounded-md bg-danger text-sm font-medium text-surface" onClick={() => { setConfirmResign(false); game.resign(); }}>
                  Resign
                </button>
                <button type="button" className="press col-span-2 min-h-11 rounded-md border border-line text-sm font-medium" onClick={() => setConfirmResign(false)}>
                  Keep playing
                </button>
              </>
            ) : (
              <button
                type="button"
                className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line text-sm font-medium text-danger disabled:opacity-40"
                disabled={Boolean(state.result) || state.moves.length === 0}
                onClick={() => setConfirmResign(true)}
              >
                <Flag className="size-4" />
                Resign
              </button>
            )}
          </div>
          {game.pgnText ? (
            <pre className="max-h-40 overflow-auto rounded-md bg-bg p-3 text-xs text-ink whitespace-pre-wrap">{game.pgnText}</pre>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
              <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}

function Clock({ name, ms, active, low }: { name: string; ms: number; active: boolean; low: boolean }) {
  return (
    <div className={cn("flex min-h-14 items-center justify-between rounded-lg px-3", active ? "bg-ink text-bg" : "border border-line bg-surface text-ink")}>
      <span className="text-sm font-medium">{name}</span>
      <span className={cn("text-lg font-medium tabular-nums", low && "text-danger", low && active && "text-bg")}>
        {formatClock(ms)}
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-2 text-sm font-medium text-ink disabled:opacity-40"
    >
      {children}
      {label}
    </button>
  );
}

function MoveCell({ san, active, onClick }: { san?: string; active: boolean; onClick: () => void }) {
  if (!san) return <span />;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("min-h-11 px-2 text-left text-sm tabular-nums", active ? "bg-line font-medium text-ink" : "text-ink")}
    >
      {san}
    </button>
  );
}
