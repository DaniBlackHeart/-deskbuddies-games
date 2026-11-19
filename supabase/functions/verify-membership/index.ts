// verify-membership
// Called by the frontend right after Discord login, and again in the
// background every few minutes while the app is open (see AuthContext.tsx).
// Confirms the user is a member of the DeskBuddies Discord server
// (and whether they hold the MOD role) using the bot token — this
// check can ONLY be done server-side, since the bot token must
// never reach the browser.
//
// Every successful check stamps profiles.membership_verified_at. Stored
// membership is only trusted for a limited time after that stamp (see
// 0026_membership_trust_expiry.sql and _shared/utils.ts), so a member who
// leaves the server loses access instead of keeping it indefinitely.

import {
  jsonResponse,
  handleOptions,
  getAdminClient,
  discordAvatarUrl,
  checkDiscordMembership,
  revokeMembership,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }
    const user = userData.user;

    // Pull the full user record (with identities) to get Discord's raw claims.
    const { data: fullUserData, error: fullUserError } = await admin.auth.admin.getUserById(user.id);
    if (fullUserError || !fullUserData?.user) {
      return jsonResponse({ error: "Could not load user identity" }, 500);
    }

    const discordIdentity = fullUserData.user.identities?.find((i) => i.provider === "discord");
    if (!discordIdentity) {
      return jsonResponse({ error: "No Discord identity found on this account" }, 400);
    }

    const claims = discordIdentity.identity_data ?? {};
    const discordId: string = claims.provider_id ?? claims.sub ?? discordIdentity.id;
    const avatarHash: string | null = claims.avatar_url ? null : null; // see note below

    // Discord's raw avatar hash isn't always forwarded by the OAuth provider mapping,
    // so we prefer the CDN URL Supabase already resolved, and fall back to building one.
    const providedAvatar: string | null = claims.avatar_url ?? null;

    // --- Check guild membership + role via the bot token ---
    const check = await checkDiscordMembership(discordId);

    if (check.status === "not_member") {
      // Not in the server (never was, or left). Remove any stored trust.
      //
      // If this person WAS a member until now, they've just left: also revoke
      // their sessions so they're signed out everywhere and can't keep
      // refreshing tokens. Someone who was never a member (e.g. just
      // signed in before joining the server) keeps their session, so the
      // "I just joined — check again" button on the Members only page still
      // works for them.
      const { data: existing } = await admin
        .from("profiles")
        .select("is_member")
        .eq("id", user.id)
        .maybeSingle();
      const wasMember = existing?.is_member === true;

      await revokeMembership(admin, user.id, wasMember ? token : null);
      return jsonResponse({ is_member: false });
    }

    if (check.status === "error") {
      // Discord is unreachable or rate-limiting us. Don't guess either way:
      // the client keeps its current state and retries later, and the
      // database stops trusting stored membership on its own once it's
      // older than the trust window.
      return jsonResponse({ error: "Could not verify Discord membership right now" }, 502);
    }

    const member = check.member;

    // Prefer the member's DeskBuddies server nickname (what everyone actually
    // knows them as in-server) over their global Discord display name.
    const username: string =
      member.nick ||
      member.user?.global_name ||
      claims.global_name ||
      claims.full_name ||
      claims.name ||
      claims.custom_claims?.global_name ||
      "DeskBuddy";

    const resolvedAvatar =
      providedAvatar ?? discordAvatarUrl(discordId, avatarHash, claims.discriminator ?? "0");

    const { data: profile, error: upsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          discord_id: discordId,
          username,
          avatar_url: resolvedAvatar,
          is_member: true,
          is_mod: check.isMod,
          membership_verified_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Profile upsert failed", upsertError);
      return jsonResponse({ error: "Could not save profile" }, 500);
    }

    return jsonResponse({ is_member: true, profile });
  } catch (err) {
    console.error("verify-membership crashed", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
