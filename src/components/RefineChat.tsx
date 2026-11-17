import { useEffect, useRef, useState } from "react";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import HelpTip from "./HelpTip";
import { Button } from "../ui/primitives";

export interface RefineMessage {
  role: "user" | "assistant";
  text: string;
}

const bubble = (role: RefineMessage["role"]): React.CSSProperties => ({
  alignSelf: role === "user" ? "flex-end" : "flex-start",
  maxWidth: "85%",
  background: role === "user" ? "var(--accent-soft)" : "var(--surface-2)",
  border: `1px solid ${role === "user" ? "var(--accent-border)" : "var(--border)"}`,
  color: "var(--text)",
  borderRadius: "var(--r-lg)",
  padding: "8px 12px",
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

export default function RefineChat({
  messages,
  loading,
  onSend,
}: {
  messages: RefineMessage[];
  loading: boolean;
  onSend: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className="text-secondary row">
            <MessagesSquare size={16} />
          </span>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h3 className="row gap-2">
              Refine by chatting
              <HelpTip text="Describe a change in plain English -- e.g. 'also send a Slack message when it's assigned' or 'make the background dark' -- and ChainReact automatically rebuilds with that change applied. No need to retype your original description." />
            </h3>
            <span className="text-sm text-tertiary">Each message is applied automatically.</span>
          </div>
        </div>
      </div>

      <div className="card-body stack gap-3" style={{ paddingTop: "var(--sp-4)" }}>
        {messages.length > 0 && (
          <div ref={listRef} className="stack gap-2" style={{ maxHeight: 320, overflowY: "auto", paddingRight: 2 }}>
            {messages.map((m, i) => (
              <div key={i} style={bubble(m.role)}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="row gap-2 text-secondary" style={{ ...bubble("assistant"), color: "var(--text-secondary)" }} role="status">
                <Loader2 size={13} className="spin" style={{ animation: "spin 0.9s linear infinite" }} />
                Applying your change…
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="row gap-2 wrap">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. also notify #sales on Slack when a lead is assigned"
            disabled={loading}
            style={{ flex: "1 1 240px", width: "auto", minWidth: 0 }}
            aria-label="Describe a change"
          />
          <Button type="submit" variant="primary" loading={loading} disabled={!draft.trim()} icon={!loading ? <Send size={14} /> : undefined}>
            {loading ? "Applying…" : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
