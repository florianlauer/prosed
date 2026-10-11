import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// Runs in <head> before the first paint, so a saved theme never flashes.
export const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function ThemeToggle({ label }: { label: string }) {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      if (next) localStorage.setItem("theme", "light");
      else localStorage.removeItem("theme");
    } catch {
      // Private modes can refuse storage; the choice then lasts for this page only.
    }
  };
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={light}
      aria-label={label}
      onClick={toggle}
    >
      <Icon name={light ? "moon" : "sun"} size={18} />
    </button>
  );
}
