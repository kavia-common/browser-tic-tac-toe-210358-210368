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
              aria-label={`Cell ${i + 1}, ${cell ? (cell === "X" ? "Knight" : "Queen") : "empty"}`}
              aria-disabled={state.over || !!cell}
              onClick$={() => handleCellClick(i)}
            >
              {cell === "X" ? (
                // Knight icon (represents previous "X")
                <svg
                  class="icon piece-x"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Knight"
                >
                  <title>Knight</title>
                  <path
                    d="M6 19h12v-2h-1v-3.5c0-.8-.3-1.6-.9-2.2l-2.6-2.6c-.3-.3-.5-.7-.5-1.1V6h.5c.8 0 1.5.7 1.5 1.5V9h2V7.5C17 5.6 15.4 4 13.5 4H11c-.6 0-1 .4-1 1v1.6c0 .7.3 1.4.8 1.9l.9.9c.2.2.3.5.3.8v.3l-2.4-1.2c-.3-.1-.6 0-.8.2l-2 2c-.2.2-.3.5-.2.8l.7 1.8c.1.2.1.5 0 .7l-.7 1.4V17H6v2z"
                    fill="currentColor"
                  />
                </svg>
              ) : cell === "O" ? (
                // Queen icon (represents previous "O")
                <svg
                  class="icon piece-o"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Queen"
                >
                  <title>Queen</title>
                  <path
                    d="M7 21h10c.6 0 1-.4 1-1v-1.1c0-.3-.1-.6-.3-.8l-2.8-3.1c1.3-.6 2.2-1.9 2.2-3.4V7.5l1 .5 1-2-2-.9-1 .4-1-1.5-2 1 .5 1.4L12 6l-1.6-.6.5-1.4-2-1-1 1.5-1-.4-2 .9 1 2 1-.5V11c0 1.5.9 2.8 2.2 3.4L6.3 18c-.2.2-.3.5-.3.8V20c0 .6.4 1 1 1z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                ""
              )}
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
