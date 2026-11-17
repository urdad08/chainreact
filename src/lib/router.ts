import { useEffect, useState } from "react";

// Hash-based routing: no router dependency, deep links survive a refresh on
// any static host, and the Google OAuth callback (which redirects to the
// bare origin with a query string) still lands on the app.

export type RouteName =
  | "overview"
  | "build"
  | "systems"
  | "system"
  | "executions"
  | "execution"
  | "integrations"
  | "tools"
  | "permissions"
  | "settings"
  | "about";

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  path: string;
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/overview";
  const parts = path.split("/").filter(Boolean);
  const [head, id] = parts;
  switch (head) {
    case "build":
      return { name: "build", params: {}, path };
    case "systems":
      return id ? { name: "system", params: { id }, path } : { name: "systems", params: {}, path };
    case "executions":
      return id ? { name: "execution", params: { id }, path } : { name: "executions", params: {}, path };
    case "integrations":
      return { name: "integrations", params: {}, path };
    case "tools":
      return { name: "tools", params: {}, path };
    case "permissions":
      return { name: "permissions", params: {}, path };
    case "settings":
      return { name: "settings", params: {}, path };
    case "about":
      return { name: "about", params: {}, path };
    default:
      return { name: "overview", params: {}, path: "/overview" };
  }
}

export function navigate(path: string): void {
  const target = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash !== target) window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const routeHref = (path: string) => `#${path}`;
