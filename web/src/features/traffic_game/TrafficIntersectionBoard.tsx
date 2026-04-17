import { motion } from "motion/react";
import type {
  DispatchPiece,
  DispatchSession,
  ResolvedDispatchBlueprint
} from "@/features/traffic_game/contracts";
import {
  dispatchBoardHeight,
  dispatchBoardWidth,
  getGhostRow,
  getPieceCells
} from "@/features/traffic_game/engine";

const cellSize = 46;

const pieceClasses: Record<string, string> = {
  alu: "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(110,231,183,0.92),rgba(6,78,59,0.9))] shadow-[0_0_28px_rgba(16,185,129,0.42)]",
  forward:
    "border-cyan-200/80 bg-[linear-gradient(180deg,rgba(103,232,249,0.94),rgba(8,47,73,0.92))] shadow-[0_0_28px_rgba(34,211,238,0.46)]",
  "load-use":
    "border-amber-200/85 bg-[linear-gradient(180deg,rgba(253,224,71,0.94),rgba(120,53,15,0.9))] shadow-[0_0_32px_rgba(251,191,36,0.44)]",
  "branch-flush":
    "border-rose-200/85 bg-[linear-gradient(180deg,rgba(253,164,175,0.94),rgba(136,19,55,0.92))] shadow-[0_0_32px_rgba(251,113,133,0.44)]"
};

function findBlueprint(
  blueprints: ResolvedDispatchBlueprint[],
  blueprintId: string
) {
  return blueprints.find((blueprint) => blueprint.id === blueprintId) ?? null;
}

function renderPieceCell({
  key,
  row,
  col,
  piece,
  isGhost = false,
  isSelected = false,
  isActive = false,
  blueprints,
  onSelectBlock
}: {
  key: string;
  row: number;
  col: number;
  piece: DispatchPiece;
  isGhost?: boolean;
  isSelected?: boolean;
  isActive?: boolean;
  blueprints: ResolvedDispatchBlueprint[];
  onSelectBlock: (blockId: string) => void;
}) {
  const blueprint = findBlueprint(blueprints, piece.blueprintId);

  if (!blueprint) {
    return null;
  }

  return (
    <motion.button
      key={key}
      type="button"
      onClick={() => onSelectBlock(piece.id)}
      initial={false}
      animate={{
        x: col * cellSize,
        y: row * cellSize
      }}
      transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.45 }}
      className={`absolute left-0 top-0 flex items-center justify-center rounded-[12px] border text-[10px] font-semibold tracking-[0.16em] text-slate-950 transition ${pieceClasses[piece.kind]} ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""} ${isActive ? "scale-[1.03]" : ""} ${isGhost ? "border-dashed opacity-40 shadow-none" : "hover:brightness-110"}`}
      style={{
        width: `${cellSize - 4}px`,
        height: `${cellSize - 4}px`,
        marginLeft: "2px",
        marginTop: "2px"
      }}
      aria-label={`${blueprint.title} ${row},${col}`}
    >
      {!isGhost ? blueprint.shortLabel.slice(0, 1) : ""}
    </motion.button>
  );
}

export function TrafficIntersectionBoard({
  session,
  blueprints,
  onSelectBlock,
  className = ""
}: {
  session: DispatchSession;
  blueprints: ResolvedDispatchBlueprint[];
  onSelectBlock: (blockId: string) => void;
  className?: string;
}) {
  const activePiece = session.activePieceId
    ? session.pieces[session.activePieceId] ?? null
    : null;
  const ghostRow = activePiece ? getGhostRow(session, blueprints) : null;
  const ghostCells =
    activePiece && ghostRow !== null
      ? getPieceCells(activePiece, blueprints, { row: ghostRow })
      : [];

  return (
    <div
      className={`flex h-full flex-col rounded-[32px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),_transparent_24%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(180deg,rgba(1,4,12,0.98),rgba(3,7,18,0.9))] p-5 shadow-[0_36px_110px_rgba(2,6,23,0.48)] ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            主舞台
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-50">
            方块堆栈
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "← / A 左移",
            "→ / D 右移",
            "↑ / W 旋转",
            "↓ / S 加速",
            "Space 硬降",
            "P 暂停"
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/16 bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-100 shadow-[0_0_18px_rgba(255,255,255,0.04)]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-x-auto">
        <div
          className="relative overflow-hidden rounded-[28px] border border-cyan-300/24 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,1),rgba(2,6,23,0.96))] shadow-[0_0_40px_rgba(34,211,238,0.12)]"
          style={{
            width: `${dispatchBoardWidth * cellSize}px`,
            height: `${dispatchBoardHeight * cellSize}px`
          }}
        >
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_36%),radial-gradient(circle_at_bottom,_rgba(253,224,71,0.08),_transparent_34%)]" />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)",
              backgroundSize: `${cellSize}px ${cellSize}px`
            }}
          />

          {ghostCells.map((cell, index) =>
            activePiece
              ? renderPieceCell({
                  key: `ghost-${index}`,
                  row: cell.row,
                  col: cell.col,
                  piece: activePiece,
                  isGhost: true,
                  blueprints,
                  onSelectBlock
                })
              : null
          )}

          {session.board.flatMap((row, rowIndex) =>
            row.flatMap((cell, colIndex) => {
              if (!cell) {
                return [];
              }

              const piece = session.pieces[cell.blockId];

              if (!piece) {
                return [];
              }

              return renderPieceCell({
                key: `locked-${rowIndex}-${colIndex}`,
                row: rowIndex,
                col: colIndex,
                piece,
                isSelected: session.selectedBlockId === piece.id,
                blueprints,
                onSelectBlock
              });
            })
          )}

          {activePiece
            ? getPieceCells(activePiece, blueprints).map((cell, index) =>
                renderPieceCell({
                  key: `active-${activePiece.id}-${index}`,
                  row: cell.row,
                  col: cell.col,
                  piece: activePiece,
                  isSelected: session.selectedBlockId === activePiece.id,
                  isActive: true,
                  blueprints,
                  onSelectBlock
                })
              )
            : null}

          {(session.paused || session.gameOver) ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-slate-950/72 backdrop-blur-sm">
              <div className="rounded-[24px] border border-rose-300/24 bg-black/45 px-8 py-6 text-center shadow-[0_0_36px_rgba(251,113,133,0.16)]">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {session.gameOver ? "本局结束" : "已暂停"}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">
                  {session.gameOver ? "堆顶封口" : "暂停中"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
