import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types";

// Captured once, at module load, before any auth processing touches the URL.
// TEMPORARY — used to diagnose the mobile in-app-browser login issue.
const RAW_REDIRECT_URL = typeof window !== "undefined" ? window.location.href : "";

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
  debugInfo: string | null;
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
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  async function verifyMembership(currentSession: Session) {
    setStatus("verifying");
    setVerifyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-membership", {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (error) throw error;

      if (!data?.is_member) {
        setStatus("not_a_member");
        setProfile(null);
        return;
      }

      setProfile(data.profile as Profile);
      setStatus("member");
    } catch (err) {
      console.error("Membership verification failed:", err);
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

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return;
      if (data.session) {
        setSession(data.session);
        verifyMembership(data.session);
      } else {
        if (oauthError) {
          setVerifyError(oauthError);
        } else if (hadAuthAttempt) {
          // A login attempt clearly happened (Discord/Supabase redirected back
          // with auth params) but no session came out of it — most likely an
          // in-app-browser quirk. Give people something actionable instead of
          // just quietly dropping them back at the sign-in button.
          setVerifyError(
            "Sign-in didn't complete. If you opened this link from inside another app (like Discord), try opening it in your regular browser instead and sign in again."
          );
        }
        if (hadAuthAttempt || sessionError) {
          // TEMPORARY diagnostic — remove once the mobile login issue is confirmed fixed.
          setDebugInfo(
            `url=${RAW_REDIRECT_URL} | sessionError=${sessionError ? sessionError.message : "none"}`
          );
        }
        setStatus("signed_out");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (event === "SIGNED_OUT" || !newSession) {
        setProfile(null);
        setStatus("signed_out");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_IN") {
          verifyMembership(newSession);
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
    setProfile(null);
    setStatus("signed_out");
  }

  async function retryVerification() {
    if (session) await verifyMembership(session);
  }

  return (
    <AuthContext.Provider
      value={{ status, session, profile, verifyError, debugInfo, signInWithDiscord, signOut, retryVerification }}
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
