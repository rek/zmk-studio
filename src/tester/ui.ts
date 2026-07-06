// Shared "instrument" type treatments for the tester: silkscreen-style
// micro-caps for labels, monospace tabular figures for data readouts. The
// Tailwind theme replaces fontSize with only `text-xs`, so sizes here must be
// arbitrary values.
export const SILKSCREEN =
  "text-[0.62rem] font-medium uppercase tracking-[0.14em] opacity-60";

export const MONO_DATA = "font-mono text-[0.78rem] tabular-nums";

export type KeyTestState =
  | "held"
  | "chatter"
  | "tested"
  | "untestable"
  | "untested";

// Colors for the keys on the board. `undefined` keeps Key's stock colors so
// untested keys look exactly like the keymap editor's.
export const KEY_STATE_CLASSES: Record<KeyTestState, string | undefined> = {
  held: "bg-primary text-primary-content ring-2 ring-primary shadow-lg",
  chatter: "bg-red-500 text-white",
  tested: "bg-accent text-base-100",
  untestable:
    "bg-base-200 border border-dashed border-base-content text-base-content opacity-40",
  untested: undefined,
};

// Solid swatches for the LED progress bar and legend dots. Untestable keys
// render as gaps in the bar — they are not part of the pass/fail count.
export const KEY_STATE_DOTS: Record<KeyTestState, string> = {
  held: "bg-primary",
  chatter: "bg-red-500",
  tested: "bg-accent",
  untestable: "bg-transparent",
  untested: "bg-base-300",
};
