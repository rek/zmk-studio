import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { TesterState } from "./tester-state";

const fmtMs = (ms?: number) =>
  ms === undefined ? "—" : `${ms.toFixed(1)} ms`;

// Per-key detail for the last-pressed (or clicked) position: press count,
// hold durations, and chatter info. Also shows the raw last browser event so
// unmapped codes are still visible to the user.
export const StatsPanel = ({ state }: { state: TesterState }) => {
  const pos = state.focusedPosition;
  const stats = pos !== undefined ? state.byPosition[pos] : undefined;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-2 rounded bg-base-200 min-h-28 content-start">
      <span className="opacity-70">Key</span>
      <span>
        {pos !== undefined ? (
          <>
            #{pos}
            {state.lastEvent?.positions.includes(pos) &&
              state.lastEvent.usages.length > 0 && (
                <>
                  {" — "}
                  <HidUsageLabel hid_usage={state.lastEvent.usages[0]} />
                </>
              )}
          </>
        ) : (
          <span className="opacity-40 italic">
            press or click a key to see its stats
          </span>
        )}
      </span>

      <span className="opacity-70">Presses</span>
      <span>{stats?.pressCount ?? 0}</span>

      <span className="opacity-70">Hold (last / min / max)</span>
      <span>
        {fmtMs(stats?.lastHoldMs)} / {fmtMs(stats?.minHoldMs)} /{" "}
        {fmtMs(stats?.maxHoldMs)}
      </span>

      <span className="opacity-70">Chatter</span>
      <span className={stats?.chatterCount ? "text-red-500" : ""}>
        {stats?.chatterCount ?? 0}
        {stats?.lastChatterGapMs !== undefined &&
          ` (last gap ${fmtMs(stats.lastChatterGapMs)})`}
      </span>

      <span className="opacity-70">Last event</span>
      <span>
        {state.lastEvent ? (
          <>
            <code>{state.lastEvent.code}</code>
            {state.lastEvent.positions.length === 0 && (
              <span className="opacity-70">
                {" "}
                — no matching key on this layer
              </span>
            )}
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
};
