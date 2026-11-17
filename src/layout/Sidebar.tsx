import { ReactNode } from "react";
import {
  BookOpen,
  Boxes,
  History,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Logo from "./Logo";
import { routeHref, RouteName } from "../lib/router";
import { Tooltip } from "../ui/primitives";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  match: RouteName[];
  badge?: number;
}

export default function Sidebar({
  active,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  pendingApprovals,
  backendOnline,
}: {
  active: RouteName;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pendingApprovals: number;
  backendOnline: boolean | null;
}) {
  const workspace: NavItem[] = [
    { label: "Overview", href: "/overview", icon: <LayoutDashboard size={17} />, match: ["overview"] },
    { label: "Build Agent System", href: "/build", icon: <Sparkles size={17} />, match: ["build"] },
    { label: "My Systems", href: "/systems", icon: <Boxes size={17} />, match: ["systems", "system"] },
    { label: "Execution History", href: "/executions", icon: <History size={17} />, match: ["executions", "execution"], badge: pendingApprovals || undefined },
  ];
  const configuration: NavItem[] = [
    { label: "Integrations", href: "/integrations", icon: <Plug size={17} />, match: ["integrations"] },
    { label: "Tool Registry", href: "/tools", icon: <Wrench size={17} />, match: ["tools"] },
    { label: "Permissions", href: "/permissions", icon: <ShieldCheck size={17} />, match: ["permissions"] },
    { label: "Settings", href: "/settings", icon: <Settings size={17} />, match: ["settings"] },
  ];

  const renderItem = (item: NavItem) => {
    const isActive = item.match.includes(active);
    const link = (
      <a
        key={item.href}
        href={routeHref(item.href)}
        className={`nav-item ${isActive ? "is-active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={onCloseMobile}
      >
        {item.icon}
        <span className="nav-label">{item.label}</span>
        {item.badge ? (
          <span className="nav-badge" title={`${item.badge} run(s) awaiting approval`}>
            {item.badge}
          </span>
        ) : null}
      </a>
    );
    return collapsed ? (
      <Tooltip key={item.href} content={item.badge ? `${item.label} · ${item.badge} pending` : item.label} side="right">
        {link}
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <>
      <div className={`sidebar-scrim ${mobileOpen ? "is-visible" : ""}`} onClick={onCloseMobile} />
      <aside className={`sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} aria-label="Primary">
        <div className="sidebar-brand">
          <Logo size={28} />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">ChainReact</span>
            <span className="sidebar-brand-tag">Agent Engineering Platform</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Workspace</div>
          {workspace.map(renderItem)}
          <div className="nav-section-title" style={{ marginTop: 10 }}>
            Configuration
          </div>
          {configuration.map(renderItem)}
        </nav>

        <div className="sidebar-footer">
          {renderItem({ label: "About ChainReact", href: "/about", icon: <BookOpen size={17} />, match: ["about"] })}
          <button type="button" className="nav-item desktop-only" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span className="nav-label">Collapse sidebar</span>
          </button>
          <div className="sidebar-profile" style={{ marginTop: 6 }}>
            <span className="avatar">LW</span>
            <div className="sidebar-profile-text">
              <span style={{ fontSize: 13, fontWeight: 550 }}>Local workspace</span>
              <span className="row gap-1 text-xs" style={{ color: backendOnline === false ? "var(--danger)" : backendOnline ? "var(--success)" : "var(--text-tertiary)" }}>
                <span className="dot" />
                {backendOnline === null ? "Checking backend…" : backendOnline ? "Backend connected" : "Backend unreachable"}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
