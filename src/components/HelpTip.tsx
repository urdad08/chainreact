import { useEffect, useRef, useState } from "react";

/**
 * A small "?" badge that shows a plain-language explanation on click (and
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
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <span className="cr-help" ref={ref}>
      <button
        type="button"
        className="cr-help-badge"
        aria-label="What does this mean?"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
      >
        ?
      </button>
      {open && <div className="cr-help-popover">{text}</div>}
    </span>
  );
}
