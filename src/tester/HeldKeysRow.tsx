import { HidUsageLabel } from "../keyboard/HidUsageLabel";
import { HeldKey, TesterState, heldKeysInPressOrder } from "./tester-state";

const chipLabel = (key: HeldKey) => {
  if (key.usages.length > 0) {
    return <HidUsageLabel hid_usage={key.usages[0]} />;
  }
  return <span>{key.code}</span>;
};

// Live rollover (NKRO) view: one chip per currently-held key, in press order,
// plus the high-water mark of simultaneously held keys.
export const HeldKeysRow = ({ state }: { state: TesterState }) => {
  const held = heldKeysInPressOrder(state);

  return (
    <div className="flex items-center gap-2 min-h-10 px-2">
      <span className="opacity-70">Held:</span>
      <div className="flex flex-wrap gap-1 flex-1">
        {held.length === 0 ? (
          <span className="opacity-40 italic">none</span>
        ) : (
          held.map((k) => (
            <span
              key={k.code}
              className="rounded bg-primary text-primary-content px-2 py-1"
            >
              {chipLabel(k)}
            </span>
          ))
        )}
      </div>
      <span className="opacity-70 text-nowrap">
        {held.length} held / max {state.maxSimultaneous}
      </span>
    </div>
  );
};
