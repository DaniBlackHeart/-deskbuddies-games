import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import AvatarArt from "../components/AvatarArt";
import {
  AVATAR_SLOTS, DEFAULT_AVATAR, HAIR_COLORS, PARTS, SKIN, SLOT_LABEL, SLOT_NOTE,
  describeAvatar, findPart, isOwned, type AvatarParts, type AvatarSlot, type Part,
} from "../lib/avatarCatalog";
import { useMemberProgress } from "../lib/useMemberProgress";
import { useMyAvatar } from "../lib/useMyAvatar";

// My Avatar. Follows the "Debbie My Avatar" design: a small, safe dress-up. You change one part
// at a time and watch the preview; nothing is saved until you press Save.
// - Only chosen parts, no uploads and no free text, so there is nothing to moderate.
// - The server decides ownership. Today only starter parts are owned by everyone; nothing grants
//   shop, earned or supporter parts yet, so those can be tried on but not saved. No purchase
//   happens on this page. Which parts Desk Finds will sell is not decided.
// - Part names, prices and the art are placeholders. "Features" word choices are draft words.

const TRY_SLOTS: Exclude<AvatarSlot, "skin" | "hairc">[] = ["face", "hair", "top", "head", "eyes", "acc", "back", "frame", "plate"];

interface Opt {
  key: string;
  name: string;
  sub: string;
  owned: boolean;
  hidden: boolean; // earned / supporter part the member does not have: shown as a shape only
  hint?: string;
  swatch?: string;
  thumb?: { parts: AvatarParts; silhouette: boolean };
}

