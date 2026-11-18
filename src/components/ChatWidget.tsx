import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { ApiError, sendChatMessage } from "../api/client";
import { Button } from "../ui/primitives";

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

const GREETING: ChatTurn = {
  role: "model",
  text: "Hi! I can explain anything on this page in simple terms. Just ask. For example: \"What is an agent?\" or \"What does approval mean?\"",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading, error, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user", text } as ChatTurn];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const reply = await sendChatMessage(next.map((m) => ({ role: m.role, text: m.text })));
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch (err) {
      if (err instanceof ApiError && err.detail.retryable) {
        setError("The AI model is briefly overloaded on Google's side. Try sending that again in a moment.");
      } else {
        setError(err instanceof Error ? err.message : "Chat request failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          height: 40,
          padding: "0 14px",
          borderRadius: "var(--r-lg)",
          background: "var(--surface)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 1000,
        }}
        aria-label="Open chat to ask a question"
      >
        <MessageSquare size={16} style={{ color: "var(--accent)" }} />
        <span>Ask a question</span>
      </button>
    );
  }

  return (
    <div
      className="cr-chat-panel"
      role="dialog"
      aria-label="ChainReact Assistant"
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-xl)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        zIndex: 1000,
        animation: "modal-in var(--dur-slow) var(--ease)",
      }}
    >
      <div className="row gap-2" style={{ padding: "10px 10px 10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <span
          className="row"
          style={{
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: "var(--r-md)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            flexShrink: 0,
          }}
        >
          <Sparkles size={14} />
        </span>
        <div className="stack grow" style={{ lineHeight: 1.2 }}>
          <strong style={{ fontSize: 13.5 }}>ChainReact Assistant</strong>
          <span className="text-xs text-tertiary">Ask about this project or AI agents</span>
        </div>
        <Button variant="ghost" size="sm" iconOnly icon={<X size={15} />} onClick={() => setOpen(false)} aria-label="Close chat" />
      </div>

      <div ref={listRef} className="stack gap-2" style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--accent-soft)" : "var(--surface-2)",
              border: `1px solid ${m.role === "user" ? "var(--accent-border)" : "var(--border)"}`,
              color: "var(--text)",
              padding: "8px 11px",
              borderRadius: "var(--r-lg)",
              maxWidth: "85%",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="row gap-2 text-xs text-tertiary" role="status" style={{ alignSelf: "flex-start" }}>
            <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} />
            Thinking…
          </div>
        )}
        {error && (
          <div role="alert" className="text-xs text-danger" style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="row gap-2" style={{ padding: 10, borderTop: "1px solid var(--border-subtle)" }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Message"
          style={{ flex: 1, width: "auto", minWidth: 0 }}
        />
        <Button type="submit" variant="primary" iconOnly disabled={loading || !input.trim()} icon={<Send size={14} />} aria-label="Send" />
      </form>
    </div>
  );
}
