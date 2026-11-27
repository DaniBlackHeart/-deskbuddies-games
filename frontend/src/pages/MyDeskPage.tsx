import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { BuddyCollectionCard, DeskFindsCard, DeskTimeCard } from "../components/MyDeskAroundCards";
import { MyStickiesCard } from "../components/DeskStickies";
import DeskScene from "../components/DeskScene";
import { WARDROBE_BUDDIES } from "../lib/wardrobeArt";
import { useMyDesk } from "../lib/useMyDesk";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_HINT, BUDDIES, MAX_COMPANIONS, DECOR_SLOTS, DECOR_ITEMS, WARDROBE_ITEMS,
  itemName, buddyName, decorName, type Layout, type Slot, type DecorSlot,
} from "../lib/deskCatalog";

// My Desk: look at your desk, decorate it, save. Follows the "Debbie My Desk"
// design. Placing an item never costs deskbits, Buddy XP or access. The browser
// only asks for a layout; the desk-save Edge Function checks ownership.

type Spot = Slot | "companions" | "decor" | "wardrobe";
const SPOTS: Spot[] = [...SLOTS, "decor", "companions", "wardrobe"];

function sceneFor(l: Layout): string {
  // Art exists for one buddy at a time; show the first seated one.
  return `/desk/scene-${l.companions[0] ?? "none"}.png`;
}

