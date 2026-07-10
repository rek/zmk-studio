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

## Troubleshooting

### Connecting over BLE on Linux

Chrome on Linux ships Web Bluetooth *disabled by default*. The app only
adds a "BLE" option to the connect screen when `navigator.bluetooth` is
truthy (see `src/App.tsx`), so if the connect modal shows only "USB",
that's the tell — not a code issue. Being OS-paired (`bluetoothctl`) is
unrelated; the browser needs its own flag:

1. Go to `chrome://flags`, search "bluetooth", enable the Web Bluetooth
   related flag(s) (e.g. `#enable-web-bluetooth-new-permissions-backend`).
2. Fully restart Chrome (flags require a relaunch, not just a tab reload).
3. Reload the app — "BLE" should now appear alongside "USB".

### Connecting over USB

Opening the serial port needs OS permissions on `/dev/ttyACM*`, which
defaults to `root:uucp` mode `660` on Arch. Fix once:

```sh
sudo usermod -aG uucp $USER
# log out/in (or `newgrp uucp` in the launching shell) for it to take effect
```

A `50-zmk-studio.rules` udev rule tagging the board's vendor/product ID
with `uaccess` also grants access without group membership, if present.

### Board stuck asleep after deep sleep (won't reconnect)

Symptom: a split board (esp. the Central/master half) goes to sleep and
won't wake on a keypress — only a full battery pull recovers it. Confirm
it's this and not an OS-side reconnect delay by checking the adapter
directly:

```sh
bluetoothctl info <device-mac>
```

If that shows `Paired: yes` / `Bonded: yes` but `Connected: no`, and
`bluetoothctl connect <device-mac>` hangs with no response (not even a
fast failure), the board's radio isn't advertising at all — it's not
asleep-but-reachable, it's hung.

**Root cause** (not a ZMK bug):
[zephyr PR #69682](https://github.com/zephyrproject-rtos/zephyr/pull/69682)
gated `pm_device_slots` behind `CONFIG_PM`, which ZMK doesn't set. The
`TYPE_SECTION_START(pm_device_slots)` reference in `app/src/pm.c:60` then
hits an undefined linker section and hangs/crashes the instant a device
successfully suspends — i.e. exactly on entry to deep sleep. Central-only
because it's the half doing the suspending; the peripheral wakes fine.
Tracked upstream at
[zmkfirmware/zmk#3207](https://github.com/zmkfirmware/zmk/issues/3207)
(plain deep-sleep crash) and
[zmkfirmware/zmk#3195](https://github.com/zmkfirmware/zmk/issues/3195)
(same crash class, `CONFIG_ZMK_STUDIO=y` builds).

**Fix status**: already shipped, not as a `zmkfirmware/zmk` PR — reverted
directly on ZMK's own Zephyr fork
([`zmkfirmware/zephyr@1d1eb5d`](https://github.com/zmkfirmware/zephyr/commit/1d1eb5d9645bbfbe437413ddba2b779e5c7b60b3),
2026-06-24). `app/west.yml` on `zmkfirmware/zmk@main` pins `zephyr` to the
moving tag `v4.1.0+zmk-fixes`, which already contains that revert
(confirmed via `git compare` — the fix commit is an ancestor of the
current tag). A fresh `west update` + rebuild on `main` picks it up with
no manifest edit needed. If you can't rebuild immediately: power Central
over USB (deep sleep doesn't hit this while USB-powered), or set
`CONFIG_ZMK_STUDIO=n` if that's enabled.
