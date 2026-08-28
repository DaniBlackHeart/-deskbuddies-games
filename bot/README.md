# DeskBuddies Music Bot

A Jockie-style music bot for the **DeskBuddies** Discord server — plays
YouTube/SoundCloud audio and resolves Spotify links (track/playlist/album) to
the matching audio, since Spotify's own API never hands out raw audio.

This is a **separate, always-on process** from the DeskBuddies Games App
(`frontend/` + `supabase/` elsewhere in this repo). It reuses the *same*
Discord Application/bot token that the games app's `verify-membership` Edge
Function already uses — same bot identity in the server, new capabilities
added to it — but it cannot run on Vercel or as a Supabase Edge Function: it
needs a persistent Discord gateway + voice connection, which serverless
platforms don't support. See `SETUP.md` for where to actually run it
(Oracle Cloud's Always Free tier).

## Commands

| Command | Who can use it | What it does |
|---|---|---|
| `/play <query>` | DJ role or Manage Server | Search text, a YouTube/SoundCloud link, or a Spotify track/playlist/album link |
| `/skip` | DJ role or Manage Server | Skip the current track |
| `/pause` | DJ role or Manage Server | Pause playback |
| `/resume` | DJ role or Manage Server | Resume playback |
| `/stop` | DJ role or Manage Server | Clear the queue and leave the voice channel |
| `/queue` | Everyone (read-only) | Show what's playing and up next |
| `/nowplaying` | Everyone (read-only) | Show the current track |
| `/setdjrole [role]` | Manage Server only | Set (or clear, by omitting `role`) which role can control playback |

**Default access, before `/setdjrole` is ever run:** only members with
Administrator/Manage Server can control playback. Nothing is open to
everyone until a MOD deliberately runs `/setdjrole` — matching "only a
certain role can use it" rather than assuming an open-by-default bot.

## How it works

- **discord.js** for the bot/gateway/slash commands, **@discordjs/voice**
  for the actual voice connection.
- **yt-dlp** (spawned as a subprocess) resolves a search term or link to a
  playable video and, at the moment a track starts, a fresh direct media
  URL. **ffmpeg** (also spawned as a subprocess) transcodes that into raw
  PCM piped straight into `@discordjs/voice`.
- A **Spotify link** is never played directly — Spotify's API doesn't
  provide raw audio to third parties. Instead, the bot looks up the
  track/playlist/album's name + artist via Spotify's Client Credentials API
  (no user login involved) and searches YouTube for the same song.
- **DJ role setting** lives in the same Supabase project as the games app,
  in a new `music_settings` table (see `migrations/0022_music_bot_settings.sql`)
  — read/written only by this bot process via the service-role key, with
  zero client-facing RLS policies, the same "defense in depth" pattern
  already used for `active_session_lock` / `uno_deck_state` /
  `impostor_secrets` elsewhere in this schema.
- Each server gets its own in-memory queue (`src/music/queue.ts`); the bot
  auto-leaves a voice channel after 5 idle minutes with an empty queue.

## Repo structure

```
bot/
  src/
    commands/           one file per slash command
    music/               queue manager, yt-dlp/ffmpeg streaming, Spotify resolution
    lib/                 Supabase client + DJ-role permission checks, formatting
    index.ts             bot bootstrap (client, event wiring)
    register-commands.ts registers/updates slash commands with Discord
  migrations/
    0022_music_bot_settings.sql   apply this against the same Supabase project
                                    the games app uses (see repo root SETUP.md
                                    for the `npx supabase db push` flow)
```

## Local development

```bash
cd bot
cp .env.example .env   # fill in real values — see SETUP.md
npm install
npm run register-commands   # once, or after changing a command
npm run dev
```

## A note on longevity

YouTube extraction (via yt-dlp) and this bot's continued good standing with
YouTube both depend on staying modest: this bot is meant for the DeskBuddies
server, not to be publicly listed or scaled to many servers. See the earlier
conversation in this project's history for the fuller reasoning — the short
version is that YouTube's enforcement against music bots has historically
targeted scale and public visibility, not small self-hosted bots. Keep
`yt-dlp` updated (`SETUP.md` has a cron suggestion) since YouTube periodically
changes things that break extraction until yt-dlp's maintainers patch it.
