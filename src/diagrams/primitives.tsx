// Shared SVG building blocks for the UML diagrams. Plain hand-drawn SVG,
// no external diagramming library, so these render standalone with zero
// runtime dependencies and never break on the day of presentation.
//
// Every shape sizes itself from its text (see `textWidth`), and the
// diagram components compute their layout from data, so labels never
// overflow their shapes and nothing collides with the frame edge.
import type { ReactNode } from "react";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Conservative width estimate (px) for a single line of text. */
export function textWidth(text: string, fontSize: number, mono = false) {
  return text.length * fontSize * (mono ? 0.62 : 0.6);
}

/** Split a label on real newlines (or a literal "\n" typed in JSX). */
export function lines(label: string) {
  return label.split(/\n|\\n/);
}

/** Text with a white halo so it stays readable where it crosses lines. */
export function Label({
  x, y, children, anchor = "middle", size = 10, color = "#333", weight, rotate,
}: {
  x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end";
  size?: number; color?: string; weight?: number; rotate?: number;
}) {
  return (
    <text
      x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontWeight={weight} fontFamily={FONT}
      stroke="#fff" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

export const ARROW_MARKER = (
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6 Z" fill="#333" />
    </marker>
    <marker id="arrowOpen" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6" fill="none" stroke="#333" strokeWidth="1" />
    </marker>
  </defs>
);

// ---------------------------------------------------------------- use case

export function Actor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g stroke="#333" fill="none" strokeWidth={1.5}>
      <circle cx={x} cy={y} r={8} />
      <line x1={x} y1={y + 8} x2={x} y2={y + 30} />
      <line x1={x - 14} y1={y + 16} x2={x + 14} y2={y + 16} />
      <line x1={x} y1={y + 30} x2={x - 12} y2={y + 48} />
      <line x1={x} y1={y + 30} x2={x + 12} y2={y + 48} />
      {lines(label).map((l, i) => (
        <text key={i} x={x} y={y + 64 + i * 14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#333" stroke="none" fontFamily={FONT}>
          {l}
        </text>
      ))}
    </g>
  );
}

export const ACTOR_LABEL_WIDTH = (label: string) => Math.max(...lines(label).map((l) => textWidth(l, 11)));

export function UseCase({ x, y, w, h = 40, label }: { x: number; y: number; w: number; h?: number; label: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="#f3f0ff" stroke="#5b3df0" strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#222" fontFamily={FONT}>
        {label}
      </text>
    </g>
  );
}

/** Ellipse width that comfortably contains the label (text spans ~75% of the width at mid-height). */
export const useCaseWidth = (label: string) => Math.max(150, textWidth(label, 11) / 0.78 + 12);

export function UCLink({ x1, y1, x2, y2, dashed }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={dashed ? "#666" : "#999"} strokeWidth={1.3}
      strokeDasharray={dashed ? "4 3" : undefined}
      markerEnd={dashed ? "url(#arrowOpen)" : undefined}
    />
  );
}

