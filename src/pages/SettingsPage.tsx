import { useCallback, useEffect, useState } from "react";
import { Info, Monitor, Moon, Palette, PanelLeft, RefreshCw, Server, Sun, Trash2, Zap } from "lucide-react";
import { API_BASE_URL } from "../api/client";
import { ALLOW_REAL_ACTIONS_KEY, SIDEBAR_COLLAPSED_KEY, clearPrefs, usePref } from "../lib/prefs";
import { ThemePreference, useTheme } from "../lib/theme";
import { routeHref } from "../lib/router";
import { useConfirm, useToast } from "../ui/feedback";
import { Badge, Button, Card, CardHeader, PageHeader, Segmented, Switch } from "../ui/primitives";

type Health = { state: "checking" } | { state: "ok"; checkedAt: Date } | { state: "error"; message: string; checkedAt: Date };

function useHealth() {
  const [health, setHealth] = useState<Health>({ state: "checking" });
  const check = useCallback(async () => {
    setHealth({ state: "checking" });
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) setHealth({ state: "ok", checkedAt: new Date() });
      else setHealth({ state: "error", message: `HTTP ${res.status}`, checkedAt: new Date() });
    } catch (e) {
      setHealth({ state: "error", message: e instanceof Error ? e.message : "Unreachable", checkedAt: new Date() });
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  return [health, check] as const;
}

function SettingRow({ title, description, control }: { title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="row gap-4 wrap" style={{ justifyContent: "space-between" }}>
      <div className="stack grow" style={{ gap: 2, minWidth: 200 }}>
        <span style={{ fontWeight: 550 }}>{title}</span>
        <span className="text-sm text-tertiary">{description}</span>
      </div>
      {control}
    </div>
  );
}

export default function SettingsPage() {
  const [themePref, setThemePref, resolved] = useTheme();
  const [allowReal, setAllowReal] = usePref<boolean>(ALLOW_REAL_ACTIONS_KEY, true);
  const [collapsed, setCollapsed] = usePref<boolean>(SIDEBAR_COLLAPSED_KEY, false);
  const [health, recheck] = useHealth();
  const confirm = useConfirm();
  const toast = useToast();

  const resetPrefs = async () => {
    const ok = await confirm({
      title: "Reset local preferences?",
      description: "Theme, layout, execution defaults and the default permission policy stored in this browser will be cleared. Systems and runs on the backend are not affected.",
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!ok) return;
    clearPrefs();
    toast({ tone: "success", title: "Local preferences reset" });
  };

  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <PageHeader eyebrow="Workspace" title="Settings" description="Preferences are stored in this browser only." />

      <Card>
        <CardHeader icon={<Palette size={16} />} title="Appearance" />
        <div className="card-body">
          <SettingRow
            title="Theme"
            description={themePref === "system" ? `Following your system (currently ${resolved}).` : "Choose how ChainReact looks."}
            control={
              <Segmented<ThemePreference>
                value={themePref}
                onChange={setThemePref}
                options={[
                  { value: "dark", label: "Dark", icon: <Moon size={13} /> },
                  { value: "light", label: "Light", icon: <Sun size={13} /> },
                  { value: "system", label: "System", icon: <Monitor size={13} /> },
                ]}
              />
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Zap size={16} />} title="Execution defaults" />
        <div className="card-body">
          <SettingRow
            title="Perform real actions where connected"
            description="When on, tools with a real handler and a live connection perform real actions. When off, every tool call is simulated."
            control={<Switch checked={allowReal} onChange={setAllowReal} />}
          />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<PanelLeft size={16} />} title="Layout" />
        <div className="card-body">
          <SettingRow title="Collapsed sidebar" description="Show only icons in the navigation sidebar." control={<Switch checked={collapsed} onChange={setCollapsed} />} />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<Server size={16} />}
          title="Backend"
          actions={
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => void recheck()} loading={health.state === "checking"}>
              Recheck
            </Button>
          }
        />
        <div className="card-body stack gap-3">
          <div className="row gap-3 wrap">
            <span className="text-sm text-tertiary" style={{ width: 90 }}>
              API URL
            </span>
            <span className="mono truncate" style={{ minWidth: 0 }}>
              {API_BASE_URL}
            </span>
          </div>
          <div className="row gap-3 wrap">
            <span className="text-sm text-tertiary" style={{ width: 90 }}>
              Health
            </span>
            {health.state === "checking" ? (
              <Badge>Checking</Badge>
            ) : health.state === "ok" ? (
              <Badge tone="success" dot>
                Healthy
              </Badge>
            ) : (
              <Badge tone="danger" dot title={health.message}>
                Unreachable
              </Badge>
            )}
            {health.state !== "checking" && (
              <span className="text-xs text-tertiary">
                {health.state === "error" ? `${health.message} · ` : ""}checked {health.checkedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-xs text-tertiary">
            Set <span className="mono">VITE_API_URL</span> at build time to point the app at a different backend.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Trash2 size={16} />} title="Data" />
        <div className="card-body">
          <SettingRow
            title="Reset local preferences"
            description="Clear every ChainReact preference saved in this browser."
            control={
              <Button variant="danger" size="sm" onClick={() => void resetPrefs()}>
                Reset
              </Button>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Info size={16} />} title="About" />
        <div className="card-body">
          <SettingRow
            title="About ChainReact"
            description="Project background, architecture diagrams and team."
            control={
              <a className="btn btn-sm" href={routeHref("/about")}>
                Open
              </a>
            }
          />
        </div>
      </Card>
    </div>
  );
}
