import { ReactNode, useState } from "react";
import { Calendar, CreditCard, Database, Globe, Link2, Mail, MessageSquare, RefreshCw, Users, Webhook, Workflow } from "lucide-react";
import { disconnectGoogle, getIntegrationsStatus, googleConnectUrl } from "../api/client";
import { useApi } from "../lib/useApi";
import { useConfirm, useToast } from "../ui/feedback";
import { Badge, Button, Card, CodeBlock, Disclosure, EmptyState, PageHeader, Skeleton } from "../ui/primitives";
import GoogleIntegration from "../components/GoogleIntegration";
import LeadCsvRunner from "../components/LeadCsvRunner";
import type { IntegrationsStatus } from "../types/chainreact";

type StatusKind = "connected" | "configured" | "not_connected" | "not_configured" | "available" | "simulated";

const STATUS_BADGE: Record<StatusKind, { tone: "success" | "warning" | "neutral" | "outline" | "cyan"; label: string }> = {
  connected: { tone: "success", label: "Connected" },
  configured: { tone: "success", label: "Configured" },
  not_connected: { tone: "warning", label: "Not connected" },
  not_configured: { tone: "neutral", label: "Not configured" },
  available: { tone: "cyan", label: "Always available" },
  simulated: { tone: "outline", label: "Simulated" },
};

function googleStatus(s: IntegrationsStatus): StatusKind {
  if (s.google.connected) return "connected";
  return s.google.configured ? "not_connected" : "not_configured";
}

function EnvSteps({ vars, note }: { vars: string[]; note?: ReactNode }) {
  return (
    <div className="stack gap-3 text-sm">
      <ol className="stack gap-2 text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          Open <span className="mono">backend/.env</span> on the server running the ChainReact backend.
        </li>
        <li>Add the following variable{vars.length > 1 ? "s" : ""}:</li>
      </ol>
      <CodeBlock>{vars.map((v) => `${v}=...`).join("\n")}</CodeBlock>
      <ol start={3} className="stack gap-2 text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Restart the backend so it picks up the new environment.</li>
        <li>Come back here and press Refresh to verify the status.</li>
      </ol>
      {note && <p className="text-tertiary">{note}</p>}
    </div>
  );
}

function IntegrationCard({
  icon,
  name,
  description,
  status,
  actions,
  configure,
}: {
  icon: ReactNode;
  name: string;
  description: ReactNode;
  status: StatusKind | null;
  actions?: ReactNode;
  configure?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const badge = status ? STATUS_BADGE[status] : null;
  return (
    <Card padded className="stack gap-3" style={{ minWidth: 0 }}>
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <span className="empty-state-icon" style={{ width: 36, height: 36, flexShrink: 0, margin: 0 }}>
          {icon}
        </span>
        <div className="stack grow" style={{ gap: 4 }}>
          <div className="row gap-2 wrap" style={{ justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 14.5 }}>{name}</h3>
            {badge ? (
              <Badge tone={badge.tone} dot={badge.tone === "success" || badge.tone === "warning"}>
                {badge.label}
              </Badge>
            ) : (
              <Skeleton width={84} height={18} />
            )}
          </div>
          <p className="text-sm text-secondary" style={{ lineHeight: 1.55 }}>
            {description}
          </p>
        </div>
      </div>
      {(actions || configure) && (
        <div className="row gap-2 wrap" style={{ marginTop: "auto" }}>
          {actions}
          {configure && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Hide setup" : "Configure"}
            </Button>
          )}
        </div>
      )}
      {configure && open && (
        <div className="card card-muted card-pad" style={{ padding: 14 }}>
          {configure}
        </div>
      )}
    </Card>
  );
}

