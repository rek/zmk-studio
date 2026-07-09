# Raw physical-key detection for the Studio key tester

## Goal

The tester (`src/tester/`) currently only detects keypresses that produce a
host-visible HID event (`useKeyEventCapture.ts` listens to browser
`KeyboardEvent`s). Any position bound to a non-HID behavior — `&studio_unlock`,
`&bt BT_SEL`, `&mo`, `&none`, combos — is invisible to it, even though the
switch is physically fine. Goal: detect *any* physical keypress, independent
of what's bound to that position, the way QMK's matrix test mode does.

Not started yet — scoped only. Written up so a fresh agent/session can pick
this up without redoing the research.

## Why this is tractable

ZMK already raises an internal event on every physical keypress, for both
halves of a split, *before* the keymap resolves what's bound to it:

- `zmk_position_state_changed`
  (`zmk-workspace/zmk/app/include/zmk/events/position_state_changed.h`) —
  carries `source` (0xFF = local, else peripheral index), `position`
  (post-matrix-transform logical index), `state` (pressed bool), `timestamp`.
- Raised in exactly two places, both upstream of keymap/behavior resolution:
  - `app/src/physical_layouts.c:297-302` — local matrix path, `source = LOCAL`
  - `app/src/split/central.c:32-48` (raise at line 47) — split peripheral
    path, transport-agnostic (BLE and wired central both funnel through here)
- `keymap.c` is just a downstream subscriber
  (`ZMK_SUBSCRIPTION(keymap, zmk_position_state_changed)` at line 836) that
  does the position→binding lookup. It does not gate the event's existence.

So the raw signal we need already exists uniformly for every key on the
board. The work is plumbing it out over Studio's RPC, not inventing new
firmware sensing.

## Three real gotchas (must design around, not discover in testing)

1. **Combo capture can eat events.** ZMK's event manager
   (`app/include/zmk/event_manager.h`, `app/src/event_manager.c`) dispatches
   listeners in **link order** (per `app/CMakeLists.txt`), and
   `ZMK_EV_EVENT_HANDLED`/`CAPTURED` genuinely halts delivery to
   later-registered listeners — not just a hint. `app/src/combo.c` subscribes
   to `position_state_changed` and can capture/delay/swallow presses that are
   combo candidates (`combo.c:252-258`, `459-472`). Studio's subsystem code
   links very late (`app/CMakeLists.txt:133`, inside
   `if(CONFIG_ZMK_STUDIO_RPC)`), i.e. *after* `combo.c` (line 70). A naive new
   subscriber there would silently miss/delay events for any key that's part
   of a combo — directly defeating "detect any physical key."
   - **Mitigation:** either place the new listener's translation unit earlier
     in `app/CMakeLists.txt` than `combo.c`, or bypass the event manager
     entirely and hook the two raise sites
     (`physical_layouts.c:297-302`, `split/central.c:41-48`) directly.

2. **RPC transport wasn't built for a high-frequency stream.**
   `CONFIG_ZMK_STUDIO_RPC_TX_BUF_SIZE` defaults to **64 bytes**
   (`app/src/studio/Kconfig:108-110`); `rpc_tx_buffer_write()` busy-spins the
   calling thread if the ring buffer is full. BLE transport allows only
   **one GATT indication in flight** at a time (`gatt_rpc_transport.c`,
   `indicate_sem` semaphore). Every existing notification (lock-state,
   unsaved-changes) is rare/human-timescale — nothing today streams
   per-keystroke. This is a genuine gap, not a tuning knob.
   - **Mitigation:** ship gated behind a new Kconfig option, default **off**,
     so it can't regress existing users. Consider coalescing/throttling in a
     later pass rather than blocking the first cut on it.

3. **The TS client is the actual bottleneck, not the firmware.**
   `@zmkfirmware/zmk-studio-ts-client` (pinned `^0.0.18` in
   `zmk-studio-fork/package.json:23`) is a normal **npm-published package** —
   `node_modules/` ships prebuilt `lib/*.js`/`.d.ts` only. The codegen script
   only runs when `src/` plus a submodule checkout are present, which isn't
   the case for a plain `npm install`. Consuming a new proto field needs
   either (a) an upstream publish of a new client version, or (b) this fork
   pointing `package.json` at a forked/patched `zmk-studio-ts-client` (git URL
   or `npm link`) in the meantime.
   - **Decision needed:** fork the ts-client now (fast, self-contained) vs.
     wait on upstreaming the proto change (slower, out of our control). Not
     yet decided — pick this before starting firmware work, since it affects
     how soon the UI side can be tested end-to-end.

## RPC subsystem pattern to copy

Model the new notification on the existing `lock_state_changed` one — it's
the closest existing precedent for "firmware proactively pushes an event to
the connected client":

- Internal event declared: `app/include/zmk/studio/core.h:16-22`
- Raised: `app/src/studio/core.c:24-25`
- Mapped to an RPC notification: `core_event_mapper()` in
  `app/src/studio/core_subsystem.c:83-94`, registered via
  `ZMK_RPC_EVENT_MAPPER(core, core_event_mapper, zmk_studio_core_lock_state_changed)`
- That macro auto-subscribes a shared `studio_rpc` listener
  (`app/src/studio/rpc.c:316-347`) which builds the envelope and calls
  `send_response()` (`rpc.c:179-213`)

