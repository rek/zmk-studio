import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { useBehaviors, useLayouts } from "../keyboard/Keyboard";
import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { KeyPosition } from "../keyboard/PhysicalLayout";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { call_rpc } from "../rpc/logging";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { useLocalStorageState } from "../misc/useLocalStorageState";

import { HOST_DETECTABLE_USAGES } from "./key-event-map";
import {
  buildUsageToPositions,
  matchCodeToPositions,
} from "./usage-to-positions";
import { initialTesterState, testerReducer } from "./tester-state";
import { useKeyEventCapture } from "./useKeyEventCapture";
import { TesterView } from "./TesterView";

// Connected matrix tester container: fetches the same read-only data as the
// keymap editor (physical layout, keymap, behaviors — all unlock-gated) and
// wires host key events into the tester reducer. `active` gates the window
// key listeners so typing works normally on the other tab.
export default function MatrixTester({ active }: { active: boolean }) {
  const conn = useContext(ConnectionContext);

  const [
    layouts,
    setLayouts,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ] = useLayouts();
  const behaviors = useBehaviors();
  const [keymap, setKeymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (keymap) => keymap?.keymap?.getKeymap,
    true
  );

  // Re-sync on every tab activation: bindings and the active physical layout
  // can change in the keymap editor while this tab is hidden, and a stale
  // usage-to-position index lights the wrong keys.
  useEffect(() => {
    const c = conn.conn;
    if (!active || !c) {
      return;
    }
    let ignore = false;
    (async () => {
      const keymapResp = await call_rpc(c, { keymap: { getKeymap: true } });
      const layoutsResp = await call_rpc(c, {
        keymap: { getPhysicalLayouts: true },
      });
      if (ignore) {
        return;
      }
      const freshKeymap = keymapResp?.keymap?.getKeymap;
      if (freshKeymap) {
        setKeymap(freshKeymap);
      }
      const freshLayouts = layoutsResp?.keymap?.getPhysicalLayouts;
      if (freshLayouts) {
        setLayouts(freshLayouts.layouts);
        setSelectedPhysicalLayoutIndex(freshLayouts.activeLayoutIndex || 0);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [active, conn, setKeymap, setLayouts, setSelectedPhysicalLayoutIndex]);

  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [chatterThresholdMs, setChatterThresholdMs] =
    useLocalStorageState<number>("testerChatterThreshold", 40, {
      deserialize: (v) => parseInt(v, 10) || 40,
    });

  const [state, dispatch] = useReducer(testerReducer, initialTesterState);

  useEffect(() => {
    setSelectedLayerIndex(0);
    dispatch({ type: "reset" });
  }, [conn]);

  // A refetched keymap can have fewer layers than the current selection.
  useEffect(() => {
    if (keymap && selectedLayerIndex >= keymap.layers.length) {
      setSelectedLayerIndex(Math.max(0, keymap.layers.length - 1));
    }
  }, [keymap, selectedLayerIndex]);

  const layout = layouts?.[selectedPhysicalLayoutIndex];
  const layer = keymap?.layers[selectedLayerIndex];

  const index = useMemo(
    () =>
      keymap
        ? buildUsageToPositions(
            keymap,
            selectedLayerIndex,
            behaviors,
            HOST_DETECTABLE_USAGES
          )
        : undefined,
    [keymap, selectedLayerIndex, behaviors]
  );

  const positions: KeyPosition[] = useMemo(() => {
    if (!layout || !layer) {
      return [];
    }
    return layout.keys.map((k, i) => ({
      id: `${layer.id}-${i}`,
      header: behaviors[layer.bindings[i]?.behaviorId]?.displayName || "",
      x: k.x / 100.0,
      y: k.y / 100.0,
      width: k.width / 100.0,
      height: k.height / 100.0,
      r: (k.r || 0) / 100.0,
      rx: (k.rx || 0) / 100.0,
      ry: (k.ry || 0) / 100.0,
      children: layer.bindings[i] ? (
        <HidUsageLabel hid_usage={layer.bindings[i].param1} />
      ) : (
        <span></span>
      ),
    }));
  }, [layout, layer, behaviors]);

  const onPress = useCallback(
    (code: string, t: number) => {
      const { usages, positions } = matchCodeToPositions(
        code,
        index?.byUsage ?? new Map()
      );
      dispatch({
        type: "press",
        code,
        usages,
        positions,
        t,
        chatterThresholdMs,
      });
    },
    [index, chatterThresholdMs]
  );

  const onRelease = useCallback((code: string, t: number) => {
    dispatch({ type: "release", code, t });
  }, []);

  const onForceReleaseAll = useCallback(() => {
    dispatch({ type: "forceReleaseAll" });
  }, []);

  useKeyEventCapture(active && !!index && positions.length > 0, {
    onPress,
    onRelease,
    onForceReleaseAll,
  });

  if (!conn.conn || !keymap || !layout || !index) {
    return (
      <div className="grid items-center justify-center">
        <p className="opacity-70">
          Connect and unlock your keyboard to use the key tester.
        </p>
      </div>
    );
  }

  return (
    <TesterView
      positions={positions}
      state={state}
      testable={index.testable}
      untestable={index.untestable}
      layers={keymap.layers}
      selectedLayerIndex={selectedLayerIndex}
      onLayerChange={setSelectedLayerIndex}
      chatterThresholdMs={chatterThresholdMs}
      onChatterThresholdChange={setChatterThresholdMs}
      onReset={() => dispatch({ type: "reset" })}
      onPositionClicked={(position) => dispatch({ type: "focus", position })}
    />
  );
}
