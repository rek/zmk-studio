import { useMemo } from "react";
import { Button } from "react-aria-components";

import {
  KeyPosition,
  PhysicalLayout as PhysicalLayoutComp,
} from "../keyboard/PhysicalLayout";
import { HeldKeysRow } from "./HeldKeysRow";
import { StatsPanel } from "./StatsPanel";
import { TesterState, untestedCount } from "./tester-state";

const CHATTER_THRESHOLD_CHOICES_MS = [20, 30, 40, 50];

const KEY_STATE_CLASSES = {
  held: "bg-primary text-primary-content",
  chatter: "bg-red-500 text-white",
  tested: "bg-accent text-base-100",
  untestable: "bg-base-300 text-base-content opacity-40",
  untested: undefined, // Key's default colors
};

const keyStateClass = (
  state: TesterState,
  untestable: Set<number>,
  position: number
): string | undefined => {
  const stats = state.byPosition[position];
  if (stats?.held) {
    return KEY_STATE_CLASSES.held;
  }
  if (stats?.chatterCount) {
    return KEY_STATE_CLASSES.chatter;
  }
  if (stats?.tested) {
    return KEY_STATE_CLASSES.tested;
  }
  if (untestable.has(position)) {
    return KEY_STATE_CLASSES.untestable;
  }
  return KEY_STATE_CLASSES.untested;
};

const LegendChip = ({
  className,
  label,
}: {
  className?: string;
  label: string;
}) => (
  <span
    className={`rounded px-2 py-1 ${className || "bg-base-100 text-base-content"}`}
  >
    {label}
  </span>
);

export interface TesterViewProps {
  positions: KeyPosition[];
  state: TesterState;
  testable: Set<number>;
  untestable: Set<number>;
  layers: { id: number; name?: string }[];
  selectedLayerIndex: number;
  onLayerChange: (index: number) => void;
  chatterThresholdMs: number;
  onChatterThresholdChange: (ms: number) => void;
  onReset: () => void;
  onPositionClicked: (position: number) => void;
}

// Presentational tester view (no RPC): toolbar, the physical layout with
// per-key test-state coloring, the live held-keys row, and per-key stats.
export const TesterView = ({
  positions,
  state,
  testable,
  untestable,
  layers,
  selectedLayerIndex,
  onLayerChange,
  chatterThresholdMs,
  onChatterThresholdChange,
  onReset,
  onPositionClicked,
}: TesterViewProps) => {
  const decoratedPositions = useMemo(
    () =>
      positions.map((p, idx) => ({
        ...p,
        className: keyStateClass(state, untestable, idx),
      })),
    [positions, state, untestable]
  );

  const untested = untestedCount(state, testable);

  return (
    <div className="p-2 flex flex-col gap-2 max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap px-2">
        <label className="flex items-center gap-1">
          <span className="opacity-70">Layer:</span>
          <select
            className="rounded bg-base-200 hover:bg-base-300 px-2 py-1"
            value={selectedLayerIndex}
            onChange={(e) => onLayerChange(parseInt(e.target.value, 10))}
          >
            {layers.map((l, i) => (
              <option key={l.id} value={i}>
                {l.name || i.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="opacity-70">Chatter threshold:</span>
          <select
            className="rounded bg-base-200 hover:bg-base-300 px-2 py-1"
            value={chatterThresholdMs}
            onChange={(e) =>
              onChatterThresholdChange(parseInt(e.target.value, 10))
            }
          >
            {CHATTER_THRESHOLD_CHOICES_MS.map((ms) => (
              <option key={ms} value={ms}>
                {ms} ms
              </option>
            ))}
          </select>
        </label>
        <Button
          className="rounded bg-base-200 hover:bg-base-300 px-3 py-1"
          onPress={onReset}
        >
          Reset
        </Button>
        <span
          className={`rounded px-2 py-1 ${untested === 0 ? "bg-accent text-base-100" : "bg-base-200"}`}
        >
          {untested === 0
            ? `All ${testable.size} keys tested`
            : `${untested} of ${testable.size} keys untested`}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <LegendChip label="untested" />
          <LegendChip className={KEY_STATE_CLASSES.held} label="held" />
          <LegendChip className={KEY_STATE_CLASSES.tested} label="tested" />
          <LegendChip className={KEY_STATE_CLASSES.chatter} label="chatter" />
          <LegendChip
            className={KEY_STATE_CLASSES.untestable}
            label="not detectable"
          />
        </div>
      </div>
      <div className="grid items-center justify-center min-h-0 min-w-0 flex-1">
        <PhysicalLayoutComp
          positions={decoratedPositions}
          oneU={48}
          hoverZoom={false}
          zoom="auto"
          onPositionClicked={onPositionClicked}
        />
      </div>
      <HeldKeysRow state={state} />
      <StatsPanel state={state} />
      <p className="opacity-50 px-2">
        Detection uses host key events on the selected layer, so keys without
        output (layer holds, Bluetooth, RGB, ...) can&apos;t be sensed, and the
        browser may keep some system shortcuts for itself — the desktop app
        captures nearly everything.
      </p>
    </div>
  );
};
