export interface QueuedMessage {
  id: string;
  groupId: string;
  content?: string;
  messageType: 'text' | 'gif';
  gifUrl?: string;
  userId: string;
  queuedAt: number;
}

const QUEUE_KEY = 'syncchat_offline_msg_queue';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_SIZE = 50;

export function getQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: QueuedMessage[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((m) => m.queuedAt > cutoff);
  } catch {
    return [];
  }
}

export function enqueue(msg: QueuedMessage): void {
  const q = getQueue();
  const trimmed = [...q, msg].slice(-MAX_SIZE);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export function dequeue(id: string): void {
  const q = getQueue().filter((m) => m.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function getQueueForGroup(groupId: string): QueuedMessage[] {
  return getQueue()
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => a.queuedAt - b.queuedAt);
}
