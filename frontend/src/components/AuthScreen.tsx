import type { ReactNode } from "react";

// Shared shell for the signed-out screens (sign in, members only, and the
// membership check). Uses the Debbie mark, the pixel display face for the
// wordmark and Figtree for everything people read.
export default function AuthScreen({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <main className="center-screen db-page">
      <div className="db-panel db-auth">
        {/* 32px master at 3x = 96px, a whole-number scale so pixels stay crisp. */}
        <img src="/debbie-mark.svg" alt="" width={96} height={96} className="db-auth__mark" />
        <h1 className="t-display db-auth__title">{title}</h1>
        {lead && <p className="t-h3 db-auth__lead">{lead}</p>}
        {children}
      </div>
    </main>
  );
}
