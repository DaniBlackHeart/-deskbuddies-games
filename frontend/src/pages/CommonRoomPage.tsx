import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import {
  KINDS, KIND_BY_KEY, REACTIONS, SAMPLE_POSTS, MAX_POST_LENGTH,
  type KindKey, type ReactionKey, type SamplePost,
} from "../lib/commonRoom";

// The Common Room: the member feed. Follows the "Debbie Common Room" design.
// PLACEHOLDER: posts, kinds and channels are samples held in component state.
// Nothing is saved or sent to Discord, and the "mine" reaction and post state
// vanish on refresh. The real build checks membership, level access and
// duplicate posts on the server (Edge Function); the browser never decides
// which channel a member may post to.

type Filter = "all" | KindKey;

// Member's own access to level-gated channels. Placeholder: all open. Flip an
// entry to false to see the locked state without any other change.
const KIND_ACCESS: Partial<Record<KindKey, boolean>> = {};
const canUseKind = (k: KindKey) => KIND_ACCESS[k] !== false;

export default function CommonRoomPage() {
  const [posts, setPosts] = useState<SamplePost[]>(SAMPLE_POSTS);
  const [filter, setFilter] = useState<Filter>("all");
  const [mine, setMine] = useState<Record<string, boolean>>({}); // `${postId}:${reaction}`
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const openBtnRef = useRef<HTMLButtonElement>(null);

  const shown = posts.filter((p) => filter === "all" || p.kind === filter);

  function toggleReaction(postId: string, r: ReactionKey) {
    const key = postId + ":" + r;
    setMine((m) => {
      const n = { ...m };
      if (n[key]) delete n[key];
      else n[key] = true;
      return n;
    });
  }

  function closeDialog() {
    setOpen(false);
    openBtnRef.current?.focus();
  }

  function submit(kind: KindKey, text: string, photo: boolean) {
    const post: SamplePost = {
      id: "u" + Date.now(),
      name: "You",
      tile: "#F2C766",
      when: "Just now",
      kind,
      text,
      photo,
      counts: { cheer: 0, metoo: 0, cozy: 0, proud: 0 },
      mine: true,
    };
    setPosts((p) => [post, ...p]);
    setFilter("all");
    setOpen(false);
    setNotice(
      "Posted. It is member-visible, and it would appear in " + KIND_BY_KEY[kind].channel + " on Discord and here. (Sample only. Nothing is sent.)",
    );
    openBtnRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page cr-page" id="common-room">
        <div>
          <h1 className="t-h1">The Common Room</h1>
          <p className="text-muted t-subtitle" style={{ margin: 0 }}>
            Small moments from around the community. Share a win, a walk outside, a pet, something you made.
          </p>
        </div>

        <p className="cr-placeholder">
          Placeholder page. The kind names, channel names, sample members and photo boxes are samples. Nothing here is sent to Discord.
        </p>

        <div className="cr-grid">
          <div className="cr-main">
            <section className="cr-share" aria-label="Share something">
              <p className="t-body" style={{ margin: 0, flex: "1 1 240px" }}>
                Got something small to share? A win, a walk, a pet, something you made.
              </p>
              <button ref={openBtnRef} type="button" className="cr-btn cr-btn--primary" onClick={() => { setNotice(""); setOpen(true); }}>
                <PixelIcon name="new-post" size={16} />
                Show Your Buddies
              </button>
            </section>

            <section className="cr-feed" aria-labelledby="cr-feed-h">
              <h2 className="t-h2" id="cr-feed-h" style={{ margin: 0 }}>Around the desk</h2>
              <div role="group" aria-label="Filter by kind" className="cr-chips">
                <button type="button" aria-pressed={filter === "all"} className={"cr-chip" + (filter === "all" ? " cr-chip--on" : "")} onClick={() => { setFilter("all"); setNotice(""); }}>
                  All
                </button>
                {KINDS.map((k) => (
                  <button key={k.key} type="button" aria-pressed={filter === k.key} className={"cr-chip" + (filter === k.key ? " cr-chip--on" : "")} onClick={() => { setFilter(k.key); setNotice(""); }}>
                    <PixelIcon name={k.icon} size={16} />
                    {k.label}
                  </button>
                ))}
              </div>
              <p className="cr-note">
                <PixelIcon name="eye" size={16} />
                <span>Reactions earn nothing. Members can see who reacted.</span>
              </p>

              {notice && !open && (
                <div role="status" className="cr-notice">{notice}</div>
              )}

              {shown.length > 0 ? (
                <div className="cr-posts">
                  {shown.map((p) => {
                    const k = KIND_BY_KEY[p.kind];
                    return (
                      <article key={p.id} className="cr-post">
                        <div className="cr-post__head">
                          <div aria-hidden="true" className="cr-av" style={{ background: p.tile }}>{p.name.charAt(0)}</div>
                          <div className="cr-post__who">
                            <strong>{p.name}</strong>
                            <span className="t-caption text-muted">
                              {p.when}
                              {p.mine ? " · Your post" : ""}
                            </span>
                          </div>
                          <span className="cr-tag">
                            <PixelIcon name={k.icon} size={16} />
                            {k.label}
                          </span>
                        </div>
                        <p className="cr-post__text">{p.text}</p>
                        {p.photo && (
                          <div className="cr-photo" aria-hidden="true">Photo placeholder</div>
                        )}
                        <div role="group" aria-label={"Reactions on " + p.name + "'s post"} className="cr-rx">
                          {REACTIONS.map((r) => {
                            const on = !!mine[p.id + ":" + r.key];
                            return (
                              <button key={r.key} type="button" aria-pressed={on} className={"cr-react" + (on ? " cr-react--on" : "")} onClick={() => toggleReaction(p.id, r.key)}>
                                <PixelIcon name={r.icon} size={16} />
                                <span>{r.label}</span>
                                <span className="text-muted" style={{ fontWeight: 600 }}>{p.counts[r.key] + (on ? 1 : 0)}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="cr-post__foot">
                          <span className="t-caption text-muted">Also in {k.channel} on Discord</span>
                          <button type="button" className="cr-btn cr-btn--quiet" onClick={() => setNotice("This would open the post thread in Discord. (Sample only.)")}>
                            <PixelIcon name="replies" size={16} />
                            Reply in Discord thread
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="cr-empty">
                  {filter === "all"
                    ? "Nothing here yet. Be the first to share something small."
                    : "Nothing under " + KIND_BY_KEY[filter].label + " yet. Be the first."}
                </div>
              )}
            </section>
          </div>

          <aside className="cr-aside" aria-label="How posting works">
            <h2 className="t-h3" style={{ margin: 0 }}>How posting works</h2>
            <ul>
              <li>Each post goes to one Discord channel, so nothing is posted twice.</li>
              <li>Every post also appears here, and you can filter by kind.</li>
              <li>Replies happen in the Discord thread under the post.</li>
              <li>Only members can see posts. They are not public.</li>
              <li>You only see kinds you can post to at your level.</li>
            </ul>
          </aside>
        </div>
      </main>

      {open && <ComposeDialog onClose={closeDialog} onSubmit={submit} />}
    </div>
  );
}

function ComposeDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (k: KindKey, text: string, photo: boolean) => void }) {
  const [kind, setKind] = useState<KindKey | "">("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const sel = kind ? KIND_BY_KEY[kind] : null;
  const canPost = !!sel && text.trim().length > 0;
  const landText = sel
    ? sel.channel === "#common-room"
      ? "Lands in #common-room, tagged " + sel.label + ". Also shown here in the Common Room."
      : "Lands in " + sel.channel + ". Also shown here in the Common Room."
    : "Pick a kind and we will show where it lands.";

  // Modal behaviour: focus moves in, Tab stays inside, Escape closes, and the
  // page behind stops scrolling. Focus returns to the button on close.
  useEffect(() => {
    const el = dialogRef.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea") ?? []);
    focusables()[0]?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function post() {
    if (sending) return; // one click, one post
    if (!sel) return setNotice("Pick a kind first.");
    if (!text.trim()) return setNotice("Write a little something first.");
    setSending(true);
    onSubmit(sel.key, text.trim(), photo);
  }

  return (
    <div className="cr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cr-compose-h" className="cr-dialog">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "var(--space-3)" }}>
          <div>
            <h2 className="t-h1" id="cr-compose-h" style={{ margin: 0 }}>Show Your Buddies</h2>
            <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
              Share a small moment with the community. Only members can see it. It is not on the public internet.
            </p>
          </div>
          <button type="button" className="cr-btn cr-btn--quiet cr-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {notice && <div role="status" className="cr-notice">{notice}</div>}

        <div role="group" aria-label="Kind of post" className="cr-chips">
          {KINDS.map((k) => {
            const locked = k.gated && !canUseKind(k.key);
            const on = kind === k.key;
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={on}
                aria-disabled={locked}
                className={"cr-chip" + (on ? " cr-chip--on" : "") + (locked ? " cr-chip--locked" : "")}
                onClick={() => {
                  if (locked) return setNotice(k.label + " is not open to your level yet, so posts cannot go there.");
                  setKind(k.key);
                  setNotice("");
                }}
              >
                <PixelIcon name={k.icon} size={16} />
                {k.label + (locked ? " (locked)" : "")}
              </button>
            );
          })}
        </div>

        <p className="cr-land" aria-live="polite">
          <PixelIcon name="channel-hash" size={16} />
          <span>{landText}</span>
        </p>
        <p className="cr-note">
          <PixelIcon name="eye" size={16} />
          <span>Members can see this. It is not public.</span>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="cr-text" className="t-body" style={{ fontWeight: 700 }}>What is on your mind?</label>
          <textarea
            id="cr-text"
            rows={4}
            maxLength={MAX_POST_LENGTH}
            value={text}
            placeholder="A little something from your day"
            className="cr-textarea"
            onChange={(e) => setText(e.target.value.slice(0, MAX_POST_LENGTH))}
          />
          <span className="t-caption text-muted" style={{ alignSelf: "flex-end" }}>{text.length} / {MAX_POST_LENGTH}</span>
        </div>

        {photo && <div className="cr-photo cr-photo--sm">Photo placeholder</div>}

        <div className="row-between" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button type="button" className="cr-btn cr-btn--quiet" onClick={() => setPhoto((p) => !p)}>
            <PixelIcon name="add-photo" size={16} />
            {photo ? "Photo added (placeholder). Remove" : "Add a photo (optional)"}
          </button>
          <button type="button" className={"cr-btn cr-btn--primary" + (canPost ? "" : " cr-btn--off")} aria-disabled={!canPost} onClick={post}>
            Post
          </button>
        </div>

        <p className="t-caption text-muted" style={{ margin: 0 }}>
          A post shares what you did. It is not proof, and it does not pay a reward on its own. Rewards and gifts show up in your Desk Log, not here.
        </p>
      </div>
    </div>
  );
}
