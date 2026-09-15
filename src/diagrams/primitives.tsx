// Shared SVG building blocks for the UML diagrams. Plain hand-drawn SVG,
// no external diagramming library, so these render standalone with zero
// runtime dependencies and never break on the day of presentation.
import type { ReactNode } from "react";

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

export function Actor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g stroke="#333" fill="none" strokeWidth={1.5}>
      <circle cx={x} cy={y} r={8} />
      <line x1={x} y1={y + 8} x2={x} y2={y + 30} />
      <line x1={x - 14} y1={y + 16} x2={x + 14} y2={y + 16} />
      <line x1={x} y1={y + 30} x2={x - 12} y2={y + 48} />
      <line x1={x} y1={y + 30} x2={x + 12} y2={y + 48} />
      <text x={x} y={y + 62} textAnchor="middle" fontSize={11} fill="#333" stroke="none" fontFamily="system-ui">
        {label}
      </text>
    </g>
  );
}

export function UseCase({ x, y, w = 150, h = 44, label }: { x: number; y: number; w?: number; h?: number; label: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="#f3f0ff" stroke="#5b3df0" strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#222" fontFamily="system-ui">
        {label}
      </text>
    </g>
  );
}

export function UCLink({ x1, y1, x2, y2, dashed }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#999" strokeWidth={1.3}
      strokeDasharray={dashed ? "4 3" : undefined}
    />
  );
}

export function SystemBoundary({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#bbb" strokeWidth={1.2} rx={6} />
      <text x={x + w / 2} y={y - 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="#555" fontFamily="system-ui">
        {label}
      </text>
    </g>
  );
}

export function Lifeline({ x, top, bottom, label }: { x: number; top: number; bottom: number; label: string }) {
  return (
    <g>
      <rect x={x - 55} y={top - 26} width={110} height={26} fill="#eef0ff" stroke="#5b3df0" strokeWidth={1.2} rx={4} />
      <text x={x} y={top - 8} textAnchor="middle" fontSize={11} fontFamily="system-ui" fill="#222">
        {label}
      </text>
      <line x1={x} y1={top} x2={x} y2={bottom} stroke="#bbb" strokeDasharray="3 3" strokeWidth={1} />
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
          d={`M${x1},${y} h30 v18 h-30`}
          fill="none" stroke="#333" strokeWidth={1.3}
          strokeDasharray={dashed ? "4 3" : undefined}
          markerEnd="url(#arrow)"
        />
        <text x={x1 + 6} y={y - 4} fontSize={10} fontFamily="system-ui" fill="#333">{label}</text>
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
      <text
        x={(x1 + x2) / 2} y={y - 5} textAnchor="middle"
        fontSize={10} fontFamily="system-ui" fill="#333"
      >
        {label}
      </text>
    </g>
  );
}

export function UMLClass({
  x, y, w = 190, title, fields = [], methods = [],
}: { x: number; y: number; w?: number; title: string; fields?: string[]; methods?: string[] }) {
  const rowH = 15;
  const headerH = 24;
  const fieldsH = Math.max(fields.length, 1) * rowH + 8;
  const methodsH = Math.max(methods.length, 1) * rowH + 8;
  const totalH = headerH + fieldsH + methodsH;
  return (
    <g fontFamily="system-ui">
      <rect x={x} y={y} width={w} height={totalH} fill="#fff" stroke="#333" strokeWidth={1.2} />
      <rect x={x} y={y} width={w} height={headerH} fill="#5b3df0" />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
        {title}
      </text>
      <line x1={x} y1={y + headerH} x2={x + w} y2={y + headerH} stroke="#333" strokeWidth={1} />
      {fields.map((f, i) => (
        <text key={i} x={x + 8} y={y + headerH + 14 + i * rowH} fontSize={10} fill="#222">
          {f}
        </text>
      ))}
      <line x1={x} y1={y + headerH + fieldsH} x2={x + w} y2={y + headerH + fieldsH} stroke="#333" strokeWidth={1} />
      {methods.map((m, i) => (
        <text key={i} x={x + 8} y={y + headerH + fieldsH + 14 + i * rowH} fontSize={10} fill="#222">
          {m}
        </text>
      ))}
    </g>
  );
}

export function ClassLink({
  x1, y1, x2, y2, label, diamond,
}: { x1: number; y1: number; x2: number; y2: number; label?: string; diamond?: boolean }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth={1.3} />
      {diamond && (
        <polygon
          points={`${x1},${y1} ${x1 - 6},${y1 - 4} ${x1 - 12},${y1} ${x1 - 6},${y1 + 4}`}
          fill="#fff" stroke="#555" strokeWidth={1}
        />
      )}
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize={9} fill="#555" fontFamily="system-ui">
          {label}
        </text>
      )}
    </g>
  );
}

export function DiagramFrame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ background: "#fff", borderRadius: 8 }}>
      {ARROW_MARKER}
      {children}
    </svg>
  );
}
