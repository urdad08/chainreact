import { useEffect, useState } from "react";
import { AlertCircle, CalendarPlus, CheckCircle2, ExternalLink, Link2, Loader2, Mail, Unplug, Zap } from "lucide-react";
import HelpTip from "./HelpTip";
import {
  ApiError,
  createCalendarEvent,
  disconnectGoogle,
  getGoogleStatus,
  googleConnectUrl,
  labelEmailsFromSender,
} from "../api/client";
import { Badge, Button } from "../ui/primitives";
import type { CalendarEvent, CalendarEventDraft, GmailActionDraft, GmailLabelResult } from "../types/chainreact";

function readUrlFlag(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function clearUrlFlags() {
  const url = new URL(window.location.href);
  url.searchParams.delete("google_connected");
  url.searchParams.delete("google_connect_error");
  window.history.replaceState({}, "", url.toString());
}

function defaultEventTimes(): { start: string; end: string } {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const end = new Date(now.getTime() + 30 * 60 * 1000);
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { start: toLocalInput(now), end: toLocalInput(end) };
}

// Backend sends plain "YYYY-MM-DDTHH:mm:ss" (no timezone) -- a datetime-local
// input just needs the first 16 chars, no Date() round-trip (that would
// reinterpret it through the browser's timezone and shift the hour).
function toDatetimeLocalValue(rfc3339ish: string): string {
  return rfc3339ish.slice(0, 16);
}

function Notice({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`row gap-2 text-sm ${tone === "danger" ? "text-danger" : "text-success"}`}
      style={{ alignItems: "flex-start" }}
    >
      {tone === "danger" ? (
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      ) : (
        <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      )}
      <span style={{ minWidth: 0 }}>{children}</span>
    </p>
  );
}

function SectionTitle({ icon, title, prefilled }: { icon: React.ReactNode; title: string; prefilled: boolean }) {
  return (
    <div className="row gap-2 wrap">
      <span className="text-secondary row">{icon}</span>
      <strong style={{ fontSize: 13.5 }}>{title}</strong>
      {prefilled && (
        <Badge tone="accent" title="Pre-filled from your request -- review, then run">
          Pre-filled from your request
        </Badge>
      )}
    </div>
  );
}

