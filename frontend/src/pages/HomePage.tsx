import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ActiveGameStatus from "../components/ActiveGameStatus";
import DailyCheckInCard from "../components/DailyCheckInCard";
import { useAuth } from "../contexts/AuthContext";

// Main page of the app. Placeholder for now: the daily check-in is live; the desk
// and "who's around" will be added here later.
export default function HomePage() {
  const { profile } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="container">
        <h1>Welcome{profile?.username ? `, ${profile.username}` : ""}</h1>
        <p className="text-muted">Here's what's happening in DeskBuddies today.</p>

        <ActiveGameStatus />

        <DailyCheckInCard />

        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <h2 style={{ marginTop: 0 }}>Game night</h2>
          <p className="text-muted">Trivia, UNO, Family Feud and more.</p>
          <Link to="/games" className="btn btn-primary">
            Go to Games
          </Link>
        </div>

        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <span className="badge badge-neutral">Coming soon</span>
          <p className="text-muted">Your desk and who's around.</p>
        </div>
      </div>
    </div>
  );
}
