# Setup — DeskBuddies Music Bot

Walks through: reusing your existing Discord bot, applying the new Supabase
table, and deploying to a genuinely free always-on host (Oracle Cloud).

## 1. Discord Developer Portal — reuse the existing Bot application

This is the **same** Discord Application that has the Bot used by
`verify-membership` in the games app — the one with a real bot user already
sitting in the DeskBuddies server. You do **not** need to create a third
Discord app.

1. Go to https://discord.com/developers/applications and open that
   application (the Bot-only one — **not** the separate bot-less app used
   for OAuth login. Keep those two apart, exactly as `PROJECT_CONTEXT.md`
   already documents).
2. **Bot** tab: copy the bot token if you don't already have it saved
   (regenerate if it's been lost — that invalidates the old one). This goes
   in `DISCORD_BOT_TOKEN`.
3. **General Information** tab: copy the **Application ID** — this is
   `DISCORD_CLIENT_ID`.
4. **Gateway Intents**: the two intents this bot needs (`GUILDS`,
   `GUILD_VOICE_STATES`) are both non-privileged — there's nothing to toggle
   on in the portal for them.
5. **Permissions**: the bot's role in your server needs, at minimum, `View
   Channel`, `Connect`, and `Speak` in whichever voice channels members will
   use it from, plus `Send Messages` in whatever text channel it should post
   "now playing" messages in. Check **Server Settings → Roles** for the
   bot's role and confirm these are enabled. If they aren't (likely, since
   the bot's original job never touched voice), the simplest fix is:
   - **OAuth2 → URL Generator** tab, select scopes `bot` and
     `applications.commands` (the commands scope is required for slash
     commands to register at all — the original setup likely never needed
     it), then under Bot Permissions select `View Channels`, `Connect`,
     `Speak`, `Send Messages`.
   - Open the generated URL and "re-authorize" the bot into DeskBuddies.
     Since it's the same bot user, this **updates** its permissions/scopes
     rather than adding a duplicate bot.

## 2. Apply the new Supabase table

From the repo root (same Supabase project the games app already uses):

```bash
# copy or merge bot/migrations/0022_music_bot_settings.sql into
# supabase/migrations/ alongside the existing numbered files, then:
npx supabase db push
```

Grab the **service role key** (Project Settings → API — the long one, never
the `anon` key) for `SUPABASE_SERVICE_ROLE_KEY` below. This key is as
sensitive as the Discord bot token — never put it in frontend code or a
public repo.

## 3. Optional: Spotify credentials

Only needed if you want `/play` to accept `open.spotify.com` links directly
(without it, members can still just type the song name).

1. https://developer.spotify.com/dashboard → Create app.
2. Copy the **Client ID** and **Client Secret** → `SPOTIFY_CLIENT_ID` /
   `SPOTIFY_CLIENT_SECRET`. No redirect URI or user login needed — this bot
   only uses the Client Credentials flow (public catalog metadata only).

## 4. Deploy — Oracle Cloud "Always Free" tier

This is the genuinely-free, no-time-limit option (unlike Fly.io's trial-only
free tier or Render's free tier, which sleeps a service after 15 minutes of
inactivity — both wrong for something that has to stay connected to Discord's
gateway continuously).

1. Sign up at https://www.oracle.com/cloud/free/ (needs a card for identity
   verification, but the Always Free resources genuinely never bill).
2. Create a Compute instance: shape **VM.Standard.A1.Flex** (Ampere ARM,
   Always Free — 1 OCPU / 6GB is comfortably enough for one small music bot,
   leaving headroom under the 2 OCPU / 12GB Always Free cap for anything
   else later), image **Ubuntu** (latest LTS).
3. SSH in using the key pair Oracle has you download during creation:
   ```bash
   ssh -i your-key.pem ubuntu@<instance-public-ip>
   ```
4. Install dependencies:
   ```bash
   sudo apt update && sudo apt install -y ffmpeg python3-pip
   pip install -U yt-dlp
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```
5. Get the bot's code onto the VM — either `git clone` your repo (once
   `bot/` is committed into it) or `scp` the `bot/` folder over:
   ```bash
   scp -i your-key.pem -r bot ubuntu@<instance-public-ip>:~/deskbuddies-music-bot
   ```
6. On the VM:
   ```bash
   cd ~/deskbuddies-music-bot   # or wherever you cloned/copied it
   cp .env.example .env
   nano .env                    # fill in every value from steps 1-3
   npm install
   npm run build
   npm run register-commands    # only needs to run once, or after changing a command
   pm2 start dist/index.js --name deskbuddies-music-bot
   pm2 save
   pm2 startup                  # follow the one printed command to enable on-boot start
   ```
7. Oracle's default security list blocks all inbound traffic by default,
   which is actually fine here — this bot only makes *outbound* connections
   (to Discord, YouTube, Spotify), it never needs an inbound port open.

**Keeping yt-dlp current** (YouTube periodically changes things that break
extraction until yt-dlp's maintainers patch around it):
```bash
# add to `crontab -e`, runs weekly:
0 4 * * 0 pip install -U yt-dlp >> /home/ubuntu/yt-dlp-update.log 2>&1
```

**Checking logs / restarting after a change:**
```bash
pm2 logs deskbuddies-music-bot
pm2 restart deskbuddies-music-bot
```

## 5. Environment variables reference

| Variable | Required | Where it comes from |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Developer Portal → Bot tab |
| `DISCORD_CLIENT_ID` | Yes | Developer Portal → General Information |
| `DISCORD_DEV_GUILD_ID` | No | Your server's ID, only for instant command updates while developing |
| `SUPABASE_URL` | Yes | Same value the frontend's `.env` already uses |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase dashboard → Project Settings → API (**not** the anon key) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | No | Spotify Developer Dashboard |
| `YTDLP_PATH` / `FFMPEG_PATH` | No | Defaults assume both are on `PATH`, true after step 4's install |
| `DEFAULT_VOLUME` | No | 0–2, defaults to 0.5 |

## Known limitations (read before handing this off to real use)

- **In-memory queues.** If the bot process restarts (a crash, a deploy, a VM
  reboot), every server's current queue is lost — playback stops and needs
  `/play` again. Fine for a casual community bot; would need a persistence
  layer (e.g. writing the queue to Supabase) if that ever becomes annoying.
- **One VM = one point of failure.** No redundancy — if the Oracle instance
  goes down, so does the bot, until it's manually restarted (pm2's restart
  policy handles a crashed *process*, not a stopped *VM*).
- **yt-dlp/YouTube is inherently a moving target.** Occasional playback
  failures after a YouTube-side change are expected until yt-dlp ships a fix
  — this isn't a bug in this code, it's the nature of unofficial extraction.
- **Security check performed**: no secrets are hardcoded anywhere in this
  code (grepped before delivery) — `.env` is git-ignored, `.env.example`
  only has placeholders, and the Supabase service-role key is used
  exclusively in this backend process, never sent to any client. Rate
  limiting wasn't added to the Discord commands themselves since Discord
  already rate-limits interactions per-user at the platform level.
