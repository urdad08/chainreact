import { useState } from "react";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { Button } from "../ui/primitives";

export default function ClarificationPrompt({
  question,
  loading,
  onAnswer,
}: {
  question: string;
  loading: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = answer.trim();
    if (!text || loading) return;
    onAnswer(text);
    setAnswer("");
  }

  return (
    <div className="card" style={{ borderLeft: "3px solid var(--accent)", padding: "var(--sp-4) var(--sp-5)" }}>
      <div className="stack gap-3">
        <div className="row gap-2 text-accent text-sm" style={{ fontWeight: 600 }}>
          <MessageCircleQuestion size={15} />
          <span>Before I build this, one question</span>
        </div>
        <p style={{ fontSize: "var(--fs-md)", lineHeight: 1.55 }}>{question}</p>
        <form onSubmit={handleSubmit} className="row gap-2 wrap">
          <input
            className="input grow"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
            disabled={loading}
            style={{ flex: "1 1 220px", width: "auto" }}
            autoFocus
            aria-label="Your answer"
          />
          <Button type="submit" variant="primary" loading={loading} disabled={!answer.trim()} iconRight={!loading ? <ArrowRight size={14} /> : undefined}>
            {loading ? "Continuing…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
