import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  applyMove,
  createEmptyBoard,
  getWinner,
  isDraw,
  isValidMove,
  nextPlayer,
  resetGame,
  type Board,
  type Player,
} from "~/lib/game";
import { AuditTrailPanel, type AuditEvent } from "~/components/AuditTrailPanel";

/**
// ============================================================================
// REQUIREMENT TRACEABILITY
// ============================================================================
// Requirement ID: REQ-TTT-UI-001
// User Story: As a user, I can play Tic Tac Toe with a clear UI and see status.
// Acceptance Criteria:
//  - Centered 3x3 grid with status and restart button
//  - Prevent invalid moves, handle out-of-range indices
//  - Detect win/draw and stop further moves
//  - Client-side audit scaffolding with timestamps and before/after states
// GxP Impact: NO (UI demo) - includes GxP-style comments and audit scaffolding
// Risk Level: LOW
// Validation Protocol: VP-TTT-001 (unit tests in lib)
// ============================================================================
 */

// Helper to deep-freeze a board for audit immutability (shallow array sufficient)
const freezeBoard = (b: Board) => Object.freeze(b.slice() as Board);

// PUBLIC_INTERFACE
export default component$(() => {
  /**
   * State store
   * board: immutable 9-cell board
   * message: user-friendly status/error
   * over: game ended flag
   * current: current player's turn
   */
  const state = useStore<{
    board: Board;
    message: string;
    over: boolean;
    current: Player;
  }>({
    board: createEmptyBoard(),
    message: "Player X's turn",
    over: false,
    current: "X",
  });

  // Client-only audit list (in-memory)
  const audits = useStore<{ events: AuditEvent[] }>({ events: [] });

  // Error banner signal (for transient errors)
  const errorMsg = useSignal<string | null>(null);

  const updateStatus = $(() => {
    const res = getWinner(state.board);
    if (res.winner) {
      state.message = `Player ${res.winner} wins!`;
      state.over = true;
      return;
    }
    if (res.draw || isDraw(state.board)) {
      state.message = "It's a draw.";
      state.over = true;
      return;
    }
    state.current = nextPlayer(state.board);
    state.message = `Player ${state.current}'s turn`;
    state.over = false;
  });

  const logEvent = $((ev: AuditEvent) => {
    // Ensure immutability for audit log entries.
    audits.events.push({
      ...ev,
      before: ev.before ? Object.freeze([...ev.before]) : undefined,
      after: ev.after ? Object.freeze([...ev.after]) : undefined,
    });
  });

  const handleCellClick = $(async (index: number) => {
    // Input validation and graceful error handling
    try {
      if (!Number.isInteger(index) || index < 0 || index > 8) {
        errorMsg.value = "Invalid position.";
        await logEvent({
          timestamp: new Date().toISOString(),
          action: "ERROR",
          userId: "anonymous",
          meta: { message: "Out of range index", index },
          before: state.board,
        });
        return;
      }
      if (state.over) {
        errorMsg.value = "Game is already over. Please restart.";
        await logEvent({
          timestamp: new Date().toISOString(),
          action: "ERROR",
          userId: "anonymous",
          meta: { message: "Move after game over", index },
          before: state.board,
        });
        return;
      }
      if (!isValidMove(state.board, index)) {
        errorMsg.value = "Cell already occupied.";
        await logEvent({
          timestamp: new Date().toISOString(),
          action: "ERROR",
          userId: "anonymous",
          meta: { message: "Invalid move - occupied", index },
          before: state.board,
        });
        return;
      }

      const before = freezeBoard(state.board);
      const next = applyMove(state.board, index, state.current);
      state.board = freezeBoard(next);
      await logEvent({
        timestamp: new Date().toISOString(),
        action: "MOVE",
        userId: "anonymous",
        before,
        after: next,
        meta: { index, player: state.current },
      });

      await updateStatus();
      errorMsg.value = null;
    } catch (err: any) {
      // Technical error logging
      const message = err?.message ?? "Unexpected error";
      errorMsg.value = message;
      await logEvent({
        timestamp: new Date().toISOString(),
        action: "ERROR",
        userId: "anonymous",
        meta: { message, index },
        before: state.board,
      });
    }
  });

  const doReset = $(async () => {
    const before = freezeBoard(state.board);
    state.board = freezeBoard(resetGame());
    state.current = "X";
    state.over = false;
    state.message = "Player X's turn";
    errorMsg.value = null;

    await logEvent({
      timestamp: new Date().toISOString(),
      action: "RESET",
      userId: "anonymous",
      before,
      after: state.board,
    });
  });

  const clearAudit = $(() => {
    audits.events.length = 0;
  });

  return (
    <div class="container">
      <div class="card" role="region" aria-label="Tic Tac Toe game">
        <div class="card-header">
          <div>
            <h1 class="title" style={{ marginBottom: "4px" }}>
              Tic Tac Toe
            </h1>
            <p class="subtitle">Ocean Professional Theme</p>
          </div>
          <button type="button" class="btn btn-outline" onClick$={doReset} aria-label="Restart the game">
            Restart
          </button>
        </div>

        <div
          class="status"
          role="status"
          aria-live="polite"
          style={{ borderColor: state.over ? "rgba(245, 158, 11, 0.5)" : "rgba(37, 99, 235, 0.2)" }}
        >
          {state.message}
        </div>

        {errorMsg.value ? (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 12px",
              background: "#ffecec",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#7f1d1d",
              borderRadius: "12px",
            }}
            role="alert"
          >
            {errorMsg.value}
          </div>
        ) : null}

        <div class="grid" role="grid" aria-label="Tic Tac Toe board">
          {state.board.map((cell, i) => (
            <button
              key={i}
              type="button"
              role="gridcell"
              class="cell"
              aria-label={`Cell ${i + 1}, ${cell ?? "empty"}`}
              aria-disabled={state.over || !!cell}
              onClick$={() => handleCellClick(i)}
            >
              {cell ?? ""}
            </button>
          ))}
        </div>

        <div class="controls">
          <div class="helper">Tip: First player is X. Click Restart to play again.</div>
          <button type="button" class="btn btn-primary" onClick$={doReset}>
            Reset Game
          </button>
        </div>

        <AuditTrailPanel events={audits.events} onClear$={clearAudit} />
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Tic Tac Toe - Ocean Professional",
  meta: [
    {
      name: "description",
      content:
        "A modern Qwik-based Tic Tac Toe game with Ocean Professional theme, validation, audit trail, and accessibility.",
    },
  ],
};