export default function IntegrationsPage() {
  const { data, loading, error, refresh } = useApi(getIntegrationsStatus, []);
  const confirm = useConfirm();
  const toast = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: "Disconnect Google Workspace?",
      description: "Gmail and Calendar tools will fall back to simulated runs until you connect again. Stored OAuth tokens are removed from the backend.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    setDisconnecting(true);
    try {
      await disconnectGoogle();
      toast({ tone: "success", title: "Google disconnected" });
      refresh();
    } catch (e) {
      toast({ tone: "error", title: "Could not disconnect", description: e instanceof Error ? e.message : undefined });
    } finally {
      setDisconnecting(false);
    }
  };

  const g: StatusKind | null = data ? googleStatus(data) : null;

  const googleActions =
    g === "connected" ? (
      <Button size="sm" variant="danger" onClick={handleDisconnect} loading={disconnecting}>
        Disconnect
      </Button>
    ) : g === "not_connected" ? (
      <Button size="sm" variant="primary" icon={<Link2 size={14} />} onClick={() => (window.location.href = googleConnectUrl())}>
        Connect
      </Button>
    ) : null;

  const googleConfigure =
    g === "not_configured" ? (
      <EnvSteps
        vars={["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]}
        note="Create an OAuth client (Web application) in Google Cloud Console with the Gmail and Calendar APIs enabled, and add the backend's /api/integrations/google/callback URL as an authorized redirect URI (override with GOOGLE_REDIRECT_URI if the backend is not on localhost:8000). Then press Connect."
      />
    ) : undefined;

  return (
    <div className="stack gap-8">
      <PageHeader
        eyebrow="Connections"
        title="Integrations"
        description="External services your agents can act on. Status comes straight from the backend; anything not connected runs as a labeled simulation."
        actions={
          <Button icon={<RefreshCw size={14} />} onClick={refresh} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      {error && !data ? (
        <Card>
          <EmptyState
            icon={<Workflow size={20} />}
            title="Could not reach the backend"
            description={error}
            action={
              <Button size="sm" onClick={refresh}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-auto">
          <IntegrationCard
            icon={<Calendar size={18} />}
            name="Google Workspace"
            description="Gmail and Google Calendar via OAuth. Agents holding email or calendar permissions perform real actions once connected."
            status={g}
            actions={googleActions}
            configure={googleConfigure}
          />
          <IntegrationCard
            icon={<Mail size={18} />}
            name="Email"
            description="Sending and labeling email is powered by the Gmail connection above, so it shares the Google Workspace status."
            status={g}
          />
          <IntegrationCard
            icon={<Webhook size={18} />}
            name="n8n Webhook"
            description="When configured, results of real runs are forwarded automatically to your n8n workflow for downstream automation."
            status={data ? (data.n8n.configured ? "configured" : "not_configured") : null}
            configure={<EnvSteps vars={["N8N_WEBHOOK_URL"]} note="Use the production URL of an n8n Webhook trigger node." />}
          />
          <IntegrationCard
            icon={<MessageSquare size={18} />}
            name="Slack"
            description="Lets agents with Slack permissions post messages using a bot token."
            status={data ? (data.slack.configured ? "configured" : "not_configured") : null}
            configure={<EnvSteps vars={["SLACK_BOT_TOKEN"]} note="Create a Slack app with the chat:write scope, install it to your workspace and invite the bot to target channels." />}
          />
          <IntegrationCard
            icon={<Globe size={18} />}
            name="REST APIs"
            description={
              <>
                The <span className="mono">http.request</span> tool is always available. The target URL is configured per agent when you build a system; no global credentials are stored.
              </>
            }
            status={data ? "available" : null}
          />
          <IntegrationCard
            icon={<Database size={18} />}
            name="Database"
            description="No live database integration yet. Database steps run as simulations and are labeled as simulated in run results."
            status={data ? "simulated" : null}
          />
          <IntegrationCard
            icon={<Users size={18} />}
            name="CRM"
            description="No live CRM integration yet. CRM steps run as simulations and are labeled as simulated in run results."
            status={data ? "simulated" : null}
          />
          <IntegrationCard
            icon={<CreditCard size={18} />}
            name="Payments"
            description="No live payments integration. Payment steps are always simulated and labeled, so no money ever moves."
            status={data ? "simulated" : null}
          />
        </div>
      )}

      <section className="stack gap-3">
        <div className="stack" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 16 }}>Google Workspace actions</h2>
          <p className="text-sm text-secondary">Run real Gmail and Calendar actions directly against the connected account.</p>
        </div>
        <GoogleIntegration showGmail showCalendar />
      </section>

      <section className="stack gap-3">
        <div className="stack" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 16 }}>Built-in tools</h2>
          <p className="text-sm text-secondary">Standalone utilities that run on the backend without any external connection.</p>
        </div>
        <Disclosure title="Built-in: Lead qualification" icon={<Users size={16} />} meta="Score a lead or process a CSV">
          <LeadCsvRunner />
        </Disclosure>
      </section>
    </div>
  );
}