export default function MyDeskPage() {
  const { saved, loading, loadError, isOwned, ownsFind, save } = useMyDesk();
  const [decorSlot, setDecorSlot] = useState<DecorSlot>("d1");
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
      (draft.companions.slice().sort().join() !== saved.companions.slice().sort().join() ? 1 : 0) +
      DECOR_SLOTS.filter((d) => draft.decor[d] !== saved.decor[d]).length +
      WARDROBE_BUDDIES.filter((b) => (draft.wardrobe[b]?.scarf ?? "") !== (saved.wardrobe[b]?.scarf ?? "")).length
    : 0;

  const startAt = (s: Spot) => () => {
    setDraft({ ...saved, companions: [...saved.companions], decor: { ...saved.decor }, wardrobe: JSON.parse(JSON.stringify(saved.wardrobe)) });
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
  const pickDecor = (key: string) => {
    if (!draft) return;
    if (key === "") {
      setBlocked("");
      setDraft({ ...draft, decor: { ...draft.decor, [decorSlot]: "" } });
      return;
    }
    if (!ownsFind(key)) {
      setBlocked(`You don't have the ${decorName(key).toLowerCase()} yet. You can buy it in Desk Finds, and then it will be here.`);
      return;
    }
    setBlocked("");
    // Each item is owned once, so it can sit in one spot: picking it moves it here.
    const next = { ...draft.decor };
    for (const d of DECOR_SLOTS) if (next[d] === key) next[d] = "";
    next[decorSlot] = key;
    setDraft({ ...draft, decor: next });
  };
  const pickWear = (buddy: string, itemKey: string) => {
    if (!draft) return;
    if (itemKey !== "" && !ownsFind(itemKey)) {
      setBlocked("You don't have the tiny scarf yet. You can buy it in Desk Finds, and then it will be here.");
      return;
    }
    setBlocked("");
    // An item is owned once, so it is worn by one buddy at a time.
    const next: Layout["wardrobe"] = {};
    for (const [b, w] of Object.entries(draft.wardrobe)) {
      if (itemKey !== "" && w.scarf === itemKey) continue;
      next[b] = { ...w };
    }
    if (itemKey !== "") next[buddy] = { ...next[buddy], scarf: itemKey };
    else if (next[buddy]) delete next[buddy].scarf;
    setDraft({ ...draft, wardrobe: next });
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
      setDraft({ ...saved, companions: [...saved.companions], decor: { ...saved.decor }, wardrobe: JSON.parse(JSON.stringify(saved.wardrobe)) });
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
      slot: "decor",
      label: SLOT_LABEL.decor,
      value: DECOR_SLOTS.filter((d) => cur.decor[d]).map((d) => decorName(cur.decor[d])).join(", ") || "Nothing placed yet",
      color: "#F2C766",
    },
    {
      slot: "wardrobe",
      label: SLOT_LABEL.wardrobe,
      value: WARDROBE_BUDDIES.filter((b) => cur.wardrobe[b]?.scarf).map((b) => `${buddyName(b)}: tiny scarf`).join(", ") || "Nothing worn yet",
      color: "#8FA98A",
    },
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
              <DeskScene src={sceneFor(cur)} alt={sceneAlt} decor={cur.decor} buddy={cur.companions[0]} wardrobe={cur.wardrobe} className="md-scene__img" />
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
                <MyStickiesCard />
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
                  ) : spot === "wardrobe" ? (
                    <>
                      {WARDROBE_BUDDIES.map((b) => {
                        const found = isOwned("companions", b);
                        const worn = cur.wardrobe[b]?.scarf === "tiny_scarf";
                        return (
                          <div key={b} style={{ gridColumn: "1 / -1", display: "grid", gap: 10 }}>
                            <strong className="t-body">{buddyName(b)}</strong>
                            {!found && <p className="text-muted t-body-sm" style={{ margin: 0 }}>{buddyName(b)} hasn't been found yet. Find them first, then dress them here.</p>}
                            {found && !cur.companions.includes(b) && <p className="text-muted t-body-sm" style={{ margin: 0 }}>{buddyName(b)} isn't on your desk right now. They still keep what they wear, and you will see it when they sit there.</p>}
                            {found && cur.companions.length > 0 && cur.companions[0] !== b && cur.companions.includes(b) && <p className="text-muted t-body-sm" style={{ margin: 0 }}>The desk picture shows one buddy at a time, so {buddyName(b)}'s outfit shows when they are the first on your desk.</p>}
                            {found && (
                              <>
                                <Tile on={!worn} own name="No scarf" state={!worn ? "Chosen" : "Take it off"} color="#F3E6D2" onPick={() => pickWear(b, "")} />
                                {WARDROBE_ITEMS.filter((w) => w.ready).map((w) => (
                                  <Tile
                                    key={w.key}
                                    on={worn}
                                    own={ownsFind(w.key)}
                                    name={w.name}
                                    state={worn ? "Worn" : ownsFind(w.key) ? "Owned" : "Not owned yet"}
                                    color="#8FA98A"
                                    onPick={() => pickWear(b, w.key)}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-muted t-body-sm" style={{ gridColumn: "1 / -1", margin: 0 }}>
                        Party hats, reading glasses and tiny backpacks can't be worn yet. Their fitting isn't done, and other buddies are still being fitted. What you buy stays yours.
                      </p>
                    </>
                  ) : spot === "decor" ? (
                    <>
                      <div role="group" aria-label="Spot on the desk" className="md-chips" style={{ gridColumn: "1 / -1" }}>
                        {DECOR_SLOTS.map((d, i) => (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={decorSlot === d}
                            className={"md-seg" + (decorSlot === d ? " md-seg--on" : "")}
                            onClick={() => { setDecorSlot(d); setBlocked(""); }}
                          >
                            Spot {i + 1}{cur.decor[d] ? " ·" : ""}
                          </button>
                        ))}
                      </div>
                      <Tile
                        on={cur.decor[decorSlot] === ""}
                        own
                        name="Empty spot"
                        state={cur.decor[decorSlot] === "" ? "In this spot" : "Take it off"}
                        color="#F3E6D2"
                        onPick={() => pickDecor("")}
                      />
                      {DECOR_ITEMS.map((it) => {
                        const own = ownsFind(it.key);
                        const at = DECOR_SLOTS.findIndex((d) => cur.decor[d] === it.key);
                        const on = at >= 0 && DECOR_SLOTS[at] === decorSlot;
                        return (
                          <Tile
                            key={it.key}
                            on={on}
                            own={own}
                            name={it.name}
                            state={on ? "In this spot" : at >= 0 ? `In spot ${at + 1}` : own ? "Owned" : "Not owned yet"}
                            color="#F2C766"
                            onPick={() => pickDecor(it.key)}
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
