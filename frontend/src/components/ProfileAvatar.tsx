import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Header profile link: the signed-in member's Discord avatar (or their initial
// if they have none or it fails to load). Replaces the Profile tab on wider
// screens; on phones Profile lives in the More sheet.
export default function ProfileAvatar({ className }: { className?: string }) {
  const { profile } = useAuth();
  const [failed, setFailed] = useState(false);
  const name = profile?.username ?? "";
  const url = profile?.avatar_url;

  return (
    <NavLink
      to="/profile"
      className={({ isActive }) =>
        "app-avatar" + (isActive ? " app-avatar--active" : "") + (className ? " " + className : "")
      }
      aria-label={name ? `Profile, ${name}` : "Profile"}
      title="Profile"
    >
      {url && !failed ? (
        <img src={url} alt="" width={44} height={44} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{(name[0] ?? "?").toUpperCase()}</span>
      )}
    </NavLink>
  );
}
