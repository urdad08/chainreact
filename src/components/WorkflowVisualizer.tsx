import { useMemo } from "react";
import ReactFlow, { Background, Controls, Edge, Node, Position } from "reactflow";
import "reactflow/dist/style.css";
import type { WorkflowGraph } from "../types/chainreact";

const TYPE_COLOR: Record<string, string> = {
  start: "#22223b",
  end: "#22223b",
  agent: "#5b3df0",
  tool: "#0f9d58",
  human_approval: "#d97706",
};

function layout(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  // Simple longest-path layered layout: BFS depth from 'start' determines the column (x),
  // and sibling order at that depth determines the row (y). Good enough for Phase 1 --
  // a dedicated layout library (dagre/elk) can replace this in a later phase.
  const depth = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  graph.nodes.forEach((n) => adjacency.set(n.id, []));
  graph.edges.forEach((e) => adjacency.get(e.source)?.push(e.target));

  const startNode = graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0];
  const queue: string[] = [startNode.id];
  depth.set(startNode.id, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!depth.has(next) || depth.get(next)! < d + 1) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  const columnCounts = new Map<number, number>();
  const nodes: Node[] = graph.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const row = columnCounts.get(d) ?? 0;
    columnCounts.set(d, row + 1);

    return {
      id: n.id,
      position: { x: d * 240, y: row * 110 },
      data: { label: n.label ?? n.agent ?? n.tool ?? n.id },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        border: `2px solid ${TYPE_COLOR[n.type] ?? "#999"}`,
        borderRadius: 10,
        padding: 8,
        fontSize: 12,
        background: "#fff",
        width: 190,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.condition ?? undefined,
    animated: !!e.condition,
    style: { stroke: "#999" },
    labelStyle: { fontSize: 11, fill: "#8a6d00" },
  }));

  return { nodes, edges };
}

export default function WorkflowVisualizer({ graph }: { graph: WorkflowGraph }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);

  return (
    <div>
      <h3 style={{ margin: "0 0 8px 0" }}>Workflow</h3>
      <div style={{ height: 420, border: "1px solid #e2e2ea", borderRadius: 10, background: "#fafafe" }}>
        <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#555" }}>
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
