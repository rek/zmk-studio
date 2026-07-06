import { useMemo } from "react";

import { KeyPulse } from "./tester-state";
import { SILKSCREEN } from "./ui";

// Logic-analyzer trace of one switch's recent activity. High = contact
// closed, low = open. Segment width scales with hold duration (sqrt, clamped,
// so a 2 s hold doesn't flatline the display); the gap before a chatter
// re-closure collapses to a sliver and the whole glitch pulse draws in red.
// Time flows left → right with the newest edge pinned to the right side, so
// old pulses scroll off the left like a scrolling scope.

const H = 36; // viewBox height
const HI = 7; // y of the "closed" level
const LO = 29; // y of the "open" level
const GAP_W = 14; // idle gap between normal pulses
const CHATTER_GAP_W = 4; // near-zero gap that makes a glitch read as one
const OPEN_W = 26; // drawn width of a still-held pulse
const LEAD_W = 10; // baseline before the first and after the last edge

const holdWidth = (p: KeyPulse): number => {
  if (p.upAt === undefined) {
    return OPEN_W;
  }
  return Math.min(64, Math.max(6, Math.sqrt(p.upAt - p.downAt) * 3.2));
};

interface Segment {
  x0: number;
  x1: number;
  open: boolean;
  chatter: boolean;
}

const layoutSegments = (pulses: KeyPulse[]): { segs: Segment[]; w: number } => {
  const segs: Segment[] = [];
  let x = LEAD_W;
  pulses.forEach((p, i) => {
    if (i > 0) {
      x += p.chatter ? CHATTER_GAP_W : GAP_W;
    }
    const w = holdWidth(p);
    segs.push({
      x0: x,
      x1: x + w,
      open: p.upAt === undefined,
      chatter: p.chatter,
    });
    x += w;
  });
  return { segs, w: x + LEAD_W };
};

// Square-wave path over a subset of segments: rising edge, closed level,
// falling edge (omitted while the switch is still held). The open-level runs
// between pulses come from baselinePath so chatter pulses can be re-stroked
// in red without breaking the teal wave.
const wavePath = (segs: Segment[]): string =>
  segs
    .map(
      (s) =>
        `M ${s.x0} ${LO} L ${s.x0} ${HI} L ${s.x1} ${HI}` +
        (s.open ? "" : ` L ${s.x1} ${LO}`)
    )
    .join(" ");

const baselinePath = (segs: Segment[], w: number): string => {
  let d = `M 0 ${LO}`;
  for (const s of segs) {
    d += ` L ${s.x0} ${LO} M ${s.x1} ${LO}`;
  }
  if (segs.length === 0 || !segs[segs.length - 1].open) {
    d += ` L ${w} ${LO}`;
  }
  return d;
};

export const PulseScope = ({ pulses }: { pulses: KeyPulse[] }) => {
  const { segs, w } = useMemo(() => layoutSegments(pulses), [pulses]);

  const normal = segs.filter((s) => !s.chatter);
  const glitches = segs.filter((s) => s.chatter);

  return (
    <div className="relative h-10 overflow-hidden rounded-md border border-base-300 bg-base-100">
      <span className={`absolute left-2 top-1 ${SILKSCREEN} opacity-40`}>
        trace
      </span>
      {segs.length === 0 ? (
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${H}`}
          aria-hidden="true"
        >
          <path
            d={`M 0 ${LO} L 100 ${LO}`}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 4"
            strokeWidth="1"
            className="text-base-content opacity-25"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 flex justify-end">
          <svg
            className="h-full flex-none"
            width={w}
            viewBox={`0 0 ${w} ${H}`}
            aria-hidden="true"
          >
            <path
              d={baselinePath(segs, w)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-accent"
            />
            <path
              d={wavePath(normal)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="text-accent"
            />
            {glitches.length > 0 && (
              <path
                d={wavePath(glitches)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className="text-red-500"
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