export function SystemBoundary({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fcfcfe" stroke="#bbb" strokeWidth={1.2} rx={6} />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill="#555" fontFamily={FONT}>
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------- sequence

export const LIFELINE_HEAD_H = 28;
export const lifelineHeadWidth = (label: string) => Math.max(96, textWidth(label, 11) + 24);

export function Lifeline({ x, top, bottom, label }: { x: number; top: number; bottom: number; label: string }) {
  const w = lifelineHeadWidth(label);
  return (
    <g>
      <line x1={x} y1={top + LIFELINE_HEAD_H} x2={x} y2={bottom} stroke="#bbb" strokeDasharray="3 3" strokeWidth={1} />
      <rect x={x - w / 2} y={top} width={w} height={LIFELINE_HEAD_H} fill="#eef0ff" stroke="#5b3df0" strokeWidth={1.2} rx={4} />
      <text x={x} y={top + 18} textAnchor="middle" fontSize={11} fontFamily={FONT} fill="#222">
        {label}
      </text>
    </g>
  );
}

export function SeqArrow({
  x1, x2, y, label, dashed, selfCall,
}: { x1: number; x2: number; y: number; label: string; dashed?: boolean; selfCall?: boolean }) {
  if (selfCall) {
    return (
      <g>
        <path
          d={`M${x1},${y} h28 v16 h-26`}
          fill="none" stroke="#333" strokeWidth={1.3}
          strokeDasharray={dashed ? "4 3" : undefined}
          markerEnd="url(#arrow)"
        />
        <Label x={x1 + 34} y={y + 12} anchor="start">{label}</Label>
      </g>
    );
  }
  return (
    <g>
      <line
        x1={x1} y1={y} x2={x2} y2={y}
        stroke="#333" strokeWidth={1.3}
        strokeDasharray={dashed ? "4 3" : undefined}
        markerEnd={`url(#${dashed ? "arrowOpen" : "arrow"})`}
      />
      <Label x={(x1 + x2) / 2} y={y - 6}>{label}</Label>
    </g>
  );
}

// ---------------------------------------------------------------- class

const ROW_H = 15;
const HEADER_H = 26;

export function umlClassHeight(fields: string[] = [], methods: string[] = []) {
  const fieldsH = fields.length ? fields.length * ROW_H + 8 : 10;
  const methodsH = methods.length ? methods.length * ROW_H + 8 : 10;
  return HEADER_H + fieldsH + methodsH;
}

export function umlClassWidth(title: string, fields: string[] = [], methods: string[] = []) {
  const body = Math.max(0, ...[...fields, ...methods].map((t) => textWidth(t, 10, true)));
  return Math.ceil(Math.max(textWidth(title, 12) + 24, body + 20));
}

export function UMLClass({
  x, y, w, title, fields = [], methods = [],
}: { x: number; y: number; w?: number; title: string; fields?: string[]; methods?: string[] }) {
  const width = Math.max(w ?? 0, umlClassWidth(title, fields, methods));
  const fieldsH = fields.length ? fields.length * ROW_H + 8 : 10;
  const totalH = umlClassHeight(fields, methods);
  return (
    <g>
      <rect x={x} y={y} width={width} height={totalH} fill="#fff" stroke="#333" strokeWidth={1.2} />
      <rect x={x} y={y} width={width} height={HEADER_H} fill="#5b3df0" stroke="#333" strokeWidth={1.2} />
      <text x={x + width / 2} y={y + 17} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" fontFamily={FONT}>
        {title}
      </text>
      {fields.map((f, i) => (
        <text key={i} x={x + 10} y={y + HEADER_H + 15 + i * ROW_H} fontSize={10} fill="#222" fontFamily={MONO}>
          {f}
        </text>
      ))}
      <line x1={x} y1={y + HEADER_H + fieldsH} x2={x + width} y2={y + HEADER_H + fieldsH} stroke="#333" strokeWidth={1} />
      {methods.map((m, i) => (
        <text key={i} x={x + 10} y={y + HEADER_H + fieldsH + 15 + i * ROW_H} fontSize={10} fill="#222" fontFamily={MONO}>
          {m}
        </text>
      ))}
    </g>
  );
}

/**
 * Orthogonal connector through the given points. `diamond` draws a UML
 * composition diamond at the first point (the owning class); `arrow`
 * draws an open arrowhead at the last point.
 */
export function Wire({
  points, diamond, arrow, dashed,
}: { points: [number, number][]; diamond?: boolean; arrow?: boolean; dashed?: boolean }) {
  const d = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  const [ax, ay] = points[0];
  const [bx, by] = points[1];
  const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  return (
    <g>
      <path
        d={d} fill="none" stroke="#555" strokeWidth={1.3}
        strokeDasharray={dashed ? "5 3" : undefined}
        markerEnd={arrow ? "url(#arrowOpen)" : undefined}
      />
      {diamond && (
        <polygon
          points="0,0 7,-5 14,0 7,5"
          transform={`translate(${ax} ${ay}) rotate(${angle})`}
          fill="#555" stroke="#555" strokeWidth={1}
        />
      )}
    </g>
  );
}

// ---------------------------------------------------------------- frame

export function DiagramFrame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  // On narrow screens, let the diagram scroll sideways at a readable size
  // rather than scaling down until the labels are too small to read; on
  // wide screens, never blow it up past its natural size.
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{
          background: "#fff", borderRadius: 8, display: "block", margin: "0 auto",
          minWidth: Math.min(width, 640), maxWidth: width * 1.15,
        }}
      >
        {ARROW_MARKER}
        {children}
      </svg>
    </div>
  );
}
