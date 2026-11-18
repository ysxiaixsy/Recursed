/**
 * Holds the current run for the scenes. Each player action goes through
 * apply(): core computes the new run, the save is written at once, and only
 * then do the scenes animate. Closing the browser never undoes a choice.
 */
import type { BattleEvent, BattleState } from '../core/battle';
import { gameData } from '../core/gameData';
import { addPlayTime, newRun, runStep, type RunInput, type RunState } from '../core/run';
import { bridge } from './bridge';
import { clearRun, loadRun, saveRun } from './save';

export interface Applied {
  run: RunState;
  events: BattleEvent[];
  battle: BattleState | null;
}

class RunController {
  private current: RunState | null = null;
  private lastTick = performance.now();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      // Time in a hidden tab does not count as play time.
      if (document.visibilityState === 'visible') this.lastTick = performance.now();
      else this.tick();
    });
  }

  get run(): RunState | null {
    return this.current;
  }

  hasSave(): boolean {
    return loadRun() !== null;
  }

  start(seed: number, curse: string): RunState {
    this.lastTick = performance.now();
    return this.store(newRun(gameData, { seed, classId: 'warrior', curse }));
  }

  resume(): RunState | null {
    const run = loadRun();
    this.lastTick = performance.now();
    this.current = run;
    bridge.run = run;
    return run;
  }

  apply(input: RunInput): Applied {
    if (!this.current) throw new Error('No run');
    this.tick();
    const step = runStep(gameData, this.current, input);
    this.store(step.run);
    return step;
  }

  /** Forget the run, for a new start from the title. */
  leave(): void {
    this.current = null;
    bridge.run = null;
  }

  private tick(): void {
    const now = performance.now();
    if (this.current && this.current.outcome === null) this.current = addPlayTime(this.current, now - this.lastTick);
    this.lastTick = now;
  }

  private store(run: RunState): RunState {
    this.current = run;
    bridge.run = run;
    // Death and victory end the run: its save is deleted (HANDOFF S2).
    if (run.outcome === null) saveRun(run);
    else clearRun();
    return run;
  }
}

export const controller = new RunController();
