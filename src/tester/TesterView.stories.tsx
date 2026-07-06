import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useReducer, useState } from "react";

import { hid_usage_from_page_and_id } from "../hid-usages";
import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { KeyPosition } from "../keyboard/PhysicalLayout";
import { KEY_EVENT_CODE_TO_HID_USAGES } from "./key-event-map";
import {
  TesterState,
  initialTesterState,
  testerReducer,
} from "./tester-state";
import { TesterView } from "./TesterView";
import { useKeyEventCapture } from "./useKeyEventCapture";

const meta = {
  title: "Tester/TesterView",
  component: TesterView,
  tags: ["autodocs"],
} satisfies Meta<typeof TesterView>;

export default meta;
type Story = StoryObj<typeof meta>;

// A fake Lily58-style split: two mirrored 4×6 column-staggered halves, an
// extra inner key each, and a four-key thumb arc — matching the layout shape
// this tester actually meets, and exercising the same split/stagger/rotation
// rendering as real ZMK physical layouts. This board exists only for
// device-free development: the connected app reads the real physical layout
// and keymap from the keyboard over RPC. usageId is the keyboard-page HID
// usage, or undefined for keys with no host-detectable output (layer holds).
interface FakeKey {
  x: number;
  y: number;
  r?: number;
  rx?: number;
  ry?: number;
  usageId?: number;
  header?: string;
}

// Column stagger in U, outer pinky column → inner index column.
const STAGGER = [0.5, 0.375, 0.125, 0, 0.125, 0.25];

const letter = (c: string) => c.charCodeAt(0) - 61;

// Lily58 default keymap. Usage per matrix slot, row-major. Left rows are
// outer→inner; right rows are inner→outer (ascending x).
const LEFT_ROWS = [
  [0x29, 0x1e, 0x1f, 0x20, 0x21, 0x22], // Esc 1 2 3 4 5
  [0x2b, ...[..."QWERT"].map(letter)],
  [0xe0, ...[..."ASDFG"].map(letter)],
  [0xe1, ...[..."ZXCVB"].map(letter)],
];
const RIGHT_ROWS = [
  [0x23, 0x24, 0x25, 0x26, 0x27, 0x35], // 6 7 8 9 0 `
  [...[..."YUIOP"].map(letter), 0x2d],
  [...[..."HJKL"].map(letter), 0x33, 0x34],
  [...[..."NM"].map(letter), 0x36, 0x37, 0x38, 0xe5],
];

const BOARD_WIDTH = 16; // left half 0..7, right half mirrored from 9
const keyPress = (usageId: number) => ({ usageId, header: "Key Press" });
const layerHold = { usageId: undefined, header: "Momentary Layer" };

const FAKE_KEYS: FakeKey[] = [
  // Left half, then right half mirrored across the board's center line.
  ...LEFT_ROWS.flatMap((row, r) =>
    row.map((usageId, c) => ({ x: c, y: STAGGER[c] + r, ...keyPress(usageId) }))
  ),
  ...RIGHT_ROWS.flatMap((row, r) =>
    row.map((usageId, c) => ({
      x: BOARD_WIDTH - 6 + c,
      y: STAGGER[5 - c] + r,
      ...keyPress(usageId),
    }))
  ),
  // Extra inner keys nestled into the gap between the halves.
  { x: 6, y: 2.75, ...keyPress(0x2f) }, // [
  { x: 9, y: 2.75, ...keyPress(0x30) }, // ]
  // Thumb arcs: outer two keys flat, inner two edge-adjacent and rotating
  // around their shared corner, each following the arc of the previous key's
  // outer edge, mirrored across the board's center line.
  { x: 3.6, y: 4.3, r: 0, ...keyPress(0xe2) }, // Alt
  { x: 4.62, y: 4.3, r: 0, ...keyPress(0xe3) }, // GUI
  { x: 5.64, y: 4.3, r: 15, rx: 5.64, ry: 4.3, ...layerHold }, // Lower
  { x: 6.61, y: 4.56, r: 30, rx: 6.61, ry: 4.56, ...keyPress(0x2c) }, // Space
  { x: 8.39, y: 4.56, r: -30, rx: 9.39, ry: 4.56, ...keyPress(0x28) }, // Enter
  { x: 9.36, y: 4.3, r: -15, rx: 10.36, ry: 4.3, ...layerHold }, // Raise
  { x: 10.38, y: 4.3, r: 0, ...keyPress(0x2a) }, // Bspc
  { x: 11.4, y: 4.3, r: 0, ...keyPress(0xe7) }, // GUI
];

const positions: KeyPosition[] = FAKE_KEYS.map((k, i) => ({
  id: `tester-${i}`,
  header: k.header,
  x: k.x,
  y: k.y,
  r: k.r,
  rx: k.rx,
  ry: k.ry,
  width: 1,
  height: 1,
  children:
    k.usageId !== undefined ? (
      <HidUsageLabel hid_usage={hid_usage_from_page_and_id(7, k.usageId)} />
    ) : (
      <span></span>
    ),
}));

