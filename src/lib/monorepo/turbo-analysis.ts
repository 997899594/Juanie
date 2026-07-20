import type { JuanieConfig } from '@/lib/config/parser';

export const turboQueryVersion = '2.10.5' as const;

export interface TurboAnalysisPolicy {
  mode: 'turbo';
  engineVersion: typeof turboQueryVersion;
  task: string;
  useTaskInputs: boolean;
}

export type BuildAnalysisPolicy =
  | TurboAnalysisPolicy
  | { mode: 'full'; reason: string }
  | { mode: 'manual' };

export function getBuildAnalysisPolicy(
  config: Pick<JuanieConfig, 'monorepo'>,
  input: { beforeSha?: string | null; forceFullBuild?: boolean }
): BuildAnalysisPolicy {
  if (input.forceFullBuild) return { mode: 'full', reason: 'forced' };
  if (!input.beforeSha || /^0+$/u.test(input.beforeSha)) {
    return { mode: 'full', reason: 'missing_base' };
  }
  if (!config.monorepo) return { mode: 'full', reason: 'single_repository' };

  const affected = config.monorepo.affected;
  if (affected?.strategy === 'all') return { mode: 'full', reason: 'configured_full' };
  if (affected?.strategy === 'manual') return { mode: 'manual' };

  return {
    mode: 'turbo',
    engineVersion: turboQueryVersion,
    task: affected?.task ?? 'build',
    useTaskInputs: affected?.useTaskInputs ?? false,
  };
}
