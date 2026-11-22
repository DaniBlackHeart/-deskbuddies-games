import { useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { supabase } from "../lib/supabaseClient";

// A Note for Debbie. Follows the "Debbie A Note for Debbie" design. The note is sent to the
// note-for-debbie Edge Function and stored privately for the team; it is posted nowhere.
// Sending a note earns nothing. Not built (not designed): attachments, seeing earlier notes,
// status updates, and an anonymous option.

type Kind = "idea" | "broke" | "liked" | "else";
const KINDS: { key: Kind; label: string; ph: string; name: string }[] = [
  { key: "idea", label: "A suggestion", ph: "What would make Debbie better for you?", name: "a suggestion" },
  { key: "broke", label: "Something broke", ph: "What were you doing, and what happened instead?", name: "a problem report" },
  { key: "liked", label: "Something I like", ph: "What made your day better?", name: "a kind word" },
  { key: "else", label: "Something else", ph: "Tell us what is on your mind.", name: "a note" },
];
const PAGES = [
  "Home", "The Common Room", "Desk Time", "Reality Break", "My Desk", "Desk Finds",
  "Beyond the Desk", "Buddybook", "Buddy Calendar", "Keep the Desk Lit", "Settings",
];
const MAX = 1000;

export default function NoteForDebbiePage() {
  const [kind, setKind] = useState<Kind>("idea");
  const [page, setPage] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [reply, setReply] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ name: string; page: string | null; reply: boolean } | null>(null);

  const k = KINDS.find((x) => x.key === kind) ?? KINDS[0];

  const send = async () => {
    if (busy) return;
    if (text.trim().length < 3) {
      setMsg("Write a few words first, then send.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("note-for-debbie", {
        body: { action: "send", kind, page, body: text, reply_ok: reply },
      });
      if (error) throw error;
      const status = (data as { status?: string })?.status;
      if (status === "ok") {
        setSent({ name: k.name, page, reply });
        setText("");
      } else if (status === "limit") {
        setMsg("That’s a lot of notes for one day. Please try again tomorrow. Your words are still here.");
      } else if (status === "empty") {
        setMsg("Write a few words first, then send.");
      } else {
        setMsg("That didn’t go through. Please try again. Your words are still here.");
      }
    } catch {
      console.error("Note could not be sent");
      setMsg("That didn’t go through. Please try again. Your words are still here.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page nfd-page" id="note-for-debbie">
        <div className="nfd-head">
          <div className="nfd-eyebrow">JUST FOR YOU</div>
          <h1 className="t-h1" style={{ margin: 0 }}>A Note for Debbie</h1>
          <p className="text-muted t-subtitle" style={{ margin: "4px 0 0" }}>Suggestions, feedback, or something broken?</p>
        </div>

        {sent ? (
          <section className="nfd-card" aria-labelledby="nfd-done">
            <h2 className="nfd-h2" id="nfd-done">Thank you, your note is sent</h2>
            <p className="text-muted t-body" role="status" style={{ margin: 0 }}>
              Your {sent.name}{sent.page ? ` about ${sent.page}` : ""} is with the team.{" "}
              {sent.reply ? "If we reply, it will be on Discord." : "We will not reply to this one."}
            </p>
            <div className="nfd-row">
              <button type="button" className="nfd-btn nfd-btn--primary" onClick={() => { setSent(null); setMsg(""); }}>Write another note</button>
              <Link className="nfd-btn" to="/">Back to Home</Link>
            </div>
          </section>
        ) : (
          <form className="nfd-card" aria-label="Write a note" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div role="radiogroup" aria-label="What kind of note" className="nfd-group">
              <span className="nfd-label">What kind of note is it?</span>
              <div className="nfd-row">
                {KINDS.map((x) => (
                  <button key={x.key} type="button" role="radio" aria-checked={kind === x.key} className={"nfd-chip" + (kind === x.key ? " nfd-chip--on" : "")} onClick={() => setKind(x.key)}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>

            <div role="group" aria-label="Which page is it about" className="nfd-group">
              <span className="nfd-label">Which page is it about? <span className="nfd-opt">(optional)</span></span>
              <div className="nfd-row">
                {PAGES.map((p) => (
                  <button key={p} type="button" aria-pressed={page === p} className={"nfd-chip nfd-chip--sm" + (page === p ? " nfd-chip--on" : "")} onClick={() => setPage(page === p ? null : p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="nfd-group">
              <label htmlFor="nfd-msg" className="nfd-label">Your note</label>
              <textarea
                id="nfd-msg"
                className="nfd-text"
                rows={6}
                maxLength={MAX}
                placeholder={k.ph}
                value={text}
                aria-describedby="nfd-help"
                aria-invalid={!!msg && text.trim().length < 3}
                onChange={(e) => { setText(e.target.value); if (msg) setMsg(""); }}
              />
              <div className="nfd-row nfd-between">
                <span id="nfd-help" role="status" className={msg ? "nfd-msg" : "nfd-msg nfd-msg--empty"}>{msg}</span>
                <span className="nfd-count">{text.length} / {MAX}</span>
              </div>
            </div>

            <button type="button" role="switch" aria-checked={reply} className="nfd-switch" onClick={() => setReply(!reply)}>
              <span className="nfd-switch__text">
                <span className="nfd-switch__title">It’s okay to reply to me on Discord</span>
                <span className="nfd-small text-muted">We may not reply to every note.</span>
              </span>
              <span className={"nfd-track" + (reply ? " nfd-track--on" : "")} aria-hidden="true"><span className="nfd-knob" /></span>
              <span className="nfd-state" aria-hidden="true">{reply ? "On" : "Off"}</span>
            </button>

            <div className="nfd-privacy">
              <PixelIcon name="note-for-debbie" size={16} />
              <span>Only the DeskBuddies team reads your note. It is not posted in the Common Room or Discord.</span>
            </div>

            <div>
              <button type="submit" className="nfd-btn nfd-btn--primary" aria-disabled={busy}>
                {busy ? "Sending…" : "Send my note"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
