import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import type { VoiceBasedChannel, GuildTextBasedChannel } from "discord.js";
import { startAudioStream, type AudioStreamHandle } from "./stream.js";
import type { Track } from "./types.js";

const IDLE_DISCONNECT_MS = 5 * 60 * 1000; // leave the channel after 5 idle minutes

export class GuildQueue {
  readonly guildId: string;
  private connection: VoiceConnection | null = null;
  private readonly player: AudioPlayer;
  private tracks: Track[] = [];
  private current: Track | null = null;
  private currentStream: AudioStreamHandle | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private volume: number;
  /** Where to post "Now playing" / error messages. */
  statusChannel: GuildTextBasedChannel | null = null;

  constructor(guildId: string, defaultVolume: number) {
    this.guildId = guildId;
    this.volume = defaultVolume;
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.currentStream?.kill();
      this.currentStream = null;
      this.current = null;
      void this.playNext();
    });

    this.player.on("error", (err) => {
      console.error(`[music] Player error in guild ${this.guildId}:`, err);
      this.statusChannel?.send(
        `Ran into a playback error on **${this.current?.title ?? "that track"}** — skipping it.`
      ).catch(() => {});
      this.currentStream?.kill();
      this.currentStream = null;
      this.current = null;
      void this.playNext();
    });
  }

  async connect(channel: VoiceBasedChannel): Promise<void> {
    this.clearIdleTimer();

    if (this.connection && this.connection.joinConfig.channelId === channel.id) {
      return;
    }

    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.player);

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
      console.error(`[music] Voice connection in guild ${this.guildId} never became ready:`, err);
      this.connection.destroy();
      this.connection = null;
      throw new Error("Couldn't connect to that voice channel in time — check my Connect/Speak permissions there.");
    }
  }

  get isConnected(): boolean {
    return this.connection !== null;
  }

  enqueue(tracks: Track[]): void {
    this.tracks.push(...tracks);
    if (!this.current) {
      void this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    const next = this.tracks.shift();
    if (!next) {
      this.scheduleIdleDisconnect();
      return;
    }

    this.current = next;
    try {
      const handle = await startAudioStream(next.webpageUrl);
      this.currentStream = handle;
      const resource = createAudioResource(handle.stream, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume);
      this.player.play(resource);
      this.statusChannel?.send(`🎵 Now playing: **${next.title}**`).catch(() => {});
    } catch (err) {
      console.error(`[music] Failed to start stream for ${next.webpageUrl}:`, err);
      this.statusChannel
        ?.send(`Couldn't play **${next.title}** — skipping it.`)
        .catch(() => {});
      this.current = null;
      void this.playNext();
    }
  }

  skip(): boolean {
    if (!this.current) return false;
    this.player.stop(); // triggers Idle -> playNext()
    return true;
  }

  pause(): boolean {
    if (!this.current) return false;
    return this.player.pause();
  }

  resume(): boolean {
    if (!this.current) return false;
    return this.player.unpause();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    const resource = (this.player.state as { resource?: { volume?: { setVolume(v: number): void } } })
      .resource;
    resource?.volume?.setVolume(volume);
  }

  stop(): void {
    this.tracks = [];
    this.current = null;
    this.currentStream?.kill();
    this.currentStream = null;
    this.player.stop();
    this.connection?.destroy();
    this.connection = null;
    this.clearIdleTimer();
  }

  nowPlaying(): Track | null {
    return this.current;
  }

  listQueue(): Track[] {
    return [...this.tracks];
  }

  private scheduleIdleDisconnect(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (!this.current && this.tracks.length === 0) {
        this.statusChannel?.send("Queue's empty — leaving the voice channel. 👋").catch(() => {});
        this.stop();
      }
    }, IDLE_DISCONNECT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
