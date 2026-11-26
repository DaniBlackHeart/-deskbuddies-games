import { Link } from "react-router-dom";

// Small, consistent "back" affordance for the game hosting pages (Question
// Sets, Feud Sets, Hosting UNO, Impostor Categories, Wheel of Fortune, Type
// What You See). Any member can host now, so these pages are reached from
// Reality Break, and that is where this leads back to. (The file name is kept
// so existing imports don't change.)
export default function BackToModDashboardLink() {
  return (
    <Link
      to="/games"
      className="btn btn-ghost btn-sm"
      style={{ padding: 0, marginBottom: "12px", display: "inline-block" }}
    >
      ← Back to Reality Break
    </Link>
  );
}
