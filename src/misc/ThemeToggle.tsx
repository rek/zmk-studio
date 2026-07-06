import { useEffect } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "react-aria-components";

import { Tooltip } from "./Tooltip";
import { useLocalStorageState } from "./useLocalStorageState";

// Every color token is a CSS light-dark() value keyed off the root
// color-scheme, so forcing that one property re-themes the whole app;
// "system" restores the stylesheet default of `light dark`.
type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICONS: Record<Theme, typeof Sun> = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
};

export const ThemeToggle = () => {
  const [theme, setTheme] = useLocalStorageState<Theme>("theme", "system");

  useEffect(() => {
    document.documentElement.style.colorScheme =
      theme === "system" ? "light dark" : theme;
  }, [theme]);

  const label = `Theme: ${theme} — click to change`;
  const Icon = ICONS[theme];

  return (
    <Tooltip label={label}>
      <Button
        className="flex items-center justify-center p-1.5 rounded hover:bg-base-300"
        onPress={() => setTheme(NEXT[theme])}
      >
        <Icon className="inline-block w-4 mx-1" aria-label={label} />
      </Button>
    </Tooltip>
  );
};
