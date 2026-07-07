import {
  Keymap,
  SetLayerBindingResponse,
  SetLayerPropsResponse,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  Request,
  RequestResponse,
  RpcConnection,
} from "@zmkfirmware/zmk-studio-ts-client";

import { call_rpc } from "../rpc/logging";

// All device interaction goes through this signature so the import/export
// flows can be exercised against a simulated device without hardware.
export type Rpc = (req: Omit<Request, "requestId">) => Promise<RequestResponse>;

const rpcFor =
  (conn: RpcConnection): Rpc =>
  (req) =>
    call_rpc(conn, req);

// Shareable keymap document. Bindings reference behaviors by display name
// rather than numeric id: ids are assigned per-firmware-build, so names are
// the only stable key when a keymap moves between keyboards.
export const KEYMAP_EXPORT_FORMAT = "zmk-studio-keymap";
export const KEYMAP_EXPORT_VERSION = 1;

export interface ExportedBinding {
  behavior: string;
  param1: number;
  param2: number;
}

export interface ExportedLayer {
  name: string;
  bindings: ExportedBinding[];
}

export interface KeymapExportDoc {
  format: typeof KEYMAP_EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  device?: string;
  layout: { name: string; keyCount: number };
  layers: ExportedLayer[];
}

export const buildKeymapExportDoc = (
  keymap: Keymap,
  layout: { name: string; keyCount: number },
  behaviorNames: Record<number, string>,
  device?: string
): KeymapExportDoc => ({
  format: KEYMAP_EXPORT_FORMAT,
  version: KEYMAP_EXPORT_VERSION,
  exportedAt: new Date().toISOString(),
  device,
  layout,
  layers: keymap.layers.map((l) => ({
    name: l.name,
    bindings: l.bindings.map((b) => ({
      behavior: behaviorNames[b.behaviorId] || `#${b.behaviorId}`,
      param1: b.param1,
      param2: b.param2,
    })),
  })),
});

// Parse and validate an uploaded document. Throws with a user-facing message
// on anything that doesn't look like one of our exports.
export const parseKeymapExportDoc = (text: string): KeymapExportDoc => {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const d = doc as Partial<KeymapExportDoc>;
  if (d?.format !== KEYMAP_EXPORT_FORMAT) {
    throw new Error(
      "This file isn't a ZMK Studio keymap export (missing format marker)."
    );
  }
  if (typeof d.version !== "number" || d.version > KEYMAP_EXPORT_VERSION) {
    throw new Error(
      "This export was made by a newer version of the app — update to import it."
    );
  }
  if (!Array.isArray(d.layers) || d.layers.length === 0) {
    throw new Error("This export contains no layers.");
  }
  if (
    typeof d.layout?.name !== "string" ||
    typeof d.layout?.keyCount !== "number"
  ) {
    // Tolerate a trimmed/hand-edited file: the layout block is informational
    // (confirm-dialog copy and mismatch warnings), not required to apply.
    d.layout = {
      name: "unknown",
      keyCount: d.layers[0]?.bindings?.length ?? 0,
    };
  }
  for (const layer of d.layers) {
    if (
      typeof layer?.name !== "string" ||
      !Array.isArray(layer?.bindings) ||
      layer.bindings.some(
        (b: Partial<ExportedBinding>) =>
          typeof b?.behavior !== "string" ||
          typeof b?.param1 !== "number" ||
          typeof b?.param2 !== "number"
      )
    ) {
      throw new Error("This export has a malformed layer — re-export it.");
    }
  }
  return d as KeymapExportDoc;
};

export const fetchBehaviorNames = async (
  rpc: Rpc
): Promise<Record<number, string>> => {
  const names: Record<number, string> = {};
  const list = await rpc({ behaviors: { listAllBehaviors: true } });
  for (const behaviorId of list?.behaviors?.listAllBehaviors?.behaviors || []) {
    const resp = await rpc({
      behaviors: { getBehaviorDetails: { behaviorId } },
    });
    const details = resp?.behaviors?.getBehaviorDetails;
    if (details) {
      names[details.id] = details.displayName;
    }
  }
  return names;
};

export const fetchKeymapExportDoc = async (
  conn: RpcConnection,
  device?: string
): Promise<KeymapExportDoc> => fetchKeymapExportDocWith(rpcFor(conn), device);

export const fetchKeymapExportDocWith = async (
  rpc: Rpc,
  device?: string
): Promise<KeymapExportDoc> => {
  const keymapResp = await rpc({ keymap: { getKeymap: true } });
  const keymap = keymapResp?.keymap?.getKeymap;
  if (!keymap) {
    throw new Error("Couldn't read the keymap from the keyboard.");
  }
  const layoutsResp = await rpc({
    keymap: { getPhysicalLayouts: true },
  });
  const layouts = layoutsResp?.keymap?.getPhysicalLayouts;
  const active = layouts?.layouts[layouts.activeLayoutIndex];
  const behaviorNames = await fetchBehaviorNames(rpc);
  return buildKeymapExportDoc(
    keymap,
    {
      name: active?.name || "unknown",
      keyCount: active?.keys.length ?? keymap.layers[0]?.bindings.length ?? 0,
    },
    behaviorNames,
    device
  );
};