export default function MyAvatarPage() {
  const { saved, ownedKeys, failed, reload, save } = useMyAvatar();
  const { deskbits } = useMemberProgress();
  const [draft, setDraft] = useState<AvatarParts | null>(null);
  const [tab, setTab] = useState<AvatarSlot>("skin");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (saved && !draft) setDraft(saved); }, [saved, draft]);

  const header = (
    <>
      <AppHeader />
    </>
  );

  if (failed) {
    return (
      <div className="app-shell">
        {header}
        <main className="container db-page av-page" id="my-avatar">
          <Link className="av-back" to="/profile">‹ Back to your Profile</Link>
          <section className="av-card" role="alert">
            <h1 className="av-h2">We couldn’t load your avatar</h1>
            <p className="text-muted" style={{ margin: 0 }}>Nothing is lost. Please try again in a moment.</p>
            <div><button type="button" className="av-btn av-btn--primary" onClick={() => void reload()}>Try again</button></div>
          </section>
        </main>
      </div>
    );
  }

  if (!saved || !draft) {
    return (
      <div className="app-shell">
        {header}
        <main className="container db-page av-page" id="my-avatar">
          <Link className="av-back" to="/profile">‹ Back to your Profile</Link>
          <p className="text-muted" role="status" style={{ margin: 0 }}>Loading your avatar…</p>
        </main>
      </div>
    );
  }

  const same = AVATAR_SLOTS.every((s) => draft[s] === saved[s]);
  const tryList: Part[] = TRY_SLOTS.map((s) => ({ slot: s, p: findPart(s, draft[s]) }))
    .filter((x) => !isOwned(x.slot, draft[x.slot], ownedKeys))
    .map((x) => x.p);
  const tr = tryList[0];
  const blocked = same || tryList.length > 0 || saving;
  const plate = findPart("plate", draft.plate);

  const tryText = tr
    ? `${tr.name} is ${
        tr.kind === "shop" ? `a shop part. Sample price: ${tr.price} deskbits, and you have ${deskbits}.` : tr.kind === "supp" ? "a supporter cosmetic." : "earned through play."
      }${tryList.length > 1 ? ` ${tryList.length - 1} more part${tryList.length > 2 ? "s" : ""} below ${tryList.length > 2 ? "are" : "is"} in the same spot.` : ""} You can save once every part is yours.`
    : "";

  const setPart = (slot: AvatarSlot, id: string) => { setDraft({ ...draft, [slot]: id }); setMsg(""); };

  let opts: Opt[];
  if (tab === "skin") {
    opts = SKIN.map((s) => ({ key: s.id, name: s.name, sub: "Starter", owned: true, hidden: false, swatch: s.main }));
  } else if (tab === "hairc") {
    opts = HAIR_COLORS.map((h) => ({ key: h.id, name: h.name, sub: "Starter", owned: true, hidden: false, swatch: h.color }));
  } else {
    opts = PARTS[tab].map((p) => {
      const own = isOwned(tab, p.id, ownedKeys);
      const hidden = !own && (p.kind === "earned" || p.kind === "supp");
      const sub = p.kind === "free" ? "Starter" : own ? "Yours" : p.kind === "shop" ? `${deskbits} of ${p.price} deskbits` : (p.hint ?? "");
      const thumbParts = hidden ? { ...draft, [tab]: "none" } : { ...draft, [tab]: p.id };
      return { key: p.id, name: hidden ? "Not yet earned" : p.name, sub, owned: own, hidden, hint: p.hint, thumb: { parts: thumbParts as AvatarParts, silhouette: hidden } };
    });
  }

  const doSave = async () => {
    if (tr) { setMsg("Swap out the parts you are only trying on, then save."); return; }
    if (same) { setMsg("No changes to save yet."); return; }
    setSaving(true);
    const r = await save(draft);
    setSaving(false);
    setMsg(r === "ok" ? "Saved. Other members will see your new look." : r === "not_owned" ? "Some of those parts aren’t yours yet, so nothing was saved." : "That didn’t go through. Please try again.");
  };

  return (
    <div className="app-shell">
      {header}
      <main className="container db-page av-page" id="my-avatar">
        <Link className="av-back" to="/profile">‹ Back to your Profile</Link>
        <div className="av-head">
          <div className="av-eyebrow">MY AVATAR</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Make it look like you</h1>
          <p className="text-muted" style={{ margin: "4px 0 0" }}>Pick a look. Nothing changes until you press Save.</p>
        </div>

        <section className="av-who" aria-labelledby="av-who">
          <h2 id="av-who" className="av-who__h">Who can see your avatar</h2>
          <p style={{ margin: 0 }}>Other signed-in members can see it. It is not public on the internet. It is separate from your Discord photo, which does not change.</p>
        </section>

        <div className="av-grid">
          <section className="av-card av-preview" aria-labelledby="av-pv">
            <h2 id="av-pv" className="av-h2">Your avatar</h2>
            <div className="av-big" role="img" aria-label={describeAvatar(draft)}>
              <AvatarArt parts={draft} size={256} />
            </div>
            {draft.plate !== "none" && <p className="av-plate">{plate.name}</p>}
            <p role="status" className="av-desc">{describeAvatar(draft)}</p>
            <div className="av-sizes">
              <div className="av-size"><AvatarArt parts={draft} size={32} className="av-crop av-crop--s" /><span className="text-muted av-small">Small</span></div>
              <div className="av-size"><AvatarArt parts={draft} size={64} className="av-crop av-crop--m" /><span className="text-muted av-small">Medium</span></div>
              <span className="text-muted av-small av-sizes__note">How it looks beside your name in Home and the Common Room.</span>
            </div>

            {tr && (
              <div className="av-try">
                <p className="av-try__h">Trying on, not yet yours</p>
                <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>{tryText}</p>
                <Link className="av-link" to="/desk-finds">Look in Desk Finds</Link>
              </div>
            )}

            <p role="status" className="av-msg">{msg}</p>
            <div className="av-actions">
              <button type="button" className="av-btn av-btn--primary" aria-disabled={blocked} onClick={() => { if (!saving) void doSave(); }}>Save changes</button>
              <button type="button" className="av-btn" onClick={() => { setDraft(saved); setMsg("Changes dropped. Your saved look is back."); }}>Cancel</button>
              <button type="button" className="av-btn" onClick={() => { setDraft({ ...DEFAULT_AVATAR }); setMsg("Starter look loaded. Press Save to keep it."); }}>Starter look</button>
            </div>
          </section>

          <section className="av-card" aria-labelledby="av-ed">
            <h2 id="av-ed" className="av-h2">Change a part</h2>
            <div role="radiogroup" aria-label="Part to change" className="av-tabs">
              {AVATAR_SLOTS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={tab === s} className={"av-chip" + (tab === s ? " av-chip--on" : "")} onClick={() => { setTab(s); setMsg(""); }}>
                  {SLOT_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>{SLOT_NOTE[tab]}</p>
            <ul className="av-opts">
              {opts.map((o) => {
                const on = draft[tab] === o.key;
                return (
                  <li key={o.key} style={{ display: "flex" }}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${o.name}, ${o.sub}${on ? ", selected" : ""}`}
                      className={"av-opt" + (on ? " av-opt--on" : "") + (o.owned ? "" : " av-opt--locked")}
                      onClick={() => { if (o.hidden) setMsg(`Not yet earned. ${o.hint ?? ""}.`); else setPart(tab, o.key); }}
                    >
                      {o.swatch ? <span aria-hidden="true" className="av-swatch" style={{ background: o.swatch }} /> : o.thumb ? <span aria-hidden="true" className="av-thumb"><AvatarArt parts={o.thumb.parts} size={64} silhouette={o.thumb.silhouette} /></span> : null}
                      <span className={"av-opt__name" + (o.hidden ? " text-muted" : "")}>{o.name}</span>
                      <span className="text-muted av-opt__sub">{o.sub}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <p className="text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>Part names, prices and the art are placeholders, not final.</p>
      </main>
    </div>
  );
}
