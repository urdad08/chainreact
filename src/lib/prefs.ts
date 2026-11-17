import { useCallback, useEffect, useState } from "react";

// Small, typed localStorage-backed preferences. Every access is guarded --
// storage can be unavailable (private mode, blocked site data) and the app
// must still work with defaults.

const PREFIX = "cr-";

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("cr-pref-change", { detail: key }));
  } catch {
    /* storage unavailable -- preference simply won't persist */
  }
}

export function clearPrefs(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    window.dispatchEvent(new CustomEvent("cr-pref-change", { detail: "*" }));
  } catch {
    /* ignore */
  }
}

export function usePref<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPref(key, fallback));
  useEffect(() => {
    const onChange = (e: Event) => {
      const changed = (e as CustomEvent<string>).detail;
      if (changed === key || changed === "*") setValue(readPref(key, fallback));
    };
    window.addEventListener("cr-pref-change", onChange);
    return () => window.removeEventListener("cr-pref-change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writePref(key, next);
    },
    [key]
  );
  return [value, update];
}

// ---- Permission policy defaults (edited on the Permissions page, applied
// as the starting point every time the builder opens). ----

export type PermissionPolicy = "unset" | "allow" | "deny";

export interface PermissionDefaults {
  policy: Record<string, PermissionPolicy>;
  requireApproval: string[];
}

export const PERMISSION_DEFAULTS_KEY = "permission-defaults";
export const EMPTY_PERMISSION_DEFAULTS: PermissionDefaults = { policy: {}, requireApproval: [] };

export const ALLOW_REAL_ACTIONS_KEY = "allow-real-actions";
export const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
