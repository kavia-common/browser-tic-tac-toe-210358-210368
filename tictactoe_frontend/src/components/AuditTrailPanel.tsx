import { component$, useSignal, $, type PropFunction } from "@builder.io/qwik";

export interface AuditEvent {
  // ISO timestamp of the event
  timestamp: string;
  // Action type (MOVE/RESET); GxP template uses CRUD; adapted for UI demo
  action: "MOVE" | "RESET" | "ERROR";
  // Pseudo user attribution; in real app retrieve from auth context
  userId: string;
  // Optional free-text reason
  reason?: string;
  // Before and after board states as arrays for immutability proof
  before?: ReadonlyArray<string | null>;
  after?: ReadonlyArray<string | null>;
  // Extra metadata e.g., move index, player, message for errors
  meta?: Record<string, unknown>;
}

// PUBLIC_INTERFACE
export const AuditTrailPanel = component$<{
  events: ReadonlyArray<AuditEvent>;
  onClear$?: PropFunction<() => void>;
}>((props) => {
  /**
   * AuditTrailPanel
   * Displays a collapsible list of recent audit events.
   * Accessibility: details/summary pattern, keyboard accessible by default.
   */
  const isOpen = useSignal(false);

  const toggle$ = $(() => {
    isOpen.value = !isOpen.value;
  });

  return (
    <section class="audit" aria-label="Audit Trail">
      <button
        type="button"
        class="btn btn-outline"
        aria-expanded={isOpen.value}
        aria-controls="audit-panel"
        onClick$={toggle$}
      >
        {isOpen.value ? "Hide Audit Trail" : "Show Audit Trail"}
      </button>
      {props.onClear$ && isOpen.value && (
        <button type="button" class="btn btn-outline" onClick$={props.onClear$}>
          Clear
        </button>
      )}
      <div id="audit-panel" hidden={!isOpen.value} style={{ marginTop: "12px" }}>
        {props.events.length === 0 ? (
          <p class="helper">No audit events yet.</p>
        ) : (
          <ol style={{ paddingLeft: "18px", margin: 0 }}>
            {props.events
              .slice()
              .reverse()
              .map((ev, i) => (
                <li key={i} style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#374151" }}>
                    <strong>{ev.action}</strong> · {ev.timestamp} · user: {ev.userId}
                    {ev.meta?.message ? <> · {String(ev.meta.message)}</> : null}
                  </div>
                  {ev.meta && (ev.meta as any).index !== undefined ? (
                    <div class="helper">index: {(ev.meta as any).index as number}</div>
                  ) : null}
                  {ev.meta && (ev.meta as any).player ? (
                    <div class="helper">player: {(ev.meta as any).player as string}</div>
                  ) : null}
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
});
