import { ReactNode, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

// ChainReact UI primitives. Thin wrappers over the design-system classes in
// styles.css -- prefer these over hand-rolled inline styles so every page
// shares one visual language and both themes work automatically.

type ButtonVariant = "default" | "primary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
}

export function Button({
  variant = "default",
  size = "md",
  icon,
  iconRight,
  loading,
  iconOnly,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    variant !== "default" ? `btn-${variant}` : "",
    size !== "md" ? `btn-${size}` : "",
    iconOnly ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export function Card({
  children,
  className = "",
  padded = false,
  interactive = false,
  variant,
  onClick,
  style,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  interactive?: boolean;
  variant?: "muted" | "accent";
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const cls = [
    "card",
    padded ? "card-pad" : "",
    interactive ? "card-interactive" : "",
    variant ? `card-${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      onClick={onClick}
      style={style}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive && onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card-header">
      <div className="row gap-3" style={{ minWidth: 0 }}>
        {icon && <span className="text-secondary row">{icon}</span>}
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h3>{title}</h3>
          {description && <span className="text-sm text-tertiary">{description}</span>}
        </div>
      </div>
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  );
}

export type Tone = "neutral" | "accent" | "cyan" | "success" | "warning" | "danger" | "outline";

export function Badge({ tone = "neutral", children, dot, pulse, square, title }: { tone?: Tone; children: ReactNode; dot?: boolean; pulse?: boolean; square?: boolean; title?: string }) {
  const cls = ["badge", tone !== "neutral" ? `badge-${tone}` : "", square ? "badge-square" : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} title={title}>
      {dot && <span className={`dot ${pulse ? "dot-pulse" : ""}`} />}
      {children}
    </span>
  );
}

export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="chip" title={title}>
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row gap-2 wrap">{actions}</div>}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[] }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? "is-active" : ""}`} onClick={() => onChange(t.id)}>
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tooltip({ content, children, side = "top", wide }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "right"; wide?: boolean }) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span role="tooltip" className={`tooltip is-${side} ${wide ? "is-wide" : ""}`}>
        {content}
      </span>
    </span>
  );
}

export function Disclosure({ title, icon, meta, defaultOpen = false, children }: { title: ReactNode; icon?: ReactNode; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disclosure ${open ? "is-open" : ""}`}>
      <button type="button" className="disclosure-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon && <span className="text-secondary row">{icon}</span>}
        <span>{title}</span>
        {meta && <span className="text-sm text-tertiary" style={{ fontWeight: 400 }}>{meta}</span>}
        <ChevronDown size={16} className="chevron" />
      </button>
      {open && <div className="disclosure-content">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, foot, loading }: { label: ReactNode; value: ReactNode; icon?: ReactNode; foot?: ReactNode; loading?: boolean }) {
  return (
    <div className="card stat">
      <span className="stat-label">
        {icon}
        {label}
      </span>
      {loading ? <Skeleton width={56} height={26} /> : <span className="stat-value">{value}</span>}
      {foot && <span className="stat-foot">{foot}</span>}
    </div>
  );
}

export function CodeBlock({ children, maxHeight }: { children: ReactNode; maxHeight?: number }) {
  return (
    <pre className="code-block" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </pre>
  );
}
