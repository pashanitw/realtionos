"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeCtx = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}>({ theme: "light", toggle: () => {}, setTheme: () => {} });

/**
 * Lightweight theme provider. The no-flash class is applied by THEME_INIT
 * (rendered in the server layout's <head>) before hydration, so there is no
 * client-rendered <script> and no hydration mismatch — unlike next-themes
 * under React 19.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const apply = useCallback((t: Theme) => {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    apply(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [apply]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme: apply }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);

/** Runs before paint to set the theme class — defaults to light. */
export const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark', t==='dark');}catch(e){}})();`;
