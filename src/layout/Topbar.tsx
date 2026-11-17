import { Fragment, ReactNode } from "react";
import { ChevronRight, Menu, Monitor, Moon, Plus, Sun } from "lucide-react";
import { navigate } from "../lib/router";
import { ThemePreference } from "../lib/theme";
import { Button, Tooltip } from "../ui/primitives";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { dark: "light", light: "system", system: "dark" };
const THEME_ICON: Record<ThemePreference, ReactNode> = {
  dark: <Moon size={16} />,
  light: <Sun size={16} />,
  system: <Monitor size={16} />,
};

export default function Topbar({
  crumbs,
  onOpenMobile,
  theme,
  onTheme,
  showNewButton,
}: {
  crumbs: Crumb[];
  onOpenMobile: () => void;
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  showNewButton: boolean;
}) {
  return (
    <header className="topbar">
      <Button variant="ghost" iconOnly className="mobile-only" aria-label="Open navigation" onClick={onOpenMobile}>
        <Menu size={18} />
      </Button>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={14} />}
            {c.href && i < crumbs.length - 1 ? (
              <a href={`#${c.href}`} style={{ color: "inherit" }}>
                {c.label}
              </a>
            ) : (
              <span className={i === crumbs.length - 1 ? "current truncate" : "truncate"}>{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="spacer" />
      <Tooltip content={`Theme: ${theme} (click to switch)`} side="bottom">
        <Button variant="ghost" iconOnly aria-label="Switch theme" onClick={() => onTheme(NEXT_THEME[theme])}>
          {THEME_ICON[theme]}
        </Button>
      </Tooltip>
      {showNewButton && (
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate("/build")}>
          <span className="desktop-only">New agent system</span>
          <span className="mobile-only">New</span>
        </Button>
      )}
    </header>
  );
}
