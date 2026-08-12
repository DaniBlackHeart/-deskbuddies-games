import { createClient, FunctionsHttpError } from "@supabase/supabase-js";

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

/**
 * Wraps supabase.functions.invoke so the caller actually gets the message
 * an Edge Function wrote via jsonResponse({ error: "..." }, <non-2xx>).
 *
 * supabase-js only parses the response body into `data` when the function
 * returns a 2xx status. Every error in this app's Edge Functions is a real
 * HTTP error status (409, 404, 403, ...), so on failure `data` comes back
 * null and the specific message ends up buried in `error.context` (the raw
 * Response) instead — which every call site used to just ignore in favor
 * of its own hardcoded fallback text. This unwraps that for you.
 */
export async function invokeFunction<T = any>(
  name: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await error.context.json();
        return { data: null, error: parsed?.error ?? error.message };
      } catch {
        return { data: null, error: error.message };
      }
    }
    return { data: null, error: error.message };
  }

  // Defensive fallback in case a function ever returns { error } with a 200.
  if (data?.error) {
    return { data: null, error: data.error as string };
  }

  return { data: data as T, error: null };
}
