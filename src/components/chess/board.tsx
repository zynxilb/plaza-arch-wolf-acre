import { useEffect, useRef, useState } from "react";
import type { Chess, Square } from "chess.js";
import { pieceSrc } from "@/lib/chess/rules";
import type { Color, Promotion } from "@/lib/chess/types";
import { cn } from "@/lib/cn";
import { unlockAudio } from "@/lib/chess/sounds";

type Slide = { from: string; to: string };

type Props = {
  chess: Chess;
  orientation: Color;
  selected: string | null;
  legal: Map<string, { to: string; capture: boolean; promotion: boolean }[]>;
  last: { from: string; to: string } | null;
  checkSquare: string | null;
  hint: { from: string; to: string } | null;
  interactive: boolean;
  promotion: { from: string; to: string } | null;
  anim: { token: number; steps: Slide[] } | null;
  shake: number;
  banner: { title: string; detail: string; action: string; onAction: () => void } | null;
  onSquare: (square: string) => void;
  onDrop: (from: string, to: string) => void;
  onPromote: (piece: Promotion) => void;
  onCancelPromotion: () => void;
};

const PROMOTION: Promotion[] = ["q", "r", "b", "n"];
const PROMO_NAME: Record<Promotion, string> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

function screenDelta(from: string, to: string, orientation: Color) {
  const file = to.charCodeAt(0) - from.charCodeAt(0);
  const rank = Number(to[1]) - Number(from[1]);
  if (orientation === "w") return { dx: file, dy: -rank };
  return { dx: -file, dy: rank };
}

function SlidePiece({
  dx,
  dy,
  token,
  src,
}: {
  dx: number;
  dy: number;
  token: number;
  src: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const size = el.parentElement?.clientWidth ?? 0;
    el.style.transition = "none";
    el.style.transform = `translate(${-dx * size}px, ${-dy * size}px)`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "translate(0px, 0px)";
      });
    });
  }, [dx, dy, token]);
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[1] grid place-items-center">
      <img src={src} alt="" draggable={false} className="pointer-events-none size-11/12 select-none" />
    </div>
  );
}

