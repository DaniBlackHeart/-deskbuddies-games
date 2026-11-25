import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { MIN_QUERY, useWhosAround, type AroundPerson } from "../lib/useWhosAround";

// Who's around (Debbie Home design). Two parts: Find a member (searches every
// member, not only people who are around) and the people in a Focus Block right
// now. Results show only what the server marks member-visible. A row opens that
// member's profile (your own row opens your Buddy Profile).

function Avatar({ person }: { person: AroundPerson }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="wa-avatar" aria-hidden="true">
      {person.avatar_url && !failed ? (
        <img src={person.avatar_url} alt="" width={44} height={44} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        (person.name[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}

function focusLine(p: AroundPerson): string {
  return p.focus_minutes_left !== null ? `Focus Block, about ${p.focus_minutes_left} min left` : "";
}

export default function WhosAroundPanel({ className }: { className?: string }) {
  const { profile } = useAuth();
  const hrefFor = (id: string) => (id === profile?.id ? "/profile" : `/members/${id}`);
  const { around, aroundError, query, setQuery, results, searching, searchError } = useWhosAround();
  const q = query.trim();
  const searchActive = q.length >= MIN_QUERY;

  let status = "";
  if (searchActive && !searching && !searchError && results) {
    status = results.length === 0 ? "No members found." : `${results.length} ${results.length === 1 ? "member" : "members"} found.`;
  }

  return (
    <section className={"db-panel" + (className ? " " + className : "")} aria-labelledby="around">
      <h2 id="around" className="t-h2" style={{ margin: 0 }}>
        Who's around
      </h2>
      <p className="t-body-sm text-muted" style={{ margin: "4px 0 0" }}>
        A little company while you work.
      </p>

      <div className="wa-find">
        <label htmlFor="member-search" className="wa-find__label">
          Find a member
        </label>
        <div className="wa-find__box">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="8" cy="8" r="5" />
            <path d="M12 12l4 4" />
          </svg>
          <input
            id="member-search"
            type="search"
            autoComplete="off"
            maxLength={40}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name"
            aria-describedby="member-search-note"
          />
          {query && (
            <button type="button" className="wa-find__clear" onClick={() => setQuery("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
        <p id="member-search-note" className="t-caption text-muted" style={{ margin: "8px 0 0" }}>
          Every member can be found here, not only people in a Focus Block. A profile shows only what that member shares.
        </p>

        <div role="region" aria-live="polite" aria-label="Member search results">
          <span className="sr-only">{status}</span>
          {searchActive && searching && !results && <p className="t-body-sm text-muted">Searching…</p>}
          {searchActive && searchError && (
            <p className="t-body-sm" role="alert">
              Couldn't search just now. Please try again.
            </p>
          )}
          {searchActive && !searchError && results && results.length === 0 && !searching && (
            <p className="t-body-sm text-muted" style={{ margin: "12px 0 0" }}>
              <b>No members found for “{q}”.</b>
              <br />
              Check the spelling or try fewer letters.
            </p>
          )}
          {searchActive && !searchError && results && results.length > 0 && (
            <ul className="wa-list">
              {results.map((p) => (
                <li key={p.id} className="wa-row wa-row--link">
                  <Link to={hrefFor(p.id)} className="wa-row__a" aria-label={`Open ${p.name}'s profile`}>
                    <Avatar person={p} />
                    <span className="wa-row__text">
                      <span className="wa-row__name">{p.name}</span>
                      {focusLine(p) && <span className="wa-row__sub">{focusLine(p)}</span>}
                    </span>
                    <span className="wa-row__go" aria-hidden="true">View ›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!searchActive && (
        <div className="wa-around">
          {aroundError && (
            <p className="t-body-sm">
              <b>We can't see who's around right now.</b>
              <br />
              <span className="text-muted">
                That doesn't mean nobody's there. This list only shows people in a Focus Block in the app. Check the voice channels in Discord, or start a Focus Block and keep your own company.
              </span>
            </p>
          )}
          {!aroundError && around === null && <p className="t-body-sm text-muted">Looking around…</p>}
          {!aroundError && around && around.length === 0 && (
            <p className="t-body-sm text-muted">
              Nobody is in a Focus Block right now. That doesn't mean nobody's there; check the voice channels in Discord, or start a Focus Block and keep your own company.
            </p>
          )}
          {!aroundError && around && around.length > 0 && (
            <ul className="wa-list" aria-label="In a Focus Block now">
              {around.map((p) => (
                <li key={p.id} className="wa-row wa-row--link">
                  <Link to={hrefFor(p.id)} className="wa-row__a" aria-label={`Open ${p.name}'s profile`}>
                    <Avatar person={p} />
                    <span className="wa-row__text">
                      <span className="wa-row__name">{p.name}</span>
                      <span className="wa-row__sub">{focusLine(p)}</span>
                    </span>
                    <span className="wa-row__go" aria-hidden="true">View ›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