Subsystems register via `ZMK_RPC_SUBSYSTEM`/`ZMK_RPC_SUBSYSTEM_HANDLER`
macros (`app/include/zmk/studio/rpc.h:82-110`) into Zephyr iterable linker
sections, walked at dispatch time (`rpc.c:27-56`).

## Proto schema

Not in `app/` — lives in a west-managed submodule:
`zmk-workspace/zmk/modules/msgs/zmk-studio-messages/proto/zmk/{core,keymap,behaviors,meta,studio}.proto`
(pinned in `app/west.yml:41-44`).

- `studio.proto` has top-level `Request`/`Response`/`Notification` messages;
  each subsystem contributes a `oneof subsystem` branch.
- Each subsystem's own proto (e.g. `core.proto:32-36`) declares its own
  `Notification { oneof notification_type { LockState lock_state_changed = 1; } }`.
- Adding a new notification = add a field to an existing subsystem's oneof
  (lowest friction — e.g. extend `core.proto`'s notification oneof with a
  `PositionStateChanged` message) or start a new subsystem branch.
- Firmware codegen is automatic at CMake-configure time
  (`app/CMakeLists.txt:113-133`, `nanopb_generate_cpp`) — editing the local
  `.proto` and rebuilding just works for firmware. A real upstream PR would
  need the change landed in `zmkfirmware/zmk-studio-messages` first.

## File-by-file scope

**Firmware (`zmk-workspace/zmk`):**
- `modules/msgs/zmk-studio-messages/proto/zmk/core.proto` — add
  `PositionStateChanged` message + oneof field
- `app/src/studio/core_subsystem.c` (or a new `position_subsystem.c`) — new
  event mapper, `ZMK_RPC_EVENT_MAPPER(...)`
- `app/src/studio/CMakeLists.txt` — wire new source file if split out
- `app/CMakeLists.txt` — link-order placement relative to `combo.c` (line 70)
  if going the "reorder" route for gotcha #1
- `app/src/physical_layouts.c:297-302`, `app/src/split/central.c:41-48` —
  only if bypassing the event manager directly instead
- `app/src/studio/Kconfig` — new gating option, default **off**
- `app/src/studio/rpc.c` — optional coalescing/backpressure handling later;
  no existing pattern to reuse for this

**Studio TS client:** forked/patched `zmk-studio-ts-client` (or upstream
regen + publish); bump `zmk-studio-fork/package.json:23`.

**Fork UI (`zmk-studio-fork/src`):**
- `src/App.tsx:71-115` — no change needed; notification routing already
  reflects generically over oneof fields
- `src/tester/tester-state.ts` — new action/reducer path that updates stats
  by raw position, bypassing the existing code→usage→position pipeline
- new `src/tester/useRpcPositionEvents.ts` — subscribe via
  `useSub("rpc_notification.core.positionStateChanged", ...)`
- `src/tester/MatrixTester.tsx` — wire the new hook alongside the existing
  `useKeyEventCapture` (around lines 165-168)
- `src/tester/useKeyEventCapture.ts` — unchanged; it's the reason this
  feature is needed (browser `KeyboardEvent`s never fire for non-HID keys),
  keep it running in parallel rather than replacing it (HID-bound keys still
  benefit from the richer host-side data — usages, actual sent code)
- `src/rpc/ConnectionContext.ts` — no change expected

## Proposed order of work

1. Decide the ts-client dependency question (fork vs. wait on upstream) —
   blocks everything downstream of firmware.
2. Firmware: add the proto message, the event mapper, the Kconfig gate
   (default off). Build and manually confirm the notification fires via the
   existing RPC logging/dev tools before touching any UI.
3. Firmware: resolve the combo-capture gotcha deliberately (reorder link
   position or hook raise sites directly) — write a quick manual test with a
   combo-bound key to confirm it still shows up.
4. Studio-side: get the TS client producing the new notification type
   (forked package or regenerated).
5. Fork UI: add `useRpcPositionEvents.ts`, extend `tester-state.ts`, wire into
   `MatrixTester.tsx` alongside the existing HID-based path.
6. Test end-to-end on real hardware: an HID-bound key, a combo-bound key, and
   a non-HID key (`&studio_unlock` or `&bt BT_SEL`) should all now register in
   the tester.
7. Flash the left/central half with the Kconfig flag on for testing; leave it
   off in the daily-driver build until this is validated on real hardware.

## Open decisions (need a human call before/at start)

- Fork `zmk-studio-ts-client` locally now, or wait on upstreaming the proto
  change? (Research recommends forking for speed/control, given this is
  already a "fork carries extra features" project.)
- New subsystem (`position_subsystem.c`) vs. extending `core_subsystem.c`?
  Leaning new subsystem for isolation, since this is Kconfig-gated and
  separable from core's always-on notifications.
- Combo-capture fix: reorder CMake link position (simpler, but fragile if
  build system changes) vs. hook raise sites directly (more invasive, more
  robust)? Leaning toward hooking raise sites directly since it sidesteps the
  event-manager ordering problem entirely rather than depending on link order
  staying stable.

## Rough size estimate

~150-350 lines across firmware + fork UI, small in code volume — most of the
patterns (RPC push, proto oneof, JS pub/sub) already have a working template
to copy (`lock_state_changed`). The friction is process (ts-client
dependency) and the two design decisions above (combo capture, backpressure),
not raw line count.