const byUsage = new Map<number, number[]>();
const testable = new Set<number>();
const untestable = new Set<number>();
FAKE_KEYS.forEach((k, i) => {
  if (k.usageId === undefined) {
    untestable.add(i);
    return;
  }
  const usage = hid_usage_from_page_and_id(7, k.usageId);
  byUsage.set(usage, [...(byUsage.get(usage) || []), i]);
  testable.add(i);
});

const LAYERS = [
  { id: 0, name: "Base" },
  { id: 1, name: "Lower" },
];

const noop = () => {};

const viewProps = (state: TesterState) => ({
  positions,
  state,
  testable,
  untestable,
  layers: LAYERS,
  selectedLayerIndex: 0,
  onLayerChange: noop,
  chatterThresholdMs: 40,
  onChatterThresholdChange: noop,
  onReset: noop,
  onPositionClicked: noop,
});

// Positions of the seeded keys, looked up by usage so the seed survives
// layout reshuffles.
const posOf = (usageId: number) =>
  FAKE_KEYS.findIndex((k) => k.usageId === usageId);
const [POS_Q, POS_W, POS_E, POS_R] = [0x14, 0x1a, 0x08, 0x15].map(posOf);

// Static snapshot exercising every key state at once: held (Q), chatter
// (W, focused — red glitch pulses in the trace), tested (E/R), untestable
// thumb keys dashed, populated rollover and readout cards.
const SEEDED_STATE: TesterState = {
  byPosition: {
    [POS_Q]: {
      pressCount: 3,
      held: true,
      tested: true,
      chatterCount: 0,
      lastPressAt: 1000,
      pulses: [
        { downAt: 300, upAt: 420, chatter: false },
        { downAt: 620, upAt: 700, chatter: false },
        { downAt: 1000, chatter: false },
      ],
    },
    [POS_W]: {
      pressCount: 8,
      held: false,
      tested: true,
      chatterCount: 2,
      lastChatterGapMs: 12.5,
      lastReleaseAt: 900,
      lastHoldMs: 80,
      minHoldMs: 11,
      maxHoldMs: 141,
      pulses: [
        { downAt: 100, upAt: 241, chatter: false },
        { downAt: 300, upAt: 340, chatter: false },
        { downAt: 352.5, upAt: 363.5, chatter: true },
        { downAt: 380, upAt: 460, chatter: true },
        { downAt: 700, upAt: 820, chatter: false },
        { downAt: 850, upAt: 900, chatter: false },
      ],
    },
    [POS_E]: {
      pressCount: 1,
      held: false,
      tested: true,
      chatterCount: 0,
      lastReleaseAt: 500,
      lastHoldMs: 95,
      minHoldMs: 95,
      maxHoldMs: 95,
      pulses: [{ downAt: 405, upAt: 500, chatter: false }],
    },
    [POS_R]: {
      pressCount: 2,
      held: false,
      tested: true,
      chatterCount: 0,
      lastReleaseAt: 700,
      lastHoldMs: 60,
      minHoldMs: 55,
      maxHoldMs: 60,
      pulses: [
        { downAt: 200, upAt: 255, chatter: false },
        { downAt: 640, upAt: 700, chatter: false },
      ],
    },
  },
  heldByCode: {
    KeyQ: {
      code: "KeyQ",
      usages: [hid_usage_from_page_and_id(7, 0x14)],
      positions: [POS_Q],
      pressedAt: 1000,
    },
  },
  maxSimultaneous: 4,
  lastEvent: {
    code: "KeyQ",
    usages: [hid_usage_from_page_and_id(7, 0x14)],
    positions: [POS_Q],
  },
  focusedPosition: POS_W,
};

export const AllStates: Story = {
  args: viewProps(SEEDED_STATE),
};

// Live harness: press keys on the keyboard you're using right now and watch
// the fake split board light up. Doubles as the no-device end-to-end test of
// the event-capture → usage-mapping → reducer → view pipeline.
const InteractiveTester = () => {
  const [state, dispatch] = useReducer(testerReducer, initialTesterState);
  const [chatterThresholdMs, setChatterThresholdMs] = useState(40);

  const onPress = useCallback(
    (code: string, t: number) => {
      const usages = KEY_EVENT_CODE_TO_HID_USAGES[code] || [];
      const matched = new Set<number>();
      for (const usage of usages) {
        for (const pos of byUsage.get(usage) || []) {
          matched.add(pos);
        }
      }
      dispatch({
        type: "press",
        code,
        usages,
        positions: [...matched],
        t,
        chatterThresholdMs,
      });
    },
    [chatterThresholdMs]
  );

  useKeyEventCapture(true, {
    onPress,
    onRelease: (code, t) => dispatch({ type: "release", code, t }),
    onForceReleaseAll: () => dispatch({ type: "forceReleaseAll" }),
  });

  return (
    <TesterView
      {...viewProps(state)}
      chatterThresholdMs={chatterThresholdMs}
      onChatterThresholdChange={setChatterThresholdMs}
      onReset={() => dispatch({ type: "reset" })}
      onPositionClicked={(position) => dispatch({ type: "focus", position })}
    />
  );
};

export const Interactive: Story = {
  args: viewProps(initialTesterState),
  render: () => <InteractiveTester />,
};
