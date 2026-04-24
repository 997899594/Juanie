import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  gateway,
  getTeamIntegrationSession,
  type IntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import {
  getRepositoryDefaultBranch,
  requireProjectRepositoryContext,
} from '@/lib/projects/context';

const execFileAsync = promisify(execFile);

const SOURCE_WORKSPACE_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
]);

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export interface SourceWorkspaceContext {
  tempRoot: string;
  repoDir: string;
  revision: string;
  cleanup: () => Promise<void>;
}

export type WorkspaceFileSnapshot = Map<string, Buffer>;

async function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<void> {
  await execFileAsync(command, args, {
    cwd: options?.cwd,
    env: options?.env,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function normalizeRevisionRef(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('refs/')) {
    return normalized;
  }

  if (COMMIT_SHA_PATTERN.test(normalized)) {
    return normalized;
  }

  return `refs/heads/${normalized}`;
}

async function resolveWorkspaceRevision(input: {
  session: IntegrationSession;
  repoFullName: string;
  requestedRevision: string;
}): Promise<string> {
  const normalizedRef = normalizeRevisionRef(input.requestedRevision);
  if (!normalizedRef) {
    return input.requestedRevision;
  }

  try {
    return (
      (await gateway.resolveRefToCommitSha(input.session, input.repoFullName, normalizedRef)) ??
      input.requestedRevision
    );
  } catch {
    return input.requestedRevision;
  }
}

async function materializeRepositoryWorkspaceFromArchive(input: {
  session: IntegrationSession;
  repoFullName: string;
  revision: string;
  tempRoot: string;
  repoDir: string;
}): Promise<string> {
  const resolvedRevision = await resolveWorkspaceRevision({
    session: input.session,
    repoFullName: input.repoFullName,
    requestedRevision: input.revision,
  });
  const archive = await gateway.downloadRepositoryArchive(
    input.session,
    input.repoFullName,
    resolvedRevision
  );
  const archivePath = path.join(input.tempRoot, 'source.tar.gz');

  await writeFile(archivePath, archive);
  await runCommand('tar', ['-xzf', archivePath, '-C', input.repoDir, '--strip-components=1'], {
    cwd: input.tempRoot,
  });
  await rm(archivePath, { force: true }).catch(() => {});

  return resolvedRevision;
}

export async function createRepositorySourceWorkspace(input: {
  session: IntegrationSession;
  repoFullName: string;
  defaultBranch?: string | null;
  revision?: string | null;
}): Promise<SourceWorkspaceContext> {
  const requestedRevision =
    input.revision?.trim() || getRepositoryDefaultBranch({ defaultBranch: input.defaultBranch });
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'juanie-source-workspace-'));
  const repoDir = path.join(tempRoot, 'repo');

  await mkdir(repoDir, { recursive: true });

  try {
    const resolvedRevision = await materializeRepositoryWorkspaceFromArchive({
      session: input.session,
      repoFullName: input.repoFullName,
      revision: requestedRevision,
      tempRoot,
      repoDir,
    });

    return {
      tempRoot,
      repoDir,
      revision: resolvedRevision,
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
      },
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function createProjectSourceWorkspace(input: {
  projectId: string;
  revision?: string | null;
  actingUserId?: string | null;
  requiredCapabilities?: Array<'read_repo' | 'write_repo'>;
}): Promise<SourceWorkspaceContext> {
  const { project, repository } = await requireProjectRepositoryContext(input.projectId, {
    projectNotFound: '项目缺少仓库绑定，无法准备源码工作区',
    repositoryMissing: '项目缺少仓库绑定，无法准备源码工作区',
  });

  const session = await getTeamIntegrationSession({
    integrationId: repository.providerId,
    teamId: project.teamId,
    actingUserId: input.actingUserId ?? null,
    requiredCapabilities: input.requiredCapabilities ?? ['read_repo'],
  });

  return createRepositorySourceWorkspace({
    session,
    repoFullName: repository.fullName,
    defaultBranch: getRepositoryDefaultBranch(repository),
    revision: input.revision,
  });
}

export async function collectWorkspaceFileSnapshot(
  repoDir: string,
  options?: {
    ignoredDirs?: Iterable<string>;
  }
): Promise<WorkspaceFileSnapshot> {
  const ignoredDirs = new Set(options?.ignoredDirs ?? SOURCE_WORKSPACE_IGNORED_DIRS);
  const snapshot: WorkspaceFileSnapshot = new Map();

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(repoDir, absolutePath).replaceAll('\\', '/');

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      snapshot.set(relativePath, await readFile(absolutePath));
    }
  }

  await walk(repoDir);
  return snapshot;
}

function computeLineDiffStats(before: string, after: string): { added: number; removed: number } {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const previous = new Array<number>(afterLines.length + 1).fill(0);
  const current = new Array<number>(afterLines.length + 1).fill(0);

  for (let beforeIndex = 1; beforeIndex <= beforeLines.length; beforeIndex += 1) {
    current[0] = 0;

    for (let afterIndex = 1; afterIndex <= afterLines.length; afterIndex += 1) {
      if (beforeLines[beforeIndex - 1] === afterLines[afterIndex - 1]) {
        current[afterIndex] = previous[afterIndex - 1]! + 1;
      } else {
        current[afterIndex] = Math.max(previous[afterIndex]!, current[afterIndex - 1]!);
      }
    }

    for (let afterIndex = 0; afterIndex <= afterLines.length; afterIndex += 1) {
      previous[afterIndex] = current[afterIndex]!;
    }
  }

  const commonLineCount = previous[afterLines.length] ?? 0;
  return {
    added: Math.max(0, afterLines.length - commonLineCount),
    removed: Math.max(0, beforeLines.length - commonLineCount),
  };
}

export function buildWorkspaceDiffSummary(
  before: WorkspaceFileSnapshot,
  after: WorkspaceFileSnapshot
): {
  changedFiles: string[];
  fileStats: Array<{
    file: string;
    added: number;
    removed: number;
  }>;
} {
  const changedFiles = Array.from(new Set([...before.keys(), ...after.keys()]))
    .filter((file) => {
      const previous = before.get(file);
      const next = after.get(file);

      if (!previous || !next) {
        return previous !== next;
      }

      return !previous.equals(next);
    })
    .sort((left, right) => left.localeCompare(right));

  return {
    changedFiles,
    fileStats: changedFiles.map((file) => {
      const previous = before.get(file);
      const next = after.get(file);

      if (!previous) {
        return {
          file,
          added: next ? next.toString('utf8').split('\n').length : 0,
          removed: 0,
        };
      }

      if (!next) {
        return {
          file,
          added: 0,
          removed: previous.toString('utf8').split('\n').length,
        };
      }

      const stats = computeLineDiffStats(previous.toString('utf8'), next.toString('utf8'));
      return {
        file,
        added: stats.added,
        removed: stats.removed,
      };
    }),
  };
}

export async function collectWorkspaceArtifactFiles(
  repoDir: string,
  changedFiles: string[]
): Promise<Record<string, string>> {
  const artifactFiles: Record<string, string> = {};

  for (const file of changedFiles) {
    const absolutePath = path.join(repoDir, file);

    try {
      artifactFiles[file] = await readFile(absolutePath, 'utf8');
    } catch {}
  }

  return artifactFiles;
}
