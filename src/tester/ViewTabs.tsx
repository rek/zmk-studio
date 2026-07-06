import { Button } from "react-aria-components";

export type AppView = "keymap" | "tester";

export interface ViewTabsProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const TABS: { view: AppView; label: string }[] = [
  { view: "keymap", label: "Keymap" },
  { view: "tester", label: "Key Tester" },
];

export const ViewTabs = ({ activeView, onViewChange }: ViewTabsProps) => (
  <div className="flex gap-1 ml-3">
    {TABS.map(({ view, label }) => (
      <Button
        key={view}
        className={`rounded px-3 py-1 transition-all duration-100 hover:bg-base-300 ${
          activeView === view ? "bg-base-300" : ""
        }`}
        onPress={() => onViewChange(view)}
      >
        {label}
      </Button>
    ))}
  </div>
);
