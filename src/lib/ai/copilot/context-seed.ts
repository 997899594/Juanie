import type { CopilotReplayPayload } from '@/lib/ai/copilot/types';

declare global {
  interface Window {
    __juanieCopilotReplaySeed?: CopilotReplayPayload | null;
  }
}

export function setGlobalCopilotReplaySeed(seed: CopilotReplayPayload | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__juanieCopilotReplaySeed = seed;
}

export function getGlobalCopilotReplaySeed(): CopilotReplayPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__juanieCopilotReplaySeed ?? null;
}
