import { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type {
  BehaviorParameterValueDescription,
  GetBehaviorDetailsResponse,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import {
  hid_usage_from_page_and_id,
  hid_usage_page_and_id_from_usage,
} from "../hid-usages";

export type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

// Strip the implicit modifier bits ZMK packs above the usage page (e.g.
// LS(N1)), the same way HidUsageLabel does, so a binding with implicit mods
// still matches the plain usage derived from a browser key event.
export const normalize_usage = (usage: number): number => {
  const [page, id] = hid_usage_page_and_id_from_usage(usage);
  return hid_usage_from_page_and_id(page & 0xff, id);
};

export interface UsagePositionIndex {
  byUsage: Map<number, number[]>;
  testable: Set<number>;
  untestable: Set<number>;
}

const paramTakesHidUsage = (
  descriptions: BehaviorParameterValueDescription[]
): boolean => descriptions.some((d) => d.hidUsage !== undefined);

// Index the selected layer's bindings by the (normalized) HID usages they
// send, using behavior metadata to decide which params are HID usages. This
// covers &kp as well as hold-tap/mod-tap tap params without hardcoding
// behavior names. Positions whose bindings send no host-detectable usage
// (layer keys, &bt, RGB, ...) land in `untestable`.
export function buildUsageToPositions(
  keymap: Keymap,
  layerIndex: number,
  behaviors: BehaviorMap,
  detectableUsages: Set<number>
): UsagePositionIndex {
  const byUsage = new Map<number, number[]>();
  const testable = new Set<number>();
  const untestable = new Set<number>();

  const bindings = keymap.layers[layerIndex]?.bindings || [];

  bindings.forEach((binding, position) => {
    const metadata = behaviors[binding.behaviorId]?.metadata || [];

    const usages: number[] = [];
    if (metadata.some((set) => paramTakesHidUsage(set.param1))) {
      usages.push(normalize_usage(binding.param1));
    }
    if (metadata.some((set) => paramTakesHidUsage(set.param2))) {
      usages.push(normalize_usage(binding.param2));
    }

    let detectable = false;
    for (const usage of usages) {
      const positions = byUsage.get(usage) || [];
      positions.push(position);
      byUsage.set(usage, positions);
      if (detectableUsages.has(usage)) {
        detectable = true;
      }
    }

    (detectable ? testable : untestable).add(position);
  });

  return { byUsage, testable, untestable };
}
