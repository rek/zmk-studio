import { produce } from "immer";

// One switch closure: down edge, up edge (absent while still held), and
// whether the closure re-fired within the chatter threshold of the previous
// release. Feeds the pulse-trace visualization in the switch readout.
export interface KeyPulse {
  downAt: number;
  upAt?: number;
  chatter: boolean;
}

// Bounded per-position history; old pulses scroll off the left of the trace.
export const MAX_PULSES = 14;

export interface KeyPositionStats {
  pressCount: number;
  held: boolean;
  tested: boolean;
  lastPressAt?: number;
  lastReleaseAt?: number;
  lastHoldMs?: number;
  minHoldMs?: number;
  maxHoldMs?: number;
  chatterCount: number;
  lastChatterGapMs?: number;
  pulses: KeyPulse[];
}

export interface HeldKey {
  code: string;
  usages: number[];
  // Captured at press time so a release still resolves to the right keys even
  // if the user changes the tester's layer selection mid-hold.
  positions: number[];
  pressedAt: number;
}

export interface LastEvent {
  code: string;
  usages: number[];
  positions: number[];
}

export interface TesterState {
  byPosition: Record<number, KeyPositionStats>;
  heldByCode: Record<string, HeldKey>;
  maxSimultaneous: number;
  lastEvent?: LastEvent;
  focusedPosition?: number;
}

export type TesterAction =
  | {
      type: "press";
      code: string;
      usages: number[];
      positions: number[];
      t: number;
      chatterThresholdMs: number;
    }
  | { type: "release"; code: string; t: number }
  | { type: "focus"; position: number }
  | { type: "forceReleaseAll" }
  | { type: "reset" };

export const initialTesterState: TesterState = {
  byPosition: {},
  heldByCode: {},
  maxSimultaneous: 0,
};

const emptyStats = (): KeyPositionStats => ({
  pressCount: 0,
  held: false,
  tested: false,
  chatterCount: 0,
  pulses: [],
});

export const testerReducer = produce(
  (state: TesterState, action: TesterAction) => {
    switch (action.type) {
      case "press": {
        const { code, usages, positions, t, chatterThresholdMs } = action;
        if (state.heldByCode[code]) {
          // Missed the release (shouldn't happen with repeat filtering); treat
          // as still held rather than double-counting a press.
          return;
        }

        for (const pos of positions) {
          const stats = (state.byPosition[pos] ??= emptyStats());
          stats.pressCount += 1;
          stats.held = true;
          stats.tested = true;
          const gap =
            stats.lastReleaseAt !== undefined
              ? t - stats.lastReleaseAt
              : undefined;
          const chatter = gap !== undefined && gap < chatterThresholdMs;
          if (chatter) {
            stats.chatterCount += 1;
            stats.lastChatterGapMs = gap;
          }
          stats.lastPressAt = t;
          stats.pulses.push({ downAt: t, chatter });
          if (stats.pulses.length > MAX_PULSES) {
            stats.pulses.shift();
          }
        }

        state.heldByCode[code] = { code, usages, positions, pressedAt: t };
        state.maxSimultaneous = Math.max(
          state.maxSimultaneous,
          Object.keys(state.heldByCode).length
        );
        state.lastEvent = { code, usages, positions };
        if (positions.length > 0) {
          state.focusedPosition = positions[0];
        }
        break;
      }
      case "release": {
        const held = state.heldByCode[action.code];
        if (!held) {
          return;
        }

        const holdMs = action.t - held.pressedAt;
        for (const pos of held.positions) {
          const stats = (state.byPosition[pos] ??= emptyStats());
          stats.held = false;
          stats.lastReleaseAt = action.t;
          stats.lastHoldMs = holdMs;
          stats.minHoldMs = Math.min(stats.minHoldMs ?? holdMs, holdMs);
          stats.maxHoldMs = Math.max(stats.maxHoldMs ?? holdMs, holdMs);
          for (let i = stats.pulses.length - 1; i >= 0; i--) {
            if (stats.pulses[i].upAt === undefined) {
              stats.pulses[i].upAt = action.t;
              break;
            }
          }
        }
        delete state.heldByCode[action.code];
        break;
      }
      case "focus": {
        state.focusedPosition = action.position;
        break;
      }
      case "forceReleaseAll": {
        // Focus loss means we may never see the keyup: clear held state
        // without recording hold durations or release times, so the next real
        // press isn't misread as chatter.
        for (const held of Object.values(state.heldByCode)) {
          for (const pos of held.positions) {
            const stats = state.byPosition[pos];
            if (stats) {
              stats.held = false;
              // Drop still-open pulses: with no keyup their duration is
              // unknowable, and a synthetic release would draw as a real one.
              stats.pulses = stats.pulses.filter((p) => p.upAt !== undefined);
            }
          }
        }
        state.heldByCode = {};
        break;
      }
      case "reset": {
        return initialTesterState;
      }
    }
  }
);

export const untestedCount = (
  state: TesterState,
  testable: Set<number>
): number => {
  let count = 0;
  for (const pos of testable) {
    if (!state.byPosition[pos]?.tested) {
      count += 1;
    }
  }
  return count;
};

export const heldKeysInPressOrder = (state: TesterState): HeldKey[] =>
  Object.values(state.heldByCode).sort((a, b) => a.pressedAt - b.pressedAt);
