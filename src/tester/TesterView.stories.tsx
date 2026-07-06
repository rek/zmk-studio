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

// A fake 40%-ish board: usage per key (keyboard page), or undefined for keys
// with no host-detectable output (e.g. layer holds).
interface FakeKey {
  x: number;
  y: number;
  width?: number;
  usageId?: number;
  header?: string;
}

const row = (usageIds: number[], y: number, x0 = 0): FakeKey[] =>
  usageIds.map((usageId, i) => ({ x: x0 + i, y, usageId, header: "Key Press" }));

const FAKE_KEYS: FakeKey[] = [
  ...row([...[..."QWERTYUIOP"].map((c) => c.charCodeAt(0) - 61), 42], 0),
  ...row([...[..."ASDFGHJKL"].map((c) => c.charCodeAt(0) - 61), 51, 40], 1),
  ...row([...[..."ZXCVBNM"].map((c) => c.charCodeAt(0) - 61), 54, 55, 56], 2),
  { x: 0, y: 3, width: 1.25, usageId: 0xe0, header: "Key Press" },
  { x: 1.25, y: 3, width: 1.25, usageId: 0xe2, header: "Key Press" },
  { x: 2.5, y: 3, width: 1.5, header: "Layer Tap" }, // not host-detectable
  { x: 4, y: 3, width: 3, usageId: 0x2c, header: "Key Press" },
  { x: 7, y: 3, width: 1.5, header: "Momentary Layer" }, // not host-detectable
  { x: 8.5, y: 3, width: 1.25, usageId: 0xe5, header: "Key Press" },
  { x: 9.75, y: 3, width: 1.25, usageId: 0xe4, header: "Key Press" },
];

const positions: KeyPosition[] = FAKE_KEYS.map((k, i) => ({
  id: `tester-${i}`,
  header: k.header,
  x: k.x,
  y: k.y,
  width: k.width || 1,
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

// Static snapshot exercising every key state at once: held (Q), chatter (W),
// tested (E/R), untestable dimmed, populated held-keys row and stats panel.
const SEEDED_STATE: TesterState = {
  byPosition: {
    0: { pressCount: 3, held: true, tested: true, chatterCount: 0, lastPressAt: 1000 },
    1: {
      pressCount: 8,
      held: false,
      tested: true,
      chatterCount: 2,
      lastChatterGapMs: 12.5,
      lastReleaseAt: 900,
      lastHoldMs: 80,
      minHoldMs: 11,
      maxHoldMs: 141,
    },
    2: {
      pressCount: 1,
      held: false,
      tested: true,
      chatterCount: 0,
      lastReleaseAt: 500,
      lastHoldMs: 95,
      minHoldMs: 95,
      maxHoldMs: 95,
    },
    3: { pressCount: 2, held: false, tested: true, chatterCount: 0, lastReleaseAt: 700, lastHoldMs: 60, minHoldMs: 55, maxHoldMs: 60 },
  },
  heldByCode: {
    KeyQ: {
      code: "KeyQ",
      usages: [hid_usage_from_page_and_id(7, 0x14)],
      positions: [0],
      pressedAt: 1000,
    },
  },
  maxSimultaneous: 4,
  lastEvent: {
    code: "KeyQ",
    usages: [hid_usage_from_page_and_id(7, 0x14)],
    positions: [0],
  },
  focusedPosition: 1,
};

export const AllStates: Story = {
  args: viewProps(SEEDED_STATE),
};

// Live harness: press keys on the keyboard you're using right now and watch
// the fake board light up. Doubles as the no-device end-to-end test of the
// event-capture → usage-mapping → reducer → view pipeline.
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
