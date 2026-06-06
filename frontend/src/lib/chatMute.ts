export type MuteDurationOption = '8h' | '1w' | 'always';

export type ChatMuteState = {
  isMuted: boolean;
  muteUntil: string | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function computeMuteUntil(option: MuteDurationOption, now = new Date()): string | null {
  if (option === 'always') return null;

  const nowMs = now.getTime();
  const endMs = option === '8h' ? nowMs + (8 * HOUR_MS) : nowMs + (7 * DAY_MS);
  return new Date(endMs).toISOString();
}

export function isMuteActive(state: ChatMuteState | undefined, now = new Date()): boolean {
  if (!state?.isMuted) return false;
  if (state.muteUntil === null) return true;

  const untilMs = Date.parse(state.muteUntil);
  if (Number.isNaN(untilMs)) return false;

  return untilMs > now.getTime();
}

export function isChatMutedByFields(
  isMuted?: boolean,
  muteUntil?: string | null,
  now = new Date(),
): boolean {
  return isMuteActive({ isMuted: Boolean(isMuted), muteUntil: muteUntil ?? null }, now);
}

export function toChatMuteState(option: MuteDurationOption, now = new Date()): ChatMuteState {
  return {
    isMuted: true,
    muteUntil: computeMuteUntil(option, now),
  };
}
