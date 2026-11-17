import { useEffect, useMemo, useState } from "react";
import Sidebar from "./layout/Sidebar";
import Topbar, { Crumb } from "./layout/Topbar";
import { navigate, useRoute } from "./lib/router";
import { SIDEBAR_COLLAPSED_KEY, usePref } from "./lib/prefs";
import { useTheme } from "./lib/theme";
import { API_BASE_URL, listExecutions } from "./api/client";
import { ConfirmProvider, ToastProvider } from "./ui/feedback";
import DashboardPage from "./pages/DashboardPage";
import BuildPage from "./pages/BuildPage";
import SystemsPage from "./pages/SystemsPage";
import SystemDetailPage from "./pages/SystemDetailPage";
import ExecutionsPage from "./pages/ExecutionsPage";
import ExecutionDetailPage from "./pages/ExecutionDetailPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ToolsPage from "./pages/ToolsPage";
import PermissionsPage from "./pages/PermissionsPage";
import SettingsPage from "./pages/SettingsPage";
import OverviewPage from "./pages/OverviewPage";
import ChatWidget from "./components/ChatWidget";

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell() {
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const [collapsed, setCollapsed] = usePref<boolean>(SIDEBAR_COLLAPSED_KEY, false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // The Google OAuth callback redirects to the bare origin with a query flag;
  // send the person to the Integrations page where the result is shown.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ((params.has("google_connected") || params.has("google_connect_error")) && !window.location.hash.startsWith("#/integrations")) {
      navigate("/integrations");
    }
  }, []);

  // Real backend health + pending-approval count for the sidebar badge.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const health = await fetch(`${API_BASE_URL}/health`);
        if (!cancelled) setBackendOnline(health.ok);
        const runs = await listExecutions();
        if (!cancelled) setPendingApprovals(runs.filter((r) => r.status === "waiting_approval").length);
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    };
    poll();
    const id = window.setInterval(() => document.visibilityState === "visible" && poll(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const crumbs: Crumb[] = useMemo(() => {
    switch (route.name) {
      case "overview":
        return [{ label: "Overview" }];
      case "build":
        return [{ label: "Workspace", href: "/overview" }, { label: "Build Agent System" }];
      case "systems":
        return [{ label: "Workspace", href: "/overview" }, { label: "My Systems" }];
      case "system":
        return [{ label: "My Systems", href: "/systems" }, { label: route.params.id }];
      case "executions":
        return [{ label: "Workspace", href: "/overview" }, { label: "Execution History" }];
      case "execution":
        return [{ label: "Execution History", href: "/executions" }, { label: `Run ${route.params.id}` }];
      case "integrations":
        return [{ label: "Configuration" }, { label: "Integrations" }];
      case "tools":
        return [{ label: "Configuration" }, { label: "Tool Registry" }];
      case "permissions":
        return [{ label: "Configuration" }, { label: "Permissions" }];
      case "settings":
        return [{ label: "Configuration" }, { label: "Settings" }];
      case "about":
        return [{ label: "About ChainReact" }];
    }
  }, [route]);

  const wide = route.name === "build" || route.name === "system" || route.name === "execution";

  return (
    <div className="app-shell">
      <Sidebar
        active={route.name}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        pendingApprovals={pendingApprovals}
        backendOnline={backendOnline}
      />
      <div className="main">
        <Topbar crumbs={crumbs} onOpenMobile={() => setMobileOpen(true)} theme={theme} onTheme={setTheme} showNewButton={route.name !== "build"} />

        {/* The builder stays mounted (just hidden) so an in-flight build or
            its result survives navigating to another page and back. */}
        <main className={`content is-wide`} hidden={route.name !== "build"} key="build">
          <BuildPage />
        </main>

        {route.name !== "build" && (
          <main className={`content ${wide ? "is-wide" : ""}`} key={route.path}>
            {route.name === "overview" && <DashboardPage />}
            {route.name === "systems" && <SystemsPage />}
            {route.name === "system" && <SystemDetailPage systemId={route.params.id} />}
            {route.name === "executions" && <ExecutionsPage />}
            {route.name === "execution" && <ExecutionDetailPage runId={route.params.id} />}
            {route.name === "integrations" && <IntegrationsPage />}
            {route.name === "tools" && <ToolsPage />}
            {route.name === "permissions" && <PermissionsPage />}
            {route.name === "settings" && <SettingsPage />}
            {route.name === "about" && <OverviewPage />}
          </main>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
