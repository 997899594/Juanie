import { createHash } from 'node:crypto';
import type { JuanieConfig } from '@/lib/config/parser';
import { parseJuanieConfig } from '@/lib/config/parser';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

const canonicalConfigPath = 'juanie.yml';

export interface RepositoryJuanieConfig {
  path: typeof canonicalConfigPath;
  sourceCommitSha: string;
  digest: string;
  content: string;
  config: JuanieConfig;
}

export async function readRepositoryJuanieConfig(input: {
  repository: string;
  sourceCommitSha: string;
  getFileContent: (path: string, ref: string) => Promise<string | null>;
}): Promise<RepositoryJuanieConfig> {
  const content = await input.getFileContent(canonicalConfigPath, input.sourceCommitSha);

  if (!content) {
    throw new Error(
      `${canonicalConfigPath} was not found in ${input.repository} at ${input.sourceCommitSha}`
    );
  }

  const parsed = parseJuanieConfig(content);
  if (!parsed.isValid) {
    throw new Error(
      `Invalid ${canonicalConfigPath} at ${input.sourceCommitSha}: ${parsed.errors.join('; ')}`
    );
  }

  const { isValid: _isValid, errors: _errors, warnings: _warnings, ...config } = parsed;

  return {
    path: canonicalConfigPath,
    sourceCommitSha: input.sourceCommitSha,
    digest: createHash('sha256').update(content, 'utf8').digest('hex'),
    content,
    config,
  };
}

export async function loadRepositoryJuanieConfig(input: {
  teamId: string;
  repository: string;
  sourceCommitSha?: string | null;
  sourceRef?: string | null;
}): Promise<RepositoryJuanieConfig> {
  const session = await getTeamIntegrationSession({
    teamId: input.teamId,
    requiredCapabilities: ['read_repo'],
  });

  const sourceCommitSha =
    input.sourceCommitSha ??
    (input.sourceRef
      ? await gateway.resolveRefToCommitSha(session, input.repository, input.sourceRef)
      : null);

  if (!sourceCommitSha) {
    throw new Error(`Could not resolve an immutable config revision for ${input.repository}`);
  }

  return readRepositoryJuanieConfig({
    repository: input.repository,
    sourceCommitSha,
    getFileContent: (path, ref) => gateway.getFileContent(session, input.repository, path, ref),
  });
}
