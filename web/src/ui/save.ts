/**
 * The run save in the browser (HANDOFF S2). A save is the run state as JSON,
 * written after each player action. Death or victory deletes it.
 */
import type { RunState } from '../core/run';

const KEY = 'recursed.run';

export function loadRun(): RunState | null {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return null;
    const run = JSON.parse(text) as RunState;
    return run.version === 1 && run.outcome === null ? run : null;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Private windows can refuse storage; the run goes on without a save.
  }
}

export function clearRun(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to remove.
  }
}
