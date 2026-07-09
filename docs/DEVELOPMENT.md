# Development setup

## Commands

- `npm run dev` — runs `generate-data` then `vite`.
- `npm run build` — `generate-data && tsc && vite build`.
- `npm run lint` — eslint, `--max-warnings 0` (zero tolerance, not
  advisory).
- `npm run storybook` — primary way to develop UI without hardware
  attached, especially `src/tester` (Tester/TesterView story) and
  `src/behaviors`. **No vitest/jest in this repo** — Storybook stories are
  the test surface; don't introduce a second test runner without
  discussing it first.

## `generate-data` GitHub rate limit

`npm run dev` / `npm run build` run `generate-data` first (fetches the
latest release info from the *upstream* `zmkfirmware/zmk-studio` GitHub
API, used only by the `/download` page). That call is unauthenticated and
easily hits GitHub's 60 req/hr rate limit, which aborts the whole chain. If
it 403s, fetch the data with an authenticated client instead and run Vite
directly:

```sh
gh api repos/zmkfirmware/zmk-studio/releases/latest > src/data/release-data.json
npx vite
```

## Connecting over BLE on Linux

Chrome on Linux ships Web Bluetooth *disabled by default*. The app only
adds a "BLE" option to the connect screen when `navigator.bluetooth` is
truthy (see `src/App.tsx`), so if the connect modal shows only "USB",
that's the tell — not a code issue. Being OS-paired (`bluetoothctl`) is
unrelated; the browser needs its own flag:

1. Go to `chrome://flags`, search "bluetooth", enable the Web Bluetooth
   related flag(s) (e.g. `#enable-web-bluetooth-new-permissions-backend`).
2. Fully restart Chrome (flags require a relaunch, not just a tab reload).
3. Reload the app — "BLE" should now appear alongside "USB".

## Connecting over USB

Opening the serial port needs OS permissions on `/dev/ttyACM*`, which
defaults to `root:uucp` mode `660` on Arch. Fix once:

```sh
sudo usermod -aG uucp $USER
# log out/in (or `newgrp uucp` in the launching shell) for it to take effect
```

A `50-zmk-studio.rules` udev rule tagging the board's vendor/product ID
with `uaccess` also grants access without group membership, if present.
