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
    // PKCE (Supabase's recommended default). We briefly switched this to
    // "implicit" while chasing a mobile login bug that turned out to be
    // unrelated — the real cause was Discord's app intercepting login taps
    // natively because the same Discord Application had a bot attached.
    // Fixed by splitting login into its own bot-less Discord Application.
    // No reason to keep the less-hardened flow now that that's resolved.
    flowType: "pkce",
  },
});