export interface ImportResult {
  layersApplied: number;
  bindingsApplied: number;
  bindingsSkipped: number;
  warnings: string[];
}

// Apply an export document to the connected keyboard. Everything goes
// through the same RPCs the editor uses, so the result is staged exactly
// like manual edits: Save persists it, Discard rolls it back. Behaviors are
// matched by display name; positions whose behavior doesn't exist on this
// firmware keep their current binding.
export const applyKeymapImport = async (
  conn: RpcConnection,
  doc: KeymapExportDoc
): Promise<ImportResult> => applyKeymapImportWith(rpcFor(conn), doc);

export const applyKeymapImportWith = async (
  rpc: Rpc,
  doc: KeymapExportDoc
): Promise<ImportResult> => {
  const warnings: string[] = [];
  let bindingsApplied = 0;
  let bindingsSkipped = 0;

  const keymapResp = await rpc({ keymap: { getKeymap: true } });
  const keymap = keymapResp?.keymap?.getKeymap;
  if (!keymap) {
    throw new Error("Couldn't read the keymap from the keyboard.");
  }

  const behaviorNames = await fetchBehaviorNames(rpc);
  const idByName = new Map(
    Object.entries(behaviorNames).map(([id, name]) => [name, parseInt(id, 10)])
  );
  const missingBehaviors = new Set<string>();

  // Grow the device keymap if the import has more layers and there's room.
  const layers = [...keymap.layers];
  while (layers.length < doc.layers.length) {
    if (layers.length - keymap.layers.length >= keymap.availableLayers) {
      warnings.push(
        `Import has ${doc.layers.length} layers but this keyboard fits ` +
          `${layers.length}; the rest were skipped.`
      );
      break;
    }
    const resp = await rpc({ keymap: { addLayer: {} } });
    const added = resp?.keymap?.addLayer?.ok?.layer;
    if (!added) {
      warnings.push("The keyboard refused to add a layer; extras skipped.");
      break;
    }
    layers.push(added);
  }
  if (layers.length > doc.layers.length) {
    warnings.push(
      `This keyboard has ${layers.length - doc.layers.length} more ` +
        `layer(s) than the import; they were left as-is.`
    );
  }

  const layerCount = Math.min(doc.layers.length, layers.length);
  for (let i = 0; i < layerCount; i++) {
    const src = doc.layers[i];
    const dst = layers[i];

    // Freshly added layers can come back with an empty bindings array; the
    // base layer's key count is the layout's real width in that case.
    const dstKeyCount =
      dst.bindings.length || keymap.layers[0]?.bindings.length || 0;

    if (src.bindings.length !== dstKeyCount) {
      warnings.push(
        `Layer "${src.name || i}": import has ${src.bindings.length} keys, ` +
          `this keyboard has ${dstKeyCount} — extra keys ignored.`
      );
    }

    const posCount = Math.min(src.bindings.length, dstKeyCount);
    for (let pos = 0; pos < posCount; pos++) {
      const want = src.bindings[pos];
      const behaviorId = idByName.get(want.behavior);
      if (behaviorId === undefined) {
        missingBehaviors.add(want.behavior);
        bindingsSkipped += 1;
        continue;
      }
      const have = dst.bindings[pos];
      if (
        have &&
        have.behaviorId === behaviorId &&
        have.param1 === want.param1 &&
        have.param2 === want.param2
      ) {
        continue; // Already matches; skip the round-trip.
      }
      const resp = await rpc({
        keymap: {
          setLayerBinding: {
            layerId: dst.id,
            keyPosition: pos,
            binding: { behaviorId, param1: want.param1, param2: want.param2 },
          },
        },
      });
      if (
        resp?.keymap?.setLayerBinding ===
        SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
      ) {
        bindingsApplied += 1;
      } else {
        bindingsSkipped += 1;
      }
    }

    if (src.name && src.name !== dst.name) {
      const name = src.name.slice(0, keymap.maxLayerNameLength || undefined);
      const resp = await rpc({
        keymap: { setLayerProps: { layerId: dst.id, name } },
      });
      if (
        resp?.keymap?.setLayerProps !==
        SetLayerPropsResponse.SET_LAYER_PROPS_RESP_OK
      ) {
        warnings.push(`Couldn't rename layer ${i} to "${name}".`);
      }
    }
  }

  if (missingBehaviors.size > 0) {
    warnings.push(
      `This firmware doesn't have: ${[...missingBehaviors].join(", ")} — ` +
        `those keys kept their current binding.`
    );
  }

  return { layersApplied: layerCount, bindingsApplied, bindingsSkipped, warnings };
};
