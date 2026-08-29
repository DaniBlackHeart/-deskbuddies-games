/**
 * Suspense fallback shown while a lazy-loaded route's chunk is still being
 * fetched (see App.tsx). Matches the same center-screen + spinner pattern
 * already used for in-page loading states (UnoPlayPage, FeudPlayPage,
 * RebusPlayPage, etc.) so a route-level load looks identical to every other
 * "waiting on something" moment in the app.
 */
export default function RouteLoadingFallback() {
  return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  );
}
