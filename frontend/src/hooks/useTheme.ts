import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("bizinsight_theme") as Theme | null;
    return saved ?? "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("bizinsight_theme", theme);
  }, [theme]);

  // Apply immediately on first mount (before any re-render)
  useEffect(() => {
    const saved = localStorage.getItem("bizinsight_theme") as Theme | null;
    if (saved) applyTheme(saved);
  }, []);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
