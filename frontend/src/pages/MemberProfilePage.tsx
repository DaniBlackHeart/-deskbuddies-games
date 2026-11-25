import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";
import { BUDDIES, buddyName } from "../lib/deskCatalog";

// Another member's profile (opened from Who's around, Find a member and a Buddy Calendar birthday name).
// Everything here comes from the member-profile Edge Function, which decides on the server what a
// visitor may see: a name, the Discord avatar, the MOD badge, the month they joined and the buddies
// keeping their desk seat. Never deskbits, XP, level, streak, stamps, journals, goals or Focus history.
// Desk Stickies (leaving a note on their desk) are later work, so the pin board says so.

type Visited = { id: string; name: string; avatar_url: string | null; is_mod: boolean; since: string; companions: string[] };

export default function MemberProfilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Visited | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setPerson(null);
    setImgFailed(false);
    (async () => {
      const { data, error } = await supabase.functions.invoke("member-profile", { body: { id } });
      if (cancelled) return;
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        setState(status === 404 ? "missing" : "error");
        return;
      }
      setPerson(data as Visited);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = (
    <button type="button" className="page-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
      <span aria-hidden="true">‹</span> Back
    </button>
  );

  if (state !== "ready" || !person) {
    return (
      <div className="app-shell">
        <AppHeader />
        <main className="container db-page vp-page" id="member-profile">
          {back}
          {state === "loading" && <p className="text-muted t-body" role="status">Opening the profile…</p>}
          {state === "missing" && (
            <div className="card" role="status">
              <h1 className="t-h2" style={{ margin: 0 }}>We can’t find this member</h1>
              <p className="text-muted t-body" style={{ margin: "6px 0 0" }}>They may not be on Debbie yet. You can <Link to="/">go back Home</Link> and search again.</p>
            </div>
          )}
          {state === "error" && (
            <div className="card" role="alert">
              <p className="t-body" style={{ margin: 0 }}>Couldn’t open this profile. Check your connection and try again.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const known = person.companions.filter((c) => BUDDIES.some((b) => b.id === c));
  const names = known.map(buddyName);
  const scene = `/desk/scene-${known[0] ?? "none"}.png`;
  const since = new Date(person.since).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container db-page vp-page" id="member-profile">
        {back}
        <section className="card mp-name" aria-labelledby="mp-title">
          <div className="pf-avatar" aria-hidden="true">
            {person.avatar_url && !imgFailed ? (
              <img src={person.avatar_url} alt="" width={72} height={72} referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
            ) : (
              <span>{(person.name[0] ?? "?").toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="pf-eyebrow">BUDDY PROFILE</div>
            <h1 className="t-h1" id="mp-title" style={{ margin: 0 }}>
              {person.name}
              {person.is_mod && <span className="badge badge-mod" style={{ marginLeft: 10, verticalAlign: "middle" }}>MOD</span>}
            </h1>
            <p className="text-muted pf-small" style={{ margin: 0 }}>On Debbie since {since}</p>
          </div>
        </section>
        <section className="card vp-desk" aria-labelledby="mp-desk">
          <h2 id="mp-desk" className="md-h2">{person.name}’s desk</h2>
          <p className="text-muted t-body-sm" style={{ margin: 0 }}>
            {names.length > 0 ? `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} keeping the seat.` : "The companion spot is waiting for a first buddy."}
          </p>
          <div className="md-scene">
            <img src={scene} alt={names.length ? `${person.name}'s desk with ${names.join(" and ")} on the companion mat` : `${person.name}'s desk with an empty spot for a companion`} width={160} height={112} className="md-scene__img" />
          </div>
          <p className="text-muted t-body-sm" style={{ margin: 0 }}>Placeholder art: only the companion spot redraws, and it can show one buddy.</p>
        </section>
        <section className="card" aria-labelledby="mp-pin">
          <h2 id="mp-pin" className="md-h2">{person.name}’s pin board</h2>
          <p className="text-muted t-body-sm" style={{ margin: 0 }}>No stickies yet. Desk Stickies are coming later.</p>
        </section>
        <p className="text-muted t-body-sm" style={{ margin: 0 }}>
          Shown to signed-in members only. You see their name, avatar and desk. Their deskbits, journals, goals and Focus history are never shared.
        </p>
      </main>
    </div>
  );
}
