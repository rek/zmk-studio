# ZMK Studio (fork)

Fork of `zmkfirmware/zmk-studio` for ZMK keyboard configuration (React +
TS + Vite, optional Tauri desktop shell). Full docs live in `docs/`:

- [`docs/FORK-NOTES.md`](docs/FORK-NOTES.md) — fork policy, feature/`src`
  map, RPC/proto model. Read before touching `src/rpc/`, adding a fork
  feature, or wiring a new firmware→UI notification.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — commands, the
  `generate-data` GitHub rate-limit gotcha, Linux BLE/USB connection
  setup.
- [`docs/plans/`](docs/plans/) — scoping docs for in-flight/queued
  features. **Check here before starting new work** — a plan states
  explicitly whether work has started, so you don't redo research or
  duplicate an in-progress design.

## Non-negotiables

- `npm run lint` runs `--max-warnings 0` — treat warnings as errors.
- No vitest/jest in this repo. Storybook stories are the test surface;
  don't add a second test runner without discussing it first.
- Fork features are self-contained per top-level `src/` dir (see
  `docs/FORK-NOTES.md`) so each can be upstreamed independently — don't
  spread a new feature across files it doesn't need.

## Branch state

`feat/matrix-tester` is active; diverged from `main` by 28 files /
+2397 −10.
