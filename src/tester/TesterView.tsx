import { ReactNode, useMemo } from "react";
import { Button } from "react-aria-components";

import {
  KeyPosition,
  PhysicalLayout as PhysicalLayoutComp,
} from "../keyboard/PhysicalLayout";
import { HeldKeysRow } from "./HeldKeysRow";
import { StatsPanel } from "./StatsPanel";
import { TesterState, untestedCount } from "./tester-state";
import {
  KEY_STATE_CLASSES,
  KEY_STATE_DOTS,
  KeyTestState,
  MONO_DATA,
  SILKSCREEN,
} from "./ui";

const CHATTER_THRESHOLD_CHOICES_MS = [20, 30, 40, 50];

const keyTestState = (
  state: TesterState,
  untestable: Set<number>,
  position: number
): KeyTestState => {
  const stats = state.byPosition[position];
  if (stats?.held) {
    return "held";
  }
  if (stats?.chatterCount) {
    return "chatter";
  }
  if (stats?.tested) {
    return "tested";
  }
  if (untestable.has(position)) {
    return "untestable";
  }
  return "untested";
};

// Perfboard-style dot grid behind the board; currentColor keeps it legible
// in both light and dark themes.
const MAT_STYLE = {
  backgroundImage:
    "radial-gradient(color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1.5px)",
  backgroundSize: "14px 14px",
  backgroundPosition: "7px 7px",
};

// One LED segment per physical key, in key-position order: a minimap of the
// scan matrix. Untestable positions render as gaps — they aren't part of the
// pass count.
const LedBar = ({
  count,
  state,
  untestable,
}: {
  count: number;
  state: TesterState;
  untestable: Set<number>;
}) => (
  <div className="flex max-w-[24rem] flex-wrap gap-[2px]">
    {Array.from({ length: count }, (_, i) => (
      <span
        key={i}
        className={`h-2 w-[4px] rounded-[1px] ${KEY_STATE_DOTS[keyTestState(state, untestable, i)]}`}
      />
    ))}
  </div>
);

const LEGEND: { state: KeyTestState; label: string }[] = [
  { state: "untested", label: "untested" },
  { state: "held", label: "held" },
  { state: "tested", label: "tested" },
  { state: "chatter", label: "chatter" },
  { state: "untestable", label: "no output" },
];

const Legend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    {LEGEND.map(({ state, label }) => (
      <span key={state} className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            state === "untestable"
              ? "border border-dashed border-base-content opacity-50"
              : KEY_STATE_DOTS[state]
          }`}
        />
        <span className={SILKSCREEN}>{label}</span>
      </span>
    ))}
  </div>
);

const Control = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className={SILKSCREEN}>{label}</span>
    {children}
  </label>
);

const SELECT_CLASS =
  "rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[0.8rem] hover:border-base-content/50";

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

// Presentational tester view (no RPC): instrument header (progress LED bar,
// layer + chatter controls), the physical layout on a perfboard mat with
// per-key test-state coloring, and the rollover / switch-readout cards.
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
        className: KEY_STATE_CLASSES[keyTestState(state, untestable, idx)],
      })),
    [positions, state, untestable]
  );

  const untested = untestedCount(state, testable);
  const done = untested === 0 && testable.size > 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-hidden p-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-1">
        <div className="flex flex-col gap-1">
          <span className={SILKSCREEN}>Switch test</span>
          <div className="flex items-center gap-2.5">
            <span
              className={`${MONO_DATA} ${done ? "text-accent" : ""}`}
            >
              {testable.size - untested}/{testable.size}
            </span>
            <LedBar
              count={positions.length}
              state={state}
              untestable={untestable}
            />
            {done && <span className={`${SILKSCREEN} text-accent opacity-100`}>all switches pass</span>}
          </div>
        </div>
        <Control label="Layer">
          <select
            className={SELECT_CLASS}
            value={selectedLayerIndex}
            onChange={(e) => onLayerChange(parseInt(e.target.value, 10))}
          >
            {layers.map((l, i) => (
              <option key={l.id} value={i}>
                {l.name || i.toLocaleString()}
              </option>
            ))}
          </select>
        </Control>
        <Control label="Chatter under">
          <select
            className={SELECT_CLASS}
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
        </Control>
        <Button
          className="rounded-md border border-base-300 px-3 py-1 text-[0.8rem] hover:bg-base-300"
          onPress={onReset}
        >
          Reset test
        </Button>
        <div className="ml-auto self-center">
          <Legend />
        </div>
      </div>

      <div
        className="relative grid min-h-[16rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-base-300 bg-base-200 text-base-content"
        style={MAT_STYLE}
      >
        <PhysicalLayoutComp
          positions={decoratedPositions}
          oneU={48}
          hoverZoom={false}
          zoom="auto"
          onPositionClicked={onPositionClicked}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <HeldKeysRow state={state} />
        <StatsPanel state={state} />
      </div>

      <p className="px-1 text-[0.7rem] leading-relaxed opacity-50">
        Detection listens to this computer&apos;s key events on the selected
        layer. Switches that send nothing the host can hear — layer holds,
        Bluetooth, lighting — stay dashed, and the browser keeps a few
        shortcuts for itself. The desktop app captures almost everything.
      </p>
    </div>
  );
};
