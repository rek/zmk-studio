# ZMK Studio

Initial work on the ZMK Studio UI.

## Fork additions

This fork ([rek/zmk-studio](https://github.com/rek/zmk-studio)) carries a few
features on top of upstream, each kept self-contained for possible upstream
PRs:

- **Key tester** (`src/tester/`) — a switch-tester tab for verifying every
  switch on a freshly built board: per-key tested/held state, chatter
  detection with a configurable threshold, hold-timing stats, an NKRO
  rollover view, and a logic-analyzer style pulse trace of each switch's
  recent presses. Detection listens to host key events, so it works with
  stock firmware; keys with no host-visible output (layer holds, Bluetooth,
  lighting) are shown as not testable. Develop it without a device via
  Storybook (`npm run storybook` → Tester/TesterView).
- **Theme toggle** (`src/misc/ThemeToggle.tsx`) — header button cycling
  system → light → dark, persisted locally.
- **Keymap export / import** (`src/keymap-io/`) — header buttons to download
  the connected keyboard's keymap as a JSON file and to apply such a file
  back onto a keyboard, e.g. to back up a layout or share it with other
  users. Imports are staged on the device like manual edits: Save persists
  them, Discard rolls them back. Behaviors are matched by display name so a
  keymap can move between keyboards running different firmware builds.
