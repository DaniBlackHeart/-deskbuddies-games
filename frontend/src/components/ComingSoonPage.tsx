import AppHeader from "./AppHeader";

// Placeholder for tabs whose features aren't built yet.
export default function ComingSoonPage({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <h1>{title}</h1>
        <div className="card">
          <span className="badge badge-neutral">Coming soon</span>
          <p className="text-muted">{blurb}</p>
        </div>
      </div>
    </div>
  );
}