export function Board({
  chess,
  orientation,
  selected,
  legal,
  last,
  checkSquare,
  hint,
  interactive,
  promotion,
  anim,
  shake,
  banner,
  onSquare,
  onDrop,
  onPromote,
  onCancelPromotion,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sq: string; x: number; y: number; moved: boolean; own: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ sq: string; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const turn = chess.turn();

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || shake === 0) return;
    frame.classList.remove("board-shake");
    void frame.offsetWidth;
    frame.classList.add("board-shake");
  }, [shake]);

  const ranks = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const focus = selected ?? (ghost ? null : hover);
  const targets = focus ? (legal.get(focus) ?? []) : [];
  const promoRank = promotion ? Number(promotion.to[1]) - 1 : -1;
  const promoFile = promotion ? promotion.to.charCodeAt(0) - 97 : -1;
  const promoScreenRow = promotion ? (orientation === "w" ? 8 - promoRank : promoRank + 1) : 1;
  const promoScreenFile = promotion ? (orientation === "w" ? promoFile + 1 : 8 - promoFile) : 1;
  const promoAtTop = promoScreenRow === 1;

  function squareAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    return el?.closest("[data-square]")?.getAttribute("data-square");
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!interactive || promotion) return;
    const square = (event.target as HTMLElement).closest("[data-square]")?.getAttribute("data-square");
    if (!square) return;
    unlockAudio();
    event.preventDefault();
    frameRef.current?.setPointerCapture(event.pointerId);
    const piece = chess.get(square as Square);
    const own = Boolean(piece && piece.color === turn);
    drag.current = { sq: square, x: event.clientX, y: event.clientY, moved: false, own };
    if (own) setGhost({ sq: square, x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) current.moved = true;
    if (current.own && current.moved) setGhost({ sq: current.sq, x: event.clientX, y: event.clientY });
  }

  function onPointerUp(event: React.PointerEvent) {
    const current = drag.current;
    drag.current = null;
    setGhost(null);
    if (!current) return;
    if (!current.moved) {
      onSquare(current.sq);
      return;
    }
    if (!current.own) return;
    const target = squareAt(event.clientX, event.clientY);
    if (target) onDrop(current.sq, target);
  }

  const ghostPiece = ghost ? chess.get(ghost.sq as Square) : null;

  return (
    <div className="relative mx-auto w-full max-w-[40rem]">
      <div
        ref={frameRef}
        className="frame relative aspect-square w-full touch-none rounded-xl bg-ink p-3 select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setGhost(null);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="relative grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg">
          {ranks.map((rank) =>
            files.map((file) => {
              const square = `${String.fromCharCode(97 + file)}${rank + 1}`;
              const light = (file + rank) % 2 === 1;
              const piece = chess.get(square as Square);
              const isLast = last && (last.from === square || last.to === square);
              const isSelected = selected === square;
              const isHint = hint && (hint.from === square || hint.to === square);
              const target = targets.find((item) => item.to === square);
              const slide = anim?.steps.find((step) => step.to === square);
              const delta = slide ? screenDelta(slide.from, slide.to, orientation) : null;
              const showRank = file === files[0];
              const showFile = rank === ranks[ranks.length - 1];
              const dragging = ghost?.sq === square;
              const label = light ? "text-board-dark" : "text-board-light";
              const name = piece ? `${piece.color === "w" ? "white" : "black"} ${PIECE_NAME[piece.type]}` : "empty";
              return (
                <div
                  key={square}
                  data-square={square}
                  role="button"
                  tabIndex={-1}
                  aria-label={`${square}, ${name}`}
                  onPointerEnter={() => setHover(square)}
                  onPointerLeave={() => setHover((current) => (current === square ? null : current))}
                  className={cn(
                    "relative aspect-square outline-none",
                    light ? "bg-board-light" : "bg-board-dark",
                  )}
                >
                  {isLast ? <span className="pointer-events-none absolute inset-0 bg-veil" /> : null}
                  {isSelected ? <span className="pointer-events-none absolute inset-0 bg-ink/15" /> : null}
                  {isHint ? <span className="pointer-events-none absolute inset-1 rounded-sm ring-2 ring-ink/50" /> : null}
                  {checkSquare === square ? <span className="pointer-events-none absolute inset-0 bg-danger/45" /> : null}
                  {showRank ? (
                    <span className={cn("pointer-events-none absolute top-0.5 left-1 z-[2] text-xs font-medium", label)}>
                      {rank + 1}
                    </span>
                  ) : null}
                  {showFile ? (
                    <span className={cn("pointer-events-none absolute right-1 bottom-0.5 z-[2] text-xs font-medium", label)}>
                      {String.fromCharCode(97 + file)}
                    </span>
                  ) : null}
                  {target && !piece ? (
                    <span className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="size-1/4 rounded-full bg-ink/25" />
                    </span>
                  ) : null}
                  {target && piece ? <span className="pointer-events-none absolute inset-[7%] rounded-full ring-4 ring-ink/30" /> : null}
                  {piece && delta ? (
                    <SlidePiece dx={delta.dx} dy={delta.dy} token={anim?.token ?? 0} src={pieceSrc(piece.color, piece.type)} />
                  ) : null}
                  {piece && !delta ? (
                    <span className={cn("pointer-events-none absolute inset-0 grid place-items-center", dragging && "opacity-30")}>
                      <img src={pieceSrc(piece.color, piece.type)} alt="" draggable={false} className="pointer-events-none size-11/12 select-none" />
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
          {promotion ? (
            <div
              className={cn(
                "absolute z-20 flex w-[12.5%] flex-col drop-shadow",
                promoAtTop ? "flex-col" : "flex-col-reverse",
              )}
              style={{
                left: `${(promoScreenFile - 1) * 12.5}%`,
                top: promoAtTop ? "0%" : "50%",
                height: "50%",
              }}
            >
              {PROMOTION.map((piece) => (
                <button
                  key={piece}
                  type="button"
                  aria-label={`Promote to ${PROMO_NAME[piece]}`}
                  className="press grid aspect-square place-items-center border border-line bg-surface"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onPromote(piece)}
                >
                  <img src={pieceSrc(turn, piece)} alt="" className="pointer-events-none size-11/12" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {promotion ? (
          <button type="button" className="sr-only" onClick={onCancelPromotion}>
            Cancel promotion
          </button>
        ) : null}
      </div>
      {banner ? (
        <div className="absolute inset-x-6 bottom-6 z-30 rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="font-display text-2xl leading-tight text-ink">{banner.title}</p>
          <p className="mt-1 text-sm text-muted">{banner.detail}</p>
          <button type="button" className="press mt-3 min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-bg" onClick={banner.onAction}>
            {banner.action}
          </button>
        </div>
      ) : null}
      {ghost && ghostPiece ? (
        <img
          src={pieceSrc(ghostPiece.color, ghostPiece.type)}
          alt=""
          draggable={false}
          className="pointer-events-none fixed z-40 size-16 -translate-x-1/2 -translate-y-1/2"
          style={{ left: ghost.x, top: ghost.y }}
        />
      ) : null}
    </div>
  );
}