export default function GoogleIntegration({
  showGmail = true,
  showCalendar = true,
  gmailDraft = null,
  calendarDraft = null,
}: {
  showGmail?: boolean;
  showCalendar?: boolean;
  gmailDraft?: GmailActionDraft | null;
  calendarDraft?: CalendarEventDraft | null;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [sender, setSender] = useState(gmailDraft?.sender ?? "");
  const [labelName, setLabelName] = useState(gmailDraft?.label_name ?? "Important");
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailResult, setGmailResult] = useState<GmailLabelResult | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const defaultTimes = defaultEventTimes();
  const [eventSummary, setEventSummary] = useState(calendarDraft?.summary ?? "");
  const [eventStart, setEventStart] = useState(
    calendarDraft ? toDatetimeLocalValue(calendarDraft.start) : defaultTimes.start
  );
  const [eventEnd, setEventEnd] = useState(
    calendarDraft ? toDatetimeLocalValue(calendarDraft.end) : defaultTimes.end
  );
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarResult, setCalendarResult] = useState<CalendarEvent | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Keep the forms in sync when the person regenerates with new text (the
  // component itself stays mounted if the new text still needs this panel),
  // so re-describing the task updates the pre-filled values rather than
  // leaving the previous run's draft sitting in the form.
  useEffect(() => {
    if (gmailDraft) {
      setSender(gmailDraft.sender);
      setLabelName(gmailDraft.label_name);
    }
  }, [gmailDraft]);

  useEffect(() => {
    if (calendarDraft) {
      setEventSummary(calendarDraft.summary);
      setEventStart(toDatetimeLocalValue(calendarDraft.start));
      setEventEnd(toDatetimeLocalValue(calendarDraft.end));
    }
  }, [calendarDraft]);

  async function refreshStatus() {
    try {
      const status = await getGoogleStatus();
      setConnected(status.connected);
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Could not check Google connection status.");
    }
  }

  useEffect(() => {
    if (readUrlFlag("google_connected")) {
      setConnectNotice("Google account connected.");
      clearUrlFlags();
    } else {
      const err = readUrlFlag("google_connect_error");
      if (err) {
        setConnectNotice(`Could not connect Google account: ${err}`);
        clearUrlFlags();
      }
    }
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectGoogle();
      setConnectNotice(null);
      setGmailResult(null);
      setCalendarResult(null);
      await refreshStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleLabelSender(e: React.FormEvent) {
    e.preventDefault();
    setGmailLoading(true);
    setGmailError(null);
    setGmailResult(null);
    try {
      setGmailResult(await labelEmailsFromSender(sender.trim(), labelName.trim()));
    } catch (e) {
      setGmailError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Labeling failed.");
    } finally {
      setGmailLoading(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCalendarLoading(true);
    setCalendarError(null);
    setCalendarResult(null);
    try {
      const toRfc3339 = (local: string) => new Date(local).toISOString();
      setCalendarResult(await createCalendarEvent(eventSummary.trim(), toRfc3339(eventStart), toRfc3339(eventEnd)));
    } catch (e) {
      setCalendarError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Creating event failed.");
    } finally {
      setCalendarLoading(false);
    }
  }

  const scopeLabel = showGmail && showCalendar ? "Gmail & Calendar" : showGmail ? "Gmail" : "Calendar";

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: "wrap" }}>
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className="text-secondary row">
            <Zap size={16} />
          </span>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h3 className="row gap-2">
              Real automation ({scopeLabel})
              <HelpTip text="Unlike the rest of this demo, this is NOT simulated -- it calls your real Gmail/Calendar once you connect your Google account, and genuinely acts on your real email or calendar. Shown because your request mentioned it." />
            </h3>
            <span className="text-sm text-tertiary">
              Connect once, then run on demand — no background polling; you trigger each run yourself.
            </span>
          </div>
        </div>
        {connected === true && (
          <div className="row gap-2">
            <Badge tone="success" dot>
              Connected
            </Badge>
            <Button size="sm" variant="ghost" icon={<Unplug size={13} />} loading={disconnecting} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      <div className="card-body stack gap-4">
        {connectNotice && (
          <Notice tone={connectNotice.startsWith("Could not") ? "danger" : "success"}>{connectNotice}</Notice>
        )}
        {statusError && <Notice tone="danger">{statusError}</Notice>}

        {connected === null && !statusError ? (
          <p className="row gap-2 text-sm text-tertiary" role="status">
            <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite" }} />
            Checking connection status…
          </p>
        ) : connected ? (
          <>
            {showGmail && (
              <form
                onSubmit={handleLabelSender}
                className="stack gap-3"
                style={showCalendar ? { paddingBottom: "var(--sp-4)", borderBottom: "1px solid var(--border-subtle)" } : undefined}
              >
                <SectionTitle icon={<Mail size={14} />} title="Move emails from a sender into a label" prefilled={!!gmailDraft} />
                <div className="grid grid-2" style={{ gap: "var(--sp-3)" }}>
                  <label className="field">
                    <span className="field-label">Sender email</span>
                    <input
                      className="input"
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      placeholder="someone@example.com"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Label name</span>
                    <input
                      className="input"
                      value={labelName}
                      onChange={(e) => setLabelName(e.target.value)}
                      placeholder="Important"
                      required
                    />
                  </label>
                </div>
                <div>
                  <Button type="submit" variant="primary" loading={gmailLoading}>
                    {gmailLoading ? "Running…" : "Run now"}
                  </Button>
                </div>
                {gmailError && <Notice tone="danger">{gmailError}</Notice>}
                {gmailResult && (
                  <Notice tone="success">
                    Found {gmailResult.matched} message(s) from {gmailResult.sender}, labeled {gmailResult.labeled} as "
                    {gmailResult.label_name}".
                  </Notice>
                )}
              </form>
            )}

            {showCalendar && (
              <form onSubmit={handleCreateEvent} className="stack gap-3">
                <SectionTitle icon={<CalendarPlus size={14} />} title="Create a calendar event" prefilled={!!calendarDraft} />
                <label className="field">
                  <span className="field-label">Title</span>
                  <input
                    className="input"
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    placeholder="Sync with team"
                    required
                  />
                </label>
                <div className="grid grid-2" style={{ gap: "var(--sp-3)" }}>
                  <label className="field">
                    <span className="field-label">Start</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">End</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <div>
                  <Button type="submit" variant="primary" loading={calendarLoading}>
                    {calendarLoading ? "Creating…" : "Create event"}
                  </Button>
                </div>
                {calendarError && <Notice tone="danger">{calendarError}</Notice>}
                {calendarResult && (
                  <Notice tone="success">
                    Created "{calendarResult.summary}".{" "}
                    {calendarResult.html_link && (
                      <a
                        href={calendarResult.html_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        Open in Google Calendar <ExternalLink size={12} />
                      </a>
                    )}
                  </Notice>
                )}
              </form>
            )}
          </>
        ) : (
          <div className="row gap-3 wrap">
            <Button
              variant="primary"
              icon={<Link2 size={14} />}
              onClick={() => {
                window.location.href = googleConnectUrl();
              }}
            >
              Connect Google account
            </Button>
            {connected === false && <span className="text-sm text-tertiary">Not connected.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
