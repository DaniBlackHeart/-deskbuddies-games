import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        setSession(data.session);
        verifyMembership(data.session);
      } else {
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
