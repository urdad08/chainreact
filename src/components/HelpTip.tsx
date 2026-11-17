import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * A small help icon that shows a plain-language explanation on click (and
 * hover, on devices that support it). Click-to-toggle rather than
 * hover-only so it also works on touchscreens, and closes on an outside
 * click so it doesn't linger in the way.
 */
export default function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="cr-help" ref={ref}>
      <button
        type="button"
        aria-label="What does this mean?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          background: "transparent",
          color: open ? "var(--accent)" : "var(--text-tertiary)",
          cursor: "help",
          borderRadius: "var(--r-full)",
        }}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div className="cr-help-popover" role="tooltip" style={{ top: 20 }}>
          {text}
        </div>
      )}
    </span>
  );
}
