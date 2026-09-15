import { useState } from "react";
import { sendChatMessage } from "../api/client";

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

const GREETING: ChatTurn = {
  role: "model",
  text: "Hi! Ask me about how ChainReact works, why a check exists, or general questions about AI agents.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "#5b3df0",
          color: "white",
          fontSize: 22,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          zIndex: 1000,
        }}
        aria-label="Open chat"
      >
        💬
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 340,
        maxHeight: 480,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e2e2ea",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        overflow: "hidden",
        zIndex: 1000,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          background: "#5b3df0",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: 14 }}>ChainReact Assistant</strong>
        <button
          onClick={() => setOpen(false)}
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16 }}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "#5b3df0" : "#f2f2f7",
              color: m.role === "user" ? "white" : "#222",
              padding: "8px 12px",
              borderRadius: 12,
              maxWidth: "85%",
              fontSize: 13,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#999", fontSize: 12 }}>Thinking…</div>
        )}
        {error && (
          <div style={{ alignSelf: "flex-start", color: "#c0341d", fontSize: 12 }}>{error}</div>
        )}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", borderTop: "1px solid #eee" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this project or AI agents..."
          style={{
            flex: 1,
            border: "none",
            padding: "10px 12px",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            border: "none",
            background: "transparent",
            color: "#5b3df0",
            fontWeight: 600,
            padding: "0 14px",
            cursor: loading ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
