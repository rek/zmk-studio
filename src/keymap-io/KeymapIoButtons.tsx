import { useContext, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { Download, Upload } from "lucide-react";

import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";

import { GenericModal } from "../GenericModal";
import { Tooltip } from "../misc/Tooltip";
import { useModalRef } from "../misc/useModalRef";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import {
  ImportResult,
  KeymapExportDoc,
  applyKeymapImport,
  fetchKeymapExportDoc,
  parseKeymapExportDoc,
} from "./keymapIo";

type ModalState =
  | { kind: "confirm"; doc: KeymapExportDoc }
  | { kind: "result"; result: ImportResult }
  | { kind: "error"; message: string };

const downloadJson = (doc: KeymapExportDoc, filename: string) => {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const HEADER_BUTTON_CLASS =
  "flex items-center justify-center p-1.5 rounded enabled:hover:bg-base-300 disabled:opacity-50";

// Export the connected keyboard's keymap as a shareable JSON file, and
// import such a file back onto a keyboard. Import stages changes exactly
// like manual edits: Save persists them, Discard rolls them back.
export const KeymapIoButtons = ({
  deviceLabel,
  onKeymapChanged,
}: {
  deviceLabel?: string;
  onKeymapChanged?: () => void;
}) => {
  const conn = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const modalRef = useModalRef(modal !== null);

  const disabled =
    !conn.conn ||
    lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED ||
    busy;

  const doExport = async () => {
    if (!conn.conn) {
      return;
    }
    setBusy(true);
    try {
      const doc = await fetchKeymapExportDoc(conn.conn, deviceLabel);
      const slug = (deviceLabel || "keymap")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadJson(doc, `${slug || "keymap"}-keymap.json`);
    } catch (e) {
      setModal({
        kind: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onFilePicked = async (file: File) => {
    try {
      setModal({ kind: "confirm", doc: parseKeymapExportDoc(await file.text()) });
    } catch (e) {
      setModal({
        kind: "error",
        message: e instanceof Error ? e.message : "Couldn't read that file.",
      });
    }
  };

  const doApply = async (doc: KeymapExportDoc) => {
    if (!conn.conn) {
      return;
    }
    setBusy(true);
    try {
      const result = await applyKeymapImport(conn.conn, doc);
      setModal({ kind: "result", result });
      onKeymapChanged?.();
    } catch (e) {
      setModal({
        kind: "error",
        message: e instanceof Error ? e.message : "Import failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip label="Export keymap to a file">
        <Button
          className={HEADER_BUTTON_CLASS}
          isDisabled={disabled}
          onPress={doExport}
        >
          <Download className="inline-block w-4 mx-1" aria-label="Export keymap" />
        </Button>
      </Tooltip>
      <Tooltip label="Import keymap from a file">
        <Button
          className={HEADER_BUTTON_CLASS}
          isDisabled={disabled}
          onPress={() => fileRef.current?.click()}
        >
          <Upload className="inline-block w-4 mx-1" aria-label="Import keymap" />
        </Button>
      </Tooltip>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            onFilePicked(file);
          }
        }}
      />
      <GenericModal
        ref={modalRef}
        className="max-w-[50vw]"
        onClose={() => setModal(null)}
      >
        {modal?.kind === "confirm" && (
          <div>
            <h2 className="my-2">Import keymap</h2>
            <p>
              {modal.doc.device ? `Exported from ${modal.doc.device}: ` : ""}
              {modal.doc.layers.length} layer(s),{" "}
              {modal.doc.layout.keyCount} keys ({modal.doc.layout.name}).
            </p>
            <p className="my-2 opacity-70">
              Applying stages these bindings on the keyboard, replacing any
              unsaved edits. Save afterwards to keep them, or Discard to roll
              everything back.
            </p>
            <div className="flex justify-end my-2 gap-3">
              <Button
                className="rounded bg-base-200 hover:bg-base-300 px-3 py-2"
                onPress={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button
                className="rounded bg-base-200 hover:bg-base-300 px-3 py-2"
                isDisabled={busy}
                onPress={() => doApply(modal.doc)}
              >
                {busy ? "Applying…" : "Apply import"}
              </Button>
            </div>
          </div>
        )}
        {modal?.kind === "result" && (
          <div>
            <h2 className="my-2">Keymap imported</h2>
            <p>
              {modal.result.bindingsApplied} binding(s) updated across{" "}
              {modal.result.layersApplied} layer(s)
              {modal.result.bindingsSkipped > 0 &&
                `, ${modal.result.bindingsSkipped} skipped`}
              .
            </p>
            <p className="my-2 opacity-70">
              The changes are staged on the keyboard — Save to keep them,
              Discard to roll back.
            </p>
            {modal.result.warnings.length > 0 && (
              <ul className="my-2 list-disc pl-5 opacity-80">
                {modal.result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end my-2">
              <Button
                className="rounded bg-base-200 hover:bg-base-300 px-3 py-2"
                onPress={() => setModal(null)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
        {modal?.kind === "error" && (
          <div>
            <h2 className="my-2">Keymap file problem</h2>
            <p>{modal.message}</p>
            <div className="flex justify-end my-2">
              <Button
                className="rounded bg-base-200 hover:bg-base-300 px-3 py-2"
                onPress={() => setModal(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </GenericModal>
    </>
  );
};
