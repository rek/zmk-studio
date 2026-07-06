import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { HeldKey, TesterState, heldKeysInPressOrder } from "./tester-state";
import { MONO_DATA, SILKSCREEN } from "./ui";

const chipLabel = (key: HeldKey) => {
  if (key.usages.length > 0) {
    return <HidUsageLabel hid_usage={key.usages[0]} />;
  }
  return <span className="font-mono">{key.code}</span>;
};

// Live rollover (NKRO) card: one keycap-styled chip per currently-held key,
// in press order, with the high-water mark of simultaneous holds.
export const HeldKeysRow = ({ state }: { state: TesterState }) => {
  const held = heldKeysInPressOrder(state);

  return (
    <section className="flex min-h-[6.5rem] flex-col gap-2 rounded-xl border border-base-300 bg-base-200 p-3">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className={SILKSCREEN}>Rollover</h3>
        <span className={`${MONO_DATA} opacity-70`}>
          {held.length} held · peak {state.maxSimultaneous}
        </span>
      </header>
      <div className="flex flex-1 flex-wrap content-start items-start gap-1.5">
        {held.length === 0 ? (
          <span className="text-[0.75rem] italic opacity-40">
            Hold several keys at once to check rollover.
          </span>
        ) : (
          held.map((k) => (
            <span
              key={k.code}
              className="rounded-md border border-base-300 border-b-[3px] bg-base-100 px-2 py-1 text-[0.8rem] shadow-sm"
            >
              {chipLabel(k)}
            </span>
          ))
        )}
      </div>
    </section>
  );
};
