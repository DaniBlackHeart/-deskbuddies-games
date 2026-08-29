import { Link } from "react-router-dom";

// Small, consistent "back" affordance for the MOD management pages that
// hang off the MOD Dashboard's tiles (Question Sets, Feud Sets, Hosting
// UNO, Impostor Categories, Wheel of Fortune, Type What You See). AppHeader
// already has a "MOD Dashboard" link, but it reads as a generic nav item,
// not a way back from the page you're on — this sits right above the page
// title instead, styled like the other low-emphasis ghost buttons in the
// app (see ModDashboardPage's "Troubleshooting" toggle).
export default function BackToModDashboardLink() {
  return (
    <Link
      to="/mod"
      className="btn btn-ghost btn-sm"
      style={{ padding: 0, marginBottom: "12px", display: "inline-block" }}
    >
      ← Back to MOD Dashboard
    </Link>
  );
}
