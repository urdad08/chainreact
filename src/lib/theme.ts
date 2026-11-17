import { useEffect } from "react";
import { usePref } from "./prefs";

export type ThemePreference = "dark" | "light" | "system";

function resolve(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
}

export function useTheme(): [ThemePreference, (t: ThemePreference) => void, "dark" | "light"] {
  // Stored raw (not JSON) by index.html's pre-paint script, so read/write the
  // same raw key here rather than through usePref's JSON encoding.
  const [pref, setPrefJson] = usePref<ThemePreference>("theme-pref", readRawTheme());
  const resolved = resolve(pref);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    try {
      localStorage.setItem("cr-theme", pref);
    } catch {
      /* ignore */
    }
  }, [pref, resolved]);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolve("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return [pref, setPrefJson, resolved];
}

function readRawTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem("cr-theme");
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "dark";
}
