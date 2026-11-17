import { useState } from "react";
import { ArrowLeft, Boxes, PlayCircle } from "lucide-react";
import { getAuditTrail, getSystem, runSandboxFor } from "../api/client";
import type { SandboxReport } from "../types/chainreact";
import { useApi } from "../lib/useApi";
import { navigate } from "../lib/router";
import { formatDateTime, formatRelativeTime } from "../lib/format";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../ui/primitives";
import SystemWorkspace, { WorkspaceTab } from "../components/workspace/SystemWorkspace";

export default function SystemDetailPage({ systemId }: { systemId: string }) {
  const system = useApi(() => getSystem(systemId), [systemId]);
  const audit = useApi(
    () => (system.data ? getAuditTrail(system.data.process_name).catch(() => null) : Promise.resolve(null)),
    [system.data?.process_name]
  );
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("overview");

  async function rerun() {
    if (!system.data) return;
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      setReport(await runSandboxFor(system.data));
    } catch (e) {
      setSandboxError(e instanceof Error ? e.message : "Sandbox run failed");
    } finally {
      setSandboxLoading(false);
    }
  }

  if (system.loading && !system.data) {
    return (
      <div className="stack gap-4">
        <Skeleton width={280} height={28} />
        <Skeleton height={16} width="60%" />
        <Skeleton height={320} />
      </div>
    );
  }

  if (system.error || !system.data) {
    return (
      <Card padded>
        <EmptyState
          icon={<Boxes size={20} />}
          title="System not found"
          description={system.error ?? `No stored system with id ${systemId}.`}
          action={
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate("/systems")}>
              Back to My Systems
            </Button>
          }
        />
      </Card>
    );
  }

  const s = system.data;
  return (
    <div className="stack gap-5">
      <PageHeader
        eyebrow={
          <span className="row gap-2">
            <span className="mono">{s.system_id}</span>
            <Badge tone="outline">Created {formatRelativeTime(s.created_at)}</Badge>
          </span>
        }
        title={s.process_spec.name || s.process_name}
        description={s.process_spec.objective}
        actions={
          <span title={formatDateTime(s.created_at)}>
            <Button variant="primary" icon={<PlayCircle size={15} />} onClick={() => setTab("execution")}>
              Run system
            </Button>
          </span>
        }
      />
      <SystemWorkspace
        tab={tab}
        onTabChange={setTab}
        systemId={s.system_id}
        spec={s.process_spec}
        architecture={s.agent_architecture}
        workflow={s.workflow}
        auditTrail={audit.data}
        sandboxReport={report}
        onRerunSandbox={rerun}
        sandboxLoading={sandboxLoading}
        sandboxError={sandboxError}
      />
    </div>
  );
}
