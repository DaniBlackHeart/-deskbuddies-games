import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../command.js";
import { canManageMusicSettings } from "../lib/permissions.js";
import { resolveMember } from "../lib/discord-helpers.js";
import { setDjRole } from "../lib/supabase.js";

const data = new SlashCommandBuilder()
  .setName("setdjrole")
  .setDescription("Set (or clear) which role can control music playback")
  // First line of defense: Discord itself hides this command from members
  // without Manage Server, though a server admin could loosen that via
  // Integrations settings. The execute() check below re-verifies
  // server-side regardless — this command changes who else gets control,
  // so it stays hard-restricted to Manage Server rather than following
  // that override.
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("The role allowed to control music (omit to clear — restricts control to admins only)")
      .setRequired(false)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Ack Discord immediately — resolving the member and saving to Supabase
  // below can take a moment, and Discord requires the initial response
  // within 3 seconds or it shows "The application did not respond" even if
  // the command would have otherwise succeeded a moment later.
  await interaction.deferReply();

  const member = await resolveMember(interaction);
  if (!canManageMusicSettings(member)) {
    await interaction.editReply("You need Manage Server permission to change this.");
    return;
  }

  const role = interaction.options.getRole("role");

  try {
    await setDjRole(interaction.guildId, role?.id ?? null);
  } catch (err) {
    console.error("[setdjrole] failed:", err);
    await interaction.editReply("Couldn't save that setting — check the bot's logs.");
    return;
  }

  await interaction.editReply(
    role
      ? `DJ role set to **${role.name}** — members with that role (or Manage Server) can now control music.`
      : "DJ role cleared — only admins/Manage Server can control music until a role is set again."
  );
}

export default { data, execute } satisfies Command;
