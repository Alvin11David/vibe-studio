import { createContext, useContext, useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeCtx {
  mode: Mode;
  resolved: Resolved;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function getSystem(): Resolved {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("dark");
  const [resolved, setResolved] = useState<Resolved>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("aurum-theme") as Mode | null) ?? "system";
    setModeState(stored);
  }, []);

  useEffect(() => {
    const r = mode === "system" ? getSystem() : mode;
    setResolved(r);
    apply(r);
    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onChange = () => { const nr = getSystem(); setResolved(nr); apply(nr); };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [mode]);

  const setMode = (m: Mode) => { localStorage.setItem("aurum-theme", m); setModeState(m); };

  return <Ctx.Provider value={{ mode, resolved, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
