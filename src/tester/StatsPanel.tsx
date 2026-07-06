import { ReactNode } from "react";

import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { PulseScope } from "./PulseScope";
import { TesterState } from "./tester-state";
import { MONO_DATA, SILKSCREEN } from "./ui";

const fmtMs = (ms?: number) => (ms === undefined ? "—" : ms.toFixed(1));

const Readout = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className={SILKSCREEN}>{label}</span>
    <span className={`${MONO_DATA} truncate`}>{children}</span>
  </div>
);

// Per-switch detail for the last-pressed (or clicked) position: press count,
// hold timing, chatter, the raw browser event, and the pulse trace. Unmapped
// codes still show up in "last event" so nothing disappears silently.
export const StatsPanel = ({ state }: { state: TesterState }) => {
  const pos = state.focusedPosition;
  const stats = pos !== undefined ? state.byPosition[pos] : undefined;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-200 p-3">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className={SILKSCREEN}>Switch readout</h3>
        <span className={`${MONO_DATA} opacity-70`}>
          {pos !== undefined ? (
            <>
              #{pos}
              {state.lastEvent?.positions.includes(pos) &&
                state.lastEvent.usages.length > 0 && (
                  <>
                    {" · "}
                    <HidUsageLabel hid_usage={state.lastEvent.usages[0]} />
                  </>
                )}
            </>
          ) : (
            "—"
          )}
        </span>
      </header>

      {pos === undefined ? (
        <p className="my-auto text-[0.75rem] italic opacity-40">
          Press a switch — or click one on the board — to inspect it.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <Readout label="Presses">{stats?.pressCount ?? 0}</Readout>
            <Readout label="Hold ms · last">{fmtMs(stats?.lastHoldMs)}</Readout>
            <Readout label="min / max">
              {fmtMs(stats?.minHoldMs)} / {fmtMs(stats?.maxHoldMs)}
            </Readout>
            <Readout label="Chatter">
              <span className={stats?.chatterCount ? "text-red-500" : ""}>
                {stats?.chatterCount ?? 0}
                {stats?.lastChatterGapMs !== undefined &&
                  ` @ ${fmtMs(stats.lastChatterGapMs)} ms`}
              </span>
            </Readout>
          </div>
          <PulseScope pulses={stats?.pulses ?? []} />
        </>
      )}

      <div className="flex items-baseline gap-2">
        <span className={SILKSCREEN}>Last event</span>
        <span className={`${MONO_DATA} truncate opacity-70`}>
          {state.lastEvent ? state.lastEvent.code : "—"}
        </span>
        {state.lastEvent && state.lastEvent.positions.length === 0 && (
          <span className="text-[0.7rem] opacity-50">
            no matching key on this layer
          </span>
        )}
      </div>
    </section>
  );
};
