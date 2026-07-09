# Fork notes

Fork of `zmkfirmware/zmk-studio` at `rek/zmk-studio` (this remote). Web app
(React + TS + Vite, optional Tauri desktop shell) that configures ZMK
keyboards over USB/BLE through an RPC protocol (nanopb/protobuf messages,
consumed via the prebuilt `@zmkfirmware/zmk-studio-ts-client` package).

## Fork policy

Every fork feature lives in its own top-level `src/` dir, kept
self-contained so it can be upstreamed as an independent PR later. Don't
spread a new feature's state/logic into files it doesn't otherwise need to
touch. Update the README's "Fork additions" section when a feature ships.

Current fork features:

- `src/tester/` — key/matrix tester tab: per-key tested/held state,
  chatter detection, hold-timing stats, NKRO rollover, pulse-trace view.
  Detection is **HID-event-based only** today (`useKeyEventCapture.ts`
  listens to browser `KeyboardEvent`s) — positions bound to non-HID
  behaviors (`&studio_unlock`, `&bt BT_SEL`, `&mo`, `&none`, combos) show
  as untestable even though the switch is fine. See
  [`plans/raw-position-detection.md`](plans/raw-position-detection.md)
  (not yet started) for the planned fix.
- `src/keymap-io/` — keymap export/import as JSON. Imports are staged
  like manual edits (Save persists, Discard rolls back); behaviors
  matched by display name so a keymap can move across firmware builds.
- `src/misc/ThemeToggle.tsx` — system/light/dark toggle, persisted
  locally.

## Structure

- `src/rpc/` — connection/transport context (`ConnectionContext.ts`),
  lock state, connected-device data hooks.
- `src/tauri/` — USB/BLE transport implementations, used only in the
  Tauri desktop build (not the plain web build).
- `src/keyboard/` — physical layout rendering (`PhysicalLayout.tsx`,
  `Key.tsx`, `Keyboard.tsx`).
- `src/behaviors/` — behavior binding/parameter pickers (HID usage
  picker, etc.) used by keymap editing.
- `src/data/release-data.json` — generated, see
  [`DEVELOPMENT.md`](DEVELOPMENT.md); don't hand-edit.

## RPC/proto model

The proto schema is **not in this repo** — it lives in the ZMK firmware
submodule
(`zmk-workspace/zmk/modules/msgs/zmk-studio-messages/proto/zmk/*.proto`),
which is not currently checked out in this workspace.
`@zmkfirmware/zmk-studio-ts-client` (pinned in `package.json`) is a
prebuilt npm package with no local codegen path here — consuming a new
proto field needs either an upstream client publish, or forking/patching
that package and pointing `package.json` at it. Existing RPC push pattern
to copy for new firmware→UI notifications: `lock_state_changed`
(`core.proto`, `core_subsystem.c` event mapper, `rpc.c` dispatch). See
[`plans/raw-position-detection.md`](plans/raw-position-detection.md) for a
fully worked example, including the firmware-side event-manager
link-order gotcha (`combo.c` can capture `position_state_changed` before a
late-linked Studio RPC subscriber sees it) and the RPC transport's low
headroom for a per-keystroke stream (64-byte TX ring buffer, one BLE GATT
indication in flight).

## Branch state

`feat/matrix-tester` is the active branch; diverged from `main` by 28
files / +2397 −10. `main` tracks upstream more closely.
