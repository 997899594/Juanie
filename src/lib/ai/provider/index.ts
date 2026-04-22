import type { JuanieAIProviderAdapter } from '@/lib/ai/provider/adapter';
import { Provider302Adapter } from '@/lib/ai/provider/providers/provider-302';

let cachedProvider: JuanieAIProviderAdapter | null = null;

export function getAIProvider(): JuanieAIProviderAdapter {
  if (!cachedProvider) {
    cachedProvider = new Provider302Adapter();
  }

  return cachedProvider;
}
