import { NextResponse } from 'next/server';
import { toAIRouteErrorResponse } from '@/lib/ai/http/route-response';
import { getAIPluginByIdForTeam } from '@/lib/ai/runtime/plugin-registry';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';

export async function handleDynamicPluginRoute(input: {
  pluginId: string;
  teamId: string;
  scope: 'environment' | 'release';
  forceRefresh: boolean;
  fallbackMessage: string;
  run: () => Promise<Response>;
}): Promise<Response> {
  try {
    const plugin = await getAIPluginByIdForTeam(input.teamId, input.pluginId);

    if (!plugin || plugin.manifest.kind === 'core' || plugin.manifest.scope !== input.scope) {
      return NextResponse.json({ error: '动态插件不存在' }, { status: 404 });
    }

    return await input.run();
  } catch (error) {
    return toAIRouteErrorResponse(error, input.fallbackMessage);
  }
}

export type { DynamicPluginOutput };
