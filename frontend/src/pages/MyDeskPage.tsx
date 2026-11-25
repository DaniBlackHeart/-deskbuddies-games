import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { BuddyCollectionCard, DeskFindsCard, DeskStickiesCard, DeskTimeCard } from "../components/MyDeskAroundCards";
import { useMyDesk } from "../lib/useMyDesk";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_HINT, BUDDIES, MAX_COMPANIONS,
  itemName, buddyName, type Layout, type Slot,
} from "../lib/deskCatalog";

// My Desk: look at your desk, decorate it, save. Follows the "Debbie My Desk"
// design. Placing an item never costs deskbits, Buddy XP or access. The browser
// only asks for a layout; the desk-save Edge Function checks ownership.

type Spot = Slot | "companions";
const SPOTS: Spot[] = [...SLOTS, "companions"];

function sceneFor(l: Layout): string {
  // Art exists for one buddy at a time; show the first seated one.
  return `/desk/scene-${l.companions[0] ?? "none"}.png`;
}

export default function MyDeskPage() {
  const { saved, loading, loadError, isOwned, save } = useMyDesk();
  const [draft, setDraft] = useState<Layout | null>(null);
  const [spot, setSpot] = useState<Spot>("companions");
  const [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState("");
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useSearchParams();

  const decorating = draft !== null;
  const cur: Layout = draft ?? saved;
  const changes = draft
    ? SLOTS.filter((s) => draft[s] !== saved[s]).length +
      (draft.companions.slice().sort().join() !== saved.companions.slice().sort().join() ? 1 : 0)
    : 0;

  const startAt = (s: Spot) => () => {
    setDraft({ ...saved, companions: [...saved.companions] });
    setSpot(s);
    setNotice("");
    setBlocked("");
  };
  const cancel = () => {
    setDraft(null);
    setBlocked("");
  };
  const doSave = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await save(draft);
    setSaving(false);
    if (res.ok) {
      setDraft(null);
      setBlocked("");
      setNotice("Saved. Your desk will look like this next time you visit.");
    } else {
      setBlocked(res.message);
    }
  };

  const pickSlotItem = (slot: Slot, id: string) => {
    if (!draft) return;
    if (!isOwned(slot, id)) {
      setBlocked(
        `Can't place ${itemName(slot, id)}: it isn't in My Stuff yet. It unlocks through a milestone or a Challenge reward, and only then can it go on your desk.`,
      );
      return;
    }
    setBlocked("");
    setDraft({ ...draft, [slot]: id });
  };
  const pickBuddy = (id: string | "none") => {
    if (!draft) return;
    if (id === "none") {
      setBlocked("");
      setDraft({ ...draft, companions: [] });
      return;
    }
    if (!isOwned("companions", id)) {
      setBlocked(
        "Can't place this buddy yet: it hasn't been found. Buddies are found through milestones and the shop, and only then can they go on your desk.",
      );
      return;
    }
    const has = draft.companions.includes(id);
    if (!has && draft.companions.length >= MAX_COMPANIONS) {
      setBlocked(`Your desk has room for ${MAX_COMPANIONS} buddies for now. Take one off to seat another.`);
      return;
    }
    setBlocked("");
    setDraft({
      ...draft,
      companions: has ? draft.companions.filter((c) => c !== id) : [...draft.companions, id],
    });
  };

  // Home's "Decorate" button arrives here with ?decorate=1 and opens Decorate straight away.
  useEffect(() => {
    if (!loading && !loadError && params.get("decorate") === "1") {
      setDraft({ ...saved, companions: [...saved.companions] });
      setSpot("companions");
      setParams({}, { replace: true });
    }
  }, [loading, loadError, params, saved, setParams]);

  const names = cur.companions.map(buddyName);
  const companionLine =
    names.length > 1
      ? `${names.join(" and ")} are keeping your seat.`
      : names.length === 1
        ? `${names[0]} is keeping your seat.`
        : "Your companion spot is waiting for your first buddy.";
  const sceneAlt =
    names.length > 1
      ? "Your desk with several buddies seated. This picture shows only one."
      : names.length === 1
        ? `Your desk with ${names[0]} on the companion mat`
        : "Your desk with an empty spot for a companion";

  const swatch = (c: string) => <span aria-hidden="true" className="md-swatch" style={{ background: c }} />;

  const rows: { slot: Spot; label: string; value: string; color: string }[] = [
    ...SLOTS.map((s) => {
      const it = ITEMS[s].find((i) => i.id === cur[s]) ?? ITEMS[s][0];
      return { slot: s as Spot, label: SLOT_LABEL[s], value: it.name, color: it.swatch };
    }),
    {
      slot: "companions",
      label: SLOT_LABEL.companions,
      value: names.length ? names.join(", ") : "Empty spot",
      color: "#FBF3E3",
    },
  ];

  if (loading) {
    return (
      <div className="app-shell">
        <AppHeader />
        <div className="container db-page">
          <h1 className="t-h1">My Desk</h1>
          <p className="text-muted t-body" role="status">Setting up your desk…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page md-page" id="my-desk">
        <div className="md-head">
          <div>
            <h1 className="t-h1">My Desk</h1>
            <p className="text-muted t-body">Your own little corner of DeskBuddies. Arrange it however feels like yours.</p>
          </div>
          <div className="md-views">
            <div role="group" aria-label="Change View" className="md-views__row">
              <button type="button" aria-pressed="true" className="md-seg md-seg--on">Desktop</button>
              <button type="button" aria-disabled="true" aria-label="Workspace, locked" className="md-seg md-seg--locked">🔒 Workspace</button>
              <button type="button" aria-disabled="true" aria-label="Room, locked" className="md-seg md-seg--locked">🔒 Room</button>
            </div>
            <span className="text-muted t-body-sm">More views unlock as your Buddy Collection grows. Requirements are still provisional.</span>
          </div>
        </div>

        {loadError && (
          <p className="md-blocked" role="alert">
            Couldn't load your saved desk, so you're seeing the starter desk. Refresh to try again. Saving is turned off until it loads.
          </p>
        )}

        <div role="status" aria-live="polite">
          {notice && <div className="md-notice">✓ {notice}</div>}
        </div>

        <div className="md-grid">
          <div className={"md-left" + (decorating ? " md-left--dec" : "")}>
          <section className="card md-stage" aria-labelledby="md-stage-h">
            <h2 id="md-stage-h" className="sr-only">Your desk</h2>
            {decorating && (
              <div className="md-decorating">
                <strong>Decorating</strong>
                <span className="text-muted t-body-sm">Nothing changes until you press Save.</span>
              </div>
            )}
            <div className="md-scene">
              <img src={sceneFor(cur)} alt={sceneAlt} width={160} height={112} className="md-scene__img" />
            </div>
            <div className="md-stage__bar">
              <div className="md-stage__text">
                <strong>Desktop view</strong>
                <span className="text-muted">{companionLine}</span>
              </div>
              <div className="md-actions">
                {!decorating ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={startAt("companions")} disabled={loadError}>
                      Decorate
                    </button>
                    <Link to="/my-desk/visitor-preview" className="btn btn-secondary">
                      See how visitors see it
                    </Link>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-primary" onClick={doSave} disabled={changes === 0 || saving || loadError}>
                      {saving ? "Saving…" : changes > 0 ? `Save changes (${changes})` : "Save changes"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={cancel} disabled={saving}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-muted t-body-sm">
              Placeholder art: only the companion spot redraws, and it can show one buddy. Item names are placeholders.
            </p>
          </section>
          {!decorating && (
              <section className="card" aria-labelledby="md-on-h">
                <h2 id="md-on-h" className="md-h2">On your desk</h2>
                <p className="text-muted t-body-sm">Everything here came with your desk or is yours.</p>
                <ul className="md-list">
                  {rows.map((r) => (
                    <li key={r.slot} className="md-list__row">
                      {swatch(r.color)}
                      <span className="md-list__text">
                        <span className="text-muted t-body-sm">{r.label}</span>
                        <strong>{r.value}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Change ${r.label.toLowerCase()}`}
                        onClick={startAt(r.slot)}
                        disabled={loadError}
                      >
                        Change
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
          )}
          </div>

          <div className="md-side">
            {!decorating ? (
              <>
                <h2 className="md-around">Around your desk</h2>
                <DeskTimeCard />
                <DeskFindsCard />
                <BuddyCollectionCard />
                <DeskStickiesCard />
              </>
            ) : (
              <section className="card" aria-labelledby="md-dec-h">
                <h2 id="md-dec-h" className="md-h2">Decorate</h2>
                <p className="text-muted t-body-sm">Pick a spot, then pick something from My Stuff.</p>
                <div role="group" aria-label="Spot to decorate" className="md-chips">
                  {SPOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={spot === s}
                      className={"md-seg" + (spot === s ? " md-seg--on" : "")}
                      onClick={() => {
                        setSpot(s);
                        setBlocked("");
                      }}
                    >
                      {SLOT_LABEL[s]}
                    </button>
                  ))}
                </div>
                <span className="md-eyebrow">MY STUFF · {SLOT_LABEL[spot].toUpperCase()}</span>
                <div className="md-tiles">
                  {spot === "companions" ? (
                    <>
                      <Tile
                        on={cur.companions.length === 0}
                        own
                        name="Empty spot"
                        state={cur.companions.length === 0 ? "On your desk" : "Owned"}
                        color="#F3E6D2"
                        onPick={() => pickBuddy("none")}
                      />
                      {BUDDIES.map((b) => {
                        const own = isOwned("companions", b.id);
                        const on = cur.companions.includes(b.id);
                        return (
                          <Tile
                            key={b.id}
                            on={on}
                            own={own}
                            name={own ? b.name : "Not yet found"}
                            state={on ? "On your desk" : own ? "Owned" : "Locked"}
                            color="#FBF3E3"
                            onPick={() => pickBuddy(b.id)}
                          />
                        );
                      })}
                    </>
                  ) : (
                    ITEMS[spot].map((it) => {
                      const own = isOwned(spot, it.id);
                      const on = cur[spot] === it.id;
                      return (
                        <Tile
                          key={it.id}
                          on={on}
                          own={own}
                          name={it.name + (it.starter ? " · Starter" : "")}
                          state={on ? "On your desk" : own ? "Owned" : "Not owned yet"}
                          color={it.swatch}
                          onPick={() => pickSlotItem(spot, it.id)}
                        />
                      );
                    })
                  )}
                </div>
                <div role="status" aria-live="polite">
                  {blocked && <p className="md-blocked">{blocked}</p>}
                </div>
                <p className="text-muted t-body-sm">{SLOT_HINT[spot]}</p>
                <p className="t-body-sm"><strong>{changes === 0 ? "No changes yet." : `${changes} ${changes === 1 ? "change" : "changes"} not saved.`}</strong></p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Tile(props: { on: boolean; own: boolean; name: string; state: string; color: string; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      className={"md-tile" + (props.on ? " md-tile--on" : "") + (props.own ? "" : " md-tile--locked")}
      onClick={props.onPick}
    >
      <span aria-hidden="true" className="md-swatch" style={{ background: props.color }} />
      <span className="md-tile__text">
        <strong>{props.name}</strong>
        <span>{props.state}</span>
      </span>
    </button>
  );
}
