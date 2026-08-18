import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types";

type AuthStatus =
  | "loading" // still figuring out session state
  | "signed_out"
  | "verifying" // signed in, checking guild membership server-side
  | "not_a_member" // signed in, but not in the Discord server
  | "member"; // verified member (profile.is_member = true)

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  verifyError: string | null;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  retryVerification: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Tracks whose membership we last successfully verified, so a re-fired
  // SIGNED_IN event for the SAME already-verified user (see note below on
  // supabase-js's tab-refocus behavior) can re-check in the background
  // instead of yanking the whole app back to the "Checking your DeskBuddies
  // membership…" screen.
  const verifiedUserId = useRef<string | null>(null);

  async function verifyMembership(currentSession: Session, opts: { silent?: boolean } = {}) {
    const { silent = false } = opts;
    if (!silent) {
      setStatus("verifying");
      setVerifyError(null);
    }
    try {
      const { data, error } = await supabase.functions.invoke("verify-membership", {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (error) throw error;

      if (!data?.is_member) {
        verifiedUserId.current = null;
        setStatus("not_a_member");
        setProfile(null);
        return;
      }

      verifiedUserId.current = currentSession.user.id;
      setProfile(data.profile as Profile);
      setStatus("member");
    } catch (err) {
      console.error("Membership verification failed:", err);
      if (silent) {
        // A background recheck (e.g. triggered by refocusing the tab)
        // failing shouldn't sign someone out from under themselves over a
        // blip — leave their current verified state alone and let the next
        // recheck (or a manual retry) sort it out.
        return;
      }
      setVerifyError(
        "We couldn't verify your DeskBuddies membership right now. Please try again."
      );
      setStatus("signed_out");
    }
  }

  useEffect(() => {
    let isMounted = true;

    // If Discord/Supabase sent back an explicit error in the URL (rare, but
    // possible), surface it instead of silently landing on a blank login.
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error_description") || hashParams.get("error_description");
    const hadAuthAttempt =
      params.has("code") || hashParams.has("access_token") || params.has("error") || hashParams.has("error");

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        setSession(data.session);
        verifyMembership(data.session);
      } else {
        if (oauthError) {
          setVerifyError(oauthError);
        } else if (hadAuthAttempt) {
          // A login attempt clearly happened (Discord/Supabase redirected back
          // with auth params) but no session came out of it. Give people
          // something actionable instead of just quietly dropping them back
          // at the sign-in button.
          setVerifyError(
            "Sign-in didn't complete. Please try again — if it keeps happening, let a mod know."
          );
        }
        setStatus("signed_out");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (event === "SIGNED_OUT" || !newSession) {
        verifiedUserId.current = null;
        setProfile(null);
        setStatus("signed_out");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_IN") {
          // supabase-js intentionally re-fires SIGNED_IN every time the tab
          // regains focus (it doubles as "recover session on visibility
          // change" for mobile) — not just on a real, fresh sign-in. If
          // we've already verified this exact user this session, treat it
          // as a background recheck instead of re-showing the full-screen
          // "Checking your membership…" loader over whatever page they were
          // on.
          const isNewUser = verifiedUserId.current !== newSession.user.id;
          verifyMembership(newSession, { silent: !isNewUser });
        }
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    verifiedUserId.current = null;
    setProfile(null);
    setStatus("signed_out");
  }

  async function retryVerification() {
    if (session) await verifyMembership(session);
  }

  return (
    <AuthContext.Provider
      value={{ status, session, profile, verifyError, signInWithDiscord, signOut, retryVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
