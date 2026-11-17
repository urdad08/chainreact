import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Panel,
  Position,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Bot, Flag, Maximize2, Play, ShieldCheck, Wrench } from "lucide-react";
import type { WorkflowGraph, WorkflowNode } from "../types/chainreact";
import { NODE_STATUS, type NodeRunStatus } from "../ui/status";
import type { Tone } from "../ui/primitives";
import { Button } from "../ui/primitives";
import { humanize } from "../lib/format";

type NodeKind = WorkflowNode["type"];

interface CrNodeData {
  kind: NodeKind;
  title: string;
  sub: string;
  status?: NodeRunStatus;
}

const CARD_W = 216;
const CARD_H = 62;
const PILL_W = 92;
const PILL_H = 32;
const COL_GAP = 280;
const ROW_GAP = 92;
const ROW_GAP_CONDITIONAL = 116;

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--text-tertiary)",
  accent: "var(--accent)",
  cyan: "var(--cyan)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  outline: "var(--border-strong)",
};

const SCOPED_CSS = `
.cr-wf .react-flow__renderer { background: var(--canvas-bg); }
.cr-wf .react-flow__background circle { fill: var(--canvas-dot); }
.cr-wf .react-flow__minimap-mask { fill: color-mix(in srgb, var(--bg) 62%, transparent); }
.cr-wf .react-flow__minimap-node { fill: var(--surface-3); stroke: none; }
.cr-wf .react-flow__minimap-node.mm-agent { fill: var(--accent-soft); stroke: var(--accent-border); }
.cr-wf .react-flow__minimap-node.mm-human_approval { fill: var(--warning-soft); stroke: var(--warning); }
.cr-wf .react-flow__minimap-node.mm-running { fill: var(--accent); }
.cr-wf .react-flow__handle { width: 7px; height: 7px; min-width: 0; min-height: 0; background: var(--surface); border: 1.5px solid var(--border-strong); }
.cr-wf .react-flow__node { cursor: grab; }
.cr-wf .react-flow__controls { box-shadow: var(--shadow-sm) !important; }
.cr-wf .react-flow__controls-button svg { fill: currentColor; }
.cr-wf-node { transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), opacity var(--dur) var(--ease); }
.cr-wf-node.is-running { animation: cr-wf-pulse 1.8s var(--ease) infinite; }
.cr-wf .spin { animation: spin 0.9s linear infinite; }
@keyframes cr-wf-pulse {
  0%, 100% { box-shadow: 0 0 0 1.5px var(--accent), 0 0 0 4px var(--accent-soft); }
  50% { box-shadow: 0 0 0 1.5px var(--accent), 0 0 0 7px transparent; }
}
`;

function statusVisual(status?: NodeRunStatus) {
  if (!status) return null;
  const v = NODE_STATUS[status];
  return v ? { ...v, color: TONE_COLOR[v.tone] } : null;
}

function KindIcon({ kind, size = 14 }: { kind: NodeKind; size?: number }) {
  switch (kind) {
    case "start":
      return <Play size={size} />;
    case "end":
      return <Flag size={size} />;
    case "tool":
      return <Wrench size={size} />;
    case "human_approval":
      return <ShieldCheck size={size} />;
    default:
      return <Bot size={size} />;
  }
}

