import { env } from "../env.js";
import { GuildQueue } from "./queue.js";

const queues = new Map<string, GuildQueue>();

export function getOrCreateQueue(guildId: string): GuildQueue {
  let queue = queues.get(guildId);
  if (!queue) {
    queue = new GuildQueue(guildId, env.defaultVolume);
    queues.set(guildId, queue);
  }
  return queue;
}

export function getQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

export function destroyQueue(guildId: string): void {
  queues.get(guildId)?.stop();
  queues.delete(guildId);
}
