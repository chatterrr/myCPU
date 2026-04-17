import type {
  DispatchBoardCell,
  DispatchPiece,
  DispatchSession,
  ResolvedDispatchBlueprint
} from "@/features/traffic_game/contracts";

export const dispatchBoardWidth = 10;
export const dispatchBoardHeight = 18;

const spawnColumn = 3;
const spawnRow = 0;

export type DispatchAction =
  | { type: "left" }
  | { type: "right" }
  | { type: "down" }
  | { type: "tick" }
  | { type: "rotate" }
  | { type: "drop" }
  | { type: "togglePause" }
  | { type: "restart" }
  | { type: "select"; blockId: string | null };

type CellPosition = {
  row: number;
  col: number;
};

function createEmptyBoard(): Array<Array<DispatchBoardCell | null>> {
  return Array.from({ length: dispatchBoardHeight }, () =>
    Array.from({ length: dispatchBoardWidth }, () => null)
  );
}

function shuffleBlueprintIds(blueprints: ResolvedDispatchBlueprint[]): string[] {
  const next = blueprints.map((blueprint) => blueprint.id);

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function findBlueprint(
  blueprints: ResolvedDispatchBlueprint[],
  blueprintId: string
): ResolvedDispatchBlueprint {
  const blueprint = blueprints.find((item) => item.id === blueprintId);

  if (!blueprint) {
    throw new Error(`Missing dispatch blueprint: ${blueprintId}`);
  }

  return blueprint;
}

function refillQueue(
  queue: string[],
  blueprints: ResolvedDispatchBlueprint[]
): string[] {
  const next = [...queue];

  while (next.length < 6) {
    next.push(...shuffleBlueprintIds(blueprints));
  }

  return next;
}

function buildPiece(
  blueprint: ResolvedDispatchBlueprint,
  serial: number
): DispatchPiece {
  return {
    id: `${blueprint.id}-${serial}`,
    blueprintId: blueprint.id,
    kind: blueprint.kind,
    row: spawnRow,
    col: spawnColumn,
    rotation: 0,
    progress: 0,
    maxProgress: Math.max(0, blueprint.stepWindowEnd - blueprint.stepWindowStart),
    state: "falling",
    instructionKey: blueprint.instructionKey,
    instruction: blueprint.instruction
  };
}

function getRotationCells(
  piece: DispatchPiece,
  blueprints: ResolvedDispatchBlueprint[]
) {
  const blueprint = findBlueprint(blueprints, piece.blueprintId);
  const rotationCount = blueprint.rotations.length;
  const safeIndex = ((piece.rotation % rotationCount) + rotationCount) % rotationCount;

  return blueprint.rotations[safeIndex] ?? blueprint.rotations[0];
}

export function getPieceCells(
  piece: DispatchPiece,
  blueprints: ResolvedDispatchBlueprint[],
  override?: Partial<Pick<DispatchPiece, "row" | "col" | "rotation">>
): CellPosition[] {
  const nextPiece = {
    ...piece,
    row: override?.row ?? piece.row,
    col: override?.col ?? piece.col,
    rotation: override?.rotation ?? piece.rotation
  };

  return getRotationCells(nextPiece, blueprints).map((cell) => ({
    row: nextPiece.row + cell.y,
    col: nextPiece.col + cell.x
  }));
}

function canPlacePiece(
  board: Array<Array<DispatchBoardCell | null>>,
  piece: DispatchPiece,
  blueprints: ResolvedDispatchBlueprint[],
  override?: Partial<Pick<DispatchPiece, "row" | "col" | "rotation">>
) {
  return getPieceCells(piece, blueprints, override).every((cell) => {
    if (cell.col < 0 || cell.col >= dispatchBoardWidth) {
      return false;
    }

    if (cell.row < 0 || cell.row >= dispatchBoardHeight) {
      return false;
    }

    return !board[cell.row]?.[cell.col];
  });
}

function advancePieceProgress(piece: DispatchPiece, amount = 1): DispatchPiece {
  return {
    ...piece,
    progress: Math.min(piece.maxProgress, piece.progress + amount)
  };
}

function placeActivePiece(
  board: Array<Array<DispatchBoardCell | null>>,
  piece: DispatchPiece,
  blueprints: ResolvedDispatchBlueprint[]
) {
  const nextBoard = board.map((row) => [...row]);

  getPieceCells(piece, blueprints).forEach((cell) => {
    if (
      cell.row >= 0
      && cell.row < dispatchBoardHeight
      && cell.col >= 0
      && cell.col < dispatchBoardWidth
    ) {
      nextBoard[cell.row][cell.col] = { blockId: piece.id };
    }
  });

  return nextBoard;
}

function clearFilledLines(board: Array<Array<DispatchBoardCell | null>>) {
  const filledRows = board.reduce<number[]>((rows, row, rowIndex) => {
    if (row.every(Boolean)) {
      rows.push(rowIndex);
    }

    return rows;
  }, []);

  if (!filledRows.length) {
    return { board, clearedLineCount: 0 };
  }

  const remainingRows = board.filter((_, rowIndex) => !filledRows.includes(rowIndex));
  const clearedBoard = Array.from(
    { length: dispatchBoardHeight - remainingRows.length },
    () => Array.from({ length: dispatchBoardWidth }, () => null)
  );

  return {
    board: [...clearedBoard, ...remainingRows],
    clearedLineCount: filledRows.length
  };
}

function refreshPieceStates(
  pieces: Record<string, DispatchPiece>,
  board: Array<Array<DispatchBoardCell | null>>,
  activePieceId: string | null
): Record<string, DispatchPiece> {
  const remainingIds = new Set(
    board.flatMap((row) => row.flatMap((cell) => (cell ? [cell.blockId] : [])))
  );

  return Object.fromEntries(
    Object.entries(pieces).map(([pieceId, piece]) => {
      if (pieceId === activePieceId || piece.state === "falling") {
        return [pieceId, piece];
      }

      return [
        pieceId,
        {
          ...piece,
          state: remainingIds.has(pieceId) ? ("locked" as const) : ("cleared" as const)
        }
      ];
    })
  );
}

function spawnNextPiece(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[],
  options?: {
    board?: Array<Array<DispatchBoardCell | null>>;
    pieces?: Record<string, DispatchPiece>;
    selectedBlockId?: string | null;
    lockedCount?: number;
    score?: number;
    lines?: number;
    lastEventLabel?: string;
    nextSerial?: number;
  }
): DispatchSession {
  const board = options?.board ?? session.board;
  const pieces = options?.pieces ?? session.pieces;
  const queue = refillQueue(session.nextBlueprintIds, blueprints);
  const blueprintId = queue[0];
  const nextQueue = queue.slice(1);
  const serial = options?.nextSerial ?? session.nextSerial;
  const blueprint = findBlueprint(blueprints, blueprintId);
  const piece = buildPiece(blueprint, serial);

  if (!canPlacePiece(board, piece, blueprints)) {
    return {
      ...session,
      board,
      pieces,
      activePieceId: null,
      nextBlueprintIds: nextQueue,
      nextSerial: serial + 1,
      score: options?.score ?? session.score,
      lines: options?.lines ?? session.lines,
      lockedCount: options?.lockedCount ?? session.lockedCount,
      selectedBlockId: options?.selectedBlockId ?? session.selectedBlockId,
      gameOver: true,
      lastActionLabel: "顶部封口",
      lastEventLabel: options?.lastEventLabel ?? "本局结束"
    };
  }

  const previousActive = session.activePieceId;
  const shouldFollowActive =
    !session.selectedBlockId
    || (previousActive !== null && session.selectedBlockId === previousActive);

  return {
    ...session,
    board,
    pieces: {
      ...pieces,
      [piece.id]: piece
    },
    activePieceId: piece.id,
    nextBlueprintIds: nextQueue,
    nextSerial: serial + 1,
    score: options?.score ?? session.score,
    lines: options?.lines ?? session.lines,
    lockedCount: options?.lockedCount ?? session.lockedCount,
    selectedBlockId: shouldFollowActive
      ? piece.id
      : (options?.selectedBlockId ?? session.selectedBlockId),
    lastActionLabel: blueprint.title,
    lastEventLabel: options?.lastEventLabel ?? blueprint.cue
  };
}

function lockActivePiece(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[]
) {
  if (!session.activePieceId) {
    return session;
  }

  const activePiece = session.pieces[session.activePieceId];

  if (!activePiece) {
    return session;
  }

  const lockedPiece = {
    ...activePiece,
    progress: activePiece.maxProgress,
    state: "locked" as const
  };
  const placedBoard = placeActivePiece(session.board, lockedPiece, blueprints);
  const lineResult = clearFilledLines(placedBoard);
  const piecesAfterLock = refreshPieceStates(
    {
      ...session.pieces,
      [lockedPiece.id]: lockedPiece
    },
    lineResult.board,
    null
  );
  const scoreGain = 120 + lineResult.clearedLineCount * 220;
  const nextEventLabel =
    lineResult.clearedLineCount > 0
      ? `清掉 ${lineResult.clearedLineCount} 行`
      : "锁定入栈";

  return spawnNextPiece(
    {
      ...session,
      activePieceId: null,
      board: lineResult.board,
      pieces: piecesAfterLock
    },
    blueprints,
    {
      board: lineResult.board,
      pieces: piecesAfterLock,
      lockedCount: session.lockedCount + 1,
      score: session.score + scoreGain,
      lines: session.lines + lineResult.clearedLineCount,
      lastEventLabel: nextEventLabel
    }
  );
}

function updateActivePiece(
  session: DispatchSession,
  updater: (piece: DispatchPiece) => DispatchPiece,
  lastActionLabel: string,
  lastEventLabel: string
) {
  if (!session.activePieceId) {
    return session;
  }

  const activePiece = session.pieces[session.activePieceId];

  if (!activePiece) {
    return session;
  }

  const nextPiece = updater(activePiece);

  return {
    ...session,
    pieces: {
      ...session.pieces,
      [nextPiece.id]: nextPiece
    },
    lastActionLabel,
    lastEventLabel
  };
}

function moveActivePiece(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[],
  delta: { row?: number; col?: number },
  labels: { action: string; event: string }
) {
  if (!session.activePieceId) {
    return session;
  }

  const activePiece = session.pieces[session.activePieceId];

  if (!activePiece) {
    return session;
  }

  const nextRow = activePiece.row + (delta.row ?? 0);
  const nextCol = activePiece.col + (delta.col ?? 0);

  if (!canPlacePiece(session.board, activePiece, blueprints, {
    row: nextRow,
    col: nextCol
  })) {
    return session;
  }

  return updateActivePiece(
    session,
    (piece) =>
      advancePieceProgress({
        ...piece,
        row: nextRow,
        col: nextCol
      }),
    labels.action,
    labels.event
  );
}

function rotateActivePiece(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[]
) {
  if (!session.activePieceId) {
    return session;
  }

  const activePiece = session.pieces[session.activePieceId];

  if (!activePiece) {
    return session;
  }

  const blueprint = findBlueprint(blueprints, activePiece.blueprintId);
  const nextRotation = (activePiece.rotation + 1) % blueprint.rotations.length;
  const kickOffsets = [0, -1, 1, -2, 2];

  for (const kick of kickOffsets) {
    if (
      canPlacePiece(session.board, activePiece, blueprints, {
        row: activePiece.row,
        col: activePiece.col + kick,
        rotation: nextRotation
      })
    ) {
      return updateActivePiece(
        session,
        (piece) =>
          advancePieceProgress({
            ...piece,
            rotation: nextRotation,
            col: piece.col + kick
          }),
        "旋转",
        "切换形态"
      );
    }
  }

  return session;
}

export function getGhostRow(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[]
) {
  if (!session.activePieceId) {
    return null;
  }

  const activePiece = session.pieces[session.activePieceId];

  if (!activePiece) {
    return null;
  }

  let row = activePiece.row;

  while (
    canPlacePiece(session.board, activePiece, blueprints, {
      row: row + 1,
      col: activePiece.col
    })
  ) {
    row += 1;
  }

  return row;
}

export function createInitialDispatchSession(
  blueprints: ResolvedDispatchBlueprint[]
): DispatchSession {
  const initialSession: DispatchSession = {
    board: createEmptyBoard(),
    pieces: {},
    activePieceId: null,
    nextBlueprintIds: shuffleBlueprintIds(blueprints),
    selectedBlockId: null,
    nextSerial: 1,
    score: 0,
    lines: 0,
    lockedCount: 0,
    gameOver: false,
    paused: false,
    lastActionLabel: "准备开局",
    lastEventLabel: "第一块入场"
  };

  return spawnNextPiece(initialSession, blueprints);
}

export function reduceDispatchSession(
  session: DispatchSession,
  blueprints: ResolvedDispatchBlueprint[],
  action: DispatchAction
): DispatchSession {
  if (action.type === "restart") {
    return createInitialDispatchSession(blueprints);
  }

  if (action.type === "select") {
    return {
      ...session,
      selectedBlockId: action.blockId
    };
  }

  if (action.type === "togglePause") {
    return {
      ...session,
      paused: !session.paused,
      lastActionLabel: session.paused ? "继续" : "暂停",
      lastEventLabel: session.paused ? "恢复下落" : "按 P 继续"
    };
  }

  if (session.paused || session.gameOver) {
    return session;
  }

  if (!session.activePieceId) {
    return session;
  }

  switch (action.type) {
    case "left":
      return moveActivePiece(session, blueprints, { col: -1 }, {
        action: "左移",
        event: "向左修位"
      });

    case "right":
      return moveActivePiece(session, blueprints, { col: 1 }, {
        action: "右移",
        event: "向右修位"
      });

    case "rotate":
      return rotateActivePiece(session, blueprints);

    case "down":
    case "tick": {
      const moved = moveActivePiece(session, blueprints, { row: 1 }, {
        action: action.type === "down" ? "加速下落" : "自然下落",
        event: action.type === "down" ? "加速推进" : "逐拍推进"
      });

      if (moved !== session) {
        return {
          ...moved,
          score: moved.score + (action.type === "down" ? 8 : 0)
        };
      }

      return lockActivePiece(session, blueprints);
    }

    case "drop": {
      const ghostRow = getGhostRow(session, blueprints);

      if (ghostRow === null) {
        return session;
      }

      const activePiece = session.pieces[session.activePieceId];

      if (!activePiece) {
        return session;
      }

      const droppedRows = Math.max(0, ghostRow - activePiece.row);
      const droppedSession = updateActivePiece(
        session,
        (piece) => ({
          ...advancePieceProgress(piece, piece.maxProgress),
          row: ghostRow
        }),
        "硬降",
        "直达落点"
      );

      return lockActivePiece(
        {
          ...droppedSession,
          score: droppedSession.score + droppedRows * 14
        },
        blueprints
      );
    }
  }
}