function CrNode({ data, selected }: NodeProps<CrNodeData>) {
  const sv = statusVisual(data.status);
  const running = data.status === "running";
  const dimmed = data.status === "skipped" || data.status === "queued";
  const isTerminal = data.kind === "start" || data.kind === "end";
  const isApproval = data.kind === "human_approval";

  const ring = selected
    ? "0 0 0 1.5px var(--accent)"
    : sv && data.status !== "queued" && data.status !== "skipped"
      ? `0 0 0 1.5px ${sv.color}`
      : "none";

  const base: CSSProperties = {
    background: "var(--surface)",
    border: `1px solid ${isApproval ? "color-mix(in srgb, var(--warning) 45%, var(--border))" : "var(--border)"}`,
    boxShadow: ring === "none" ? "var(--shadow-sm)" : `${ring}, var(--shadow-sm)`,
    opacity: dimmed ? 0.62 : 1,
    color: "var(--text)",
  };

  if (isTerminal) {
    return (
      <div
        className={`cr-wf-node ${running ? "is-running" : ""}`}
        title={sv ? sv.label : undefined}
        style={{
          ...base,
          width: PILL_W,
          height: PILL_H,
          borderRadius: "var(--r-full)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 550,
          color: "var(--text-secondary)",
          background: "var(--surface-2)",
        }}
      >
        {data.kind !== "start" && <Handle type="target" position={Position.Left} />}
        <KindIcon kind={data.kind} size={12} />
        {data.kind === "start" ? "Start" : "End"}
        {sv && <span className="dot" style={{ color: sv.color, width: 6, height: 6 }} />}
        {data.kind !== "end" && <Handle type="source" position={Position.Right} />}
      </div>
    );
  }

  const iconStyle: CSSProperties = isApproval
    ? { background: "var(--warning-soft)", color: "var(--warning)" }
    : data.kind === "tool"
      ? { background: "var(--surface-3)", color: "var(--text-secondary)" }
      : { background: "var(--accent-soft)", color: "var(--accent)" };

  return (
    <div
      className={`cr-wf-node ${running ? "is-running" : ""}`}
      style={{
        ...base,
        width: CARD_W,
        minHeight: CARD_H,
        borderRadius: "var(--r-lg)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          ...iconStyle,
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "var(--r-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <KindIcon kind={data.kind} />
      </div>
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            className="truncate"
            title={data.title}
            style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, flex: 1 }}
          >
            {data.title}
          </span>
          {sv && (
            <span title={sv.label} style={{ color: sv.color, display: "inline-flex", flexShrink: 0 }}>
              {sv.icon(13)}
            </span>
          )}
        </div>
        <span className="mono truncate" title={data.sub} style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>
          {data.sub}
        </span>
        {sv && data.status !== "queued" && (
          <span style={{ fontSize: 10.5, color: sv.color, fontWeight: 550 }}>{sv.label}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { crNode: CrNode };

function nodeTitle(n: WorkflowNode): string {
  if (n.label) return n.label;
  if (n.type === "human_approval") return "Human approval";
  return humanize(n.agent ?? n.tool ?? n.id);
}

function nodeSub(n: WorkflowNode): string {
  if (n.type === "tool") return n.tool ?? n.id;
  if (n.type === "agent") return n.agent ?? n.id;
  return n.id;
}

function computeDepths(graph: WorkflowGraph): Map<string, number> {
  const depth = new Map<string, number>();
  if (graph.nodes.length === 0) return depth;
  const adjacency = new Map<string, string[]>();
  graph.nodes.forEach((n) => adjacency.set(n.id, []));
  graph.edges.forEach((e) => adjacency.get(e.source)?.push(e.target));

  // Longest-path depth; capped so a cyclic graph (e.g. a retry loop) can't relax forever.
  const cap = graph.nodes.length;
  const startNode = graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0];
  const queue: string[] = [startNode.id];
  depth.set(startNode.id, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const next of adjacency.get(cur) ?? []) {
      if (d + 1 > cap) continue;
      if (!depth.has(next) || depth.get(next)! < d + 1) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  let maxDepth = 0;
  depth.forEach((d) => (maxDepth = Math.max(maxDepth, d)));
  graph.nodes.forEach((n) => {
    if (!depth.has(n.id)) depth.set(n.id, n.type === "end" ? maxDepth + 1 : 0);
  });
  return depth;
}

function layoutNodes(graph: WorkflowGraph): Node<CrNodeData>[] {
  const depth = computeDepths(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const parents = new Map<string, string[]>();
  const conditionalTarget = new Set<string>();
  graph.edges.forEach((e) => {
    if (!parents.has(e.target)) parents.set(e.target, []);
    parents.get(e.target)!.push(e.source);
    if (e.condition) conditionalTarget.add(e.target);
  });

  const columns = new Map<number, string[]>();
  graph.nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  });

  // Order each column by the average vertical slot of its parents so branches stay
  // next to the node they came from, then centre the column on a shared midline.
  const centerY = new Map<string, number>();
  const sortedDepths = [...columns.keys()].sort((a, b) => a - b);
  for (const d of sortedDepths) {
    const ids = columns.get(d)!;
    const originalIndex = new Map(ids.map((id, i) => [id, i]));
    const bary = (id: string) => {
      const ys = (parents.get(id) ?? []).map((p) => centerY.get(p)).filter((y): y is number => y !== undefined);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
    };
    ids.sort((a, b) => bary(a) - bary(b) || originalIndex.get(a)! - originalIndex.get(b)!);

    const gap = ids.some((id) => conditionalTarget.has(id)) ? ROW_GAP_CONDITIONAL : ROW_GAP;
    const span = (ids.length - 1) * gap;
    ids.forEach((id, i) => centerY.set(id, i * gap - span / 2));
  }

  return graph.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const terminal = n.type === "start" || n.type === "end";
    const w = terminal ? PILL_W : CARD_W;
    const h = terminal ? PILL_H : CARD_H;
    return {
      id: n.id,
      type: "crNode",
      position: { x: d * COL_GAP + (CARD_W - w) / 2, y: (centerY.get(n.id) ?? 0) - h / 2 },
      data: { kind: byId.get(n.id)!.type, title: nodeTitle(n), sub: nodeSub(n) },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}

function buildEdges(graph: WorkflowGraph, nodeStatus?: Record<string, NodeRunStatus>): Edge[] {
  return graph.edges.map((e, i) => {
    const active = nodeStatus?.[e.target] === "running";
    const traversed =
      !active &&
      !!nodeStatus &&
      !!nodeStatus[e.source] &&
      !!nodeStatus[e.target] &&
      !["queued", "skipped"].includes(nodeStatus[e.target]) &&
      !["queued", "skipped"].includes(nodeStatus[e.source]);
    const stroke = active ? "var(--accent)" : traversed ? "var(--text-tertiary)" : "var(--border-strong)";
    return {
      id: `e${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: active,
      label: e.condition ?? undefined,
      style: {
        stroke,
        strokeWidth: active ? 1.75 : 1.5,
        strokeDasharray: e.condition && !active ? "5 4" : undefined,
      },
      labelStyle: { fontFamily: "var(--font-mono)", fontSize: 10.5, fill: "var(--text-secondary)" },
      labelBgStyle: { stroke: "var(--border)", strokeWidth: 1 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      pathOptions: { borderRadius: 10 },
    } as Edge;
  });
}

function minimapClass(node: Node<CrNodeData>): string {
  const cls = [`mm-${node.data.kind}`];
  if (node.data.status === "running") cls.push("mm-running");
  return cls.join(" ");
}

function Canvas({ graph, nodeStatus }: { graph: WorkflowGraph; nodeStatus?: Record<string, NodeRunStatus> }) {
  const laidOut = useMemo(() => layoutNodes(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CrNodeData>(laidOut);
  const edges = useMemo(() => buildEdges(graph, nodeStatus), [graph, nodeStatus]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(laidOut.map((n) => ({ ...n, data: { ...n.data, status: nodeStatus?.[n.id] } })));
    const raf = requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));
    return () => cancelAnimationFrame(raf);
    // Only re-layout when the graph itself changes; status updates are merged below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laidOut, setNodes, fitView]);

  useEffect(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: nodeStatus?.[n.id] } })));
  }, [nodeStatus, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        nodeClassName={minimapClass}
        nodeBorderRadius={4}
        nodeStrokeWidth={1}
        style={{ width: 150, height: 96 }}
      />
      <Panel position="top-right">
        <Button size="sm" icon={<Maximize2 size={13} />} onClick={() => fitView({ padding: 0.2, duration: 250 })}>
          Fit view
        </Button>
      </Panel>
    </ReactFlow>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="row gap-2 text-xs text-secondary" style={{ minWidth: 0 }}>
      {swatch}
      {label}
    </span>
  );
}

function iconSwatch(kind: NodeKind, style: CSSProperties) {
  return (
    <span
      style={{
        ...style,
        width: 18,
        height: 18,
        borderRadius: "var(--r-sm)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <KindIcon kind={kind} size={11} />
    </span>
  );
}

export default function WorkflowVisualizer({
  graph,
  nodeStatus,
  height = "min(440px, 60vh)",
}: {
  graph: WorkflowGraph;
  nodeStatus?: Record<string, NodeRunStatus>;
  height?: number | string;
}) {
  const hasConditions = graph.edges.some((e) => e.condition);

  return (
    <div className="cr-wf stack gap-3" style={{ minWidth: 0 }}>
      <style>{SCOPED_CSS}</style>
      <div
        style={{
          height,
          minHeight: 280,
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          background: "var(--canvas-bg)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {graph.nodes.length === 0 ? (
          <div className="row text-sm text-tertiary" style={{ height: "100%", justifyContent: "center" }}>
            This workflow has no steps yet.
          </div>
        ) : (
          <ReactFlowProvider>
            <Canvas graph={graph} nodeStatus={nodeStatus} />
          </ReactFlowProvider>
        )}
      </div>
      <div className="row wrap" style={{ columnGap: 18, rowGap: 8 }}>
        <LegendItem
          label="Start / end"
          swatch={
            <span
              style={{
                width: 22,
                height: 12,
                borderRadius: "var(--r-full)",
                border: "1px solid var(--border-strong)",
                background: "var(--surface-2)",
              }}
            />
          }
        />
        <LegendItem label="Agent" swatch={iconSwatch("agent", { background: "var(--accent-soft)", color: "var(--accent)" })} />
        <LegendItem label="Tool" swatch={iconSwatch("tool", { background: "var(--surface-3)", color: "var(--text-secondary)" })} />
        <LegendItem
          label="Human approval"
          swatch={iconSwatch("human_approval", { background: "var(--warning-soft)", color: "var(--warning)" })}
        />
        {hasConditions && (
          <LegendItem
            label="Conditional path"
            swatch={
              <svg width="24" height="8" aria-hidden>
                <line x1="0" y1="4" x2="24" y2="4" style={{ stroke: "var(--text-tertiary)", strokeWidth: 1.5, strokeDasharray: "4 3" }} />
              </svg>
            }
          />
        )}
      </div>
    </div>
  );
}
