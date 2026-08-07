import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev rather than silently breaking auth later.
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit flow (not PKCE) — deliberate choice. PKCE stores a secret in
    // localStorage before redirecting to Discord and reads it back after
    // returning. Discord's Android in-app browser sometimes opens links in
    // an ephemeral Custom Tab that doesn't carry that storage over to the
    // tab it redirects back to, which silently breaks login. Implicit flow
    // returns the session directly in the redirect URL instead, with no
    // dependency on anything being stored beforehand — so it isn't affected
    // by that in-app-browser quirk.
    flowType: "implicit",
  },
});
