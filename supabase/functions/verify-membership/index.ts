// verify-membership
// Called by the frontend right after Discord login.
// Confirms the user is a member of the DeskBuddies Discord server
// (and whether they hold the MOD role) using the bot token — this
// check can ONLY be done server-side, since the bot token must
// never reach the browser.

import { corsHeaders, jsonResponse, handleOptions, getAdminClient, discordAvatarUrl } from "../_shared/utils.ts";

const DISCORD_GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;
const DISCORD_MOD_ROLE_ID = Deno.env.get("DISCORD_MOD_ROLE_ID")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

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
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
    );

    if (memberRes.status === 404) {
      // Not in the server — make sure any stale profile reflects that.
      await admin.from("profiles").update({ is_member: false, is_mod: false }).eq("id", user.id);
      return jsonResponse({ is_member: false });
    }

    if (!memberRes.ok) {
      console.error("Discord API error", memberRes.status, await memberRes.text());
      return jsonResponse({ error: "Could not verify Discord membership right now" }, 502);
    }

    const member = await memberRes.json();
    const roles: string[] = member.roles ?? [];
    const isMod = roles.includes(DISCORD_MOD_ROLE_ID);

    // Prefer the member's DeskBuddies server nickname (what everyone actually
    // knows them as in-server) over their global Discord display name.
    const username: string =
      member.nick || claims.global_name || claims.full_name || claims.name || claims.custom_claims?.global_name || "DeskBuddy";

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
          is_mod: isMod,
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
