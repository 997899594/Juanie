import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import { buildAuthenticatedCloneUrl } from '@/lib/git/authenticated-clone-url';
import {
  gateway,
  getTeamIntegrationSession,
  type IntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

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
const GITHUB_SOURCE_WORKSPACE_BLOB_CONCURRENCY = 8;

export interface SourceWorkspaceContext {
  tempRoot: string;
  repoDir: string;
  revision: string;
  cleanup: () => Promise<void>;
}

export type WorkspaceFileSnapshot = Map<string, Buffer>;

interface GitHubTreeEntry {
  path?: string | null;
  type?: 'blob' | 'tree' | 'commit' | null;
  sha?: string | null;
}

interface GitHubTreeResponse {
  truncated?: boolean;
  tree?: GitHubTreeEntry[];
}

interface GitHubBlobResponse {
  content?: string;
  encoding?: string;
}

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

function normalizeGitFetchRef(value: string): string {
  const normalized = value.trim();
  if (normalized.startsWith('refs/heads/')) {
    return normalized.slice('refs/heads/'.length);
  }

  if (normalized.startsWith('refs/tags/')) {
    return normalized.slice('refs/tags/'.length);
  }

  return normalized;
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

function parseGitHubRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository full name: ${repoFullName}`);
  }

  return { owner, repo };
}

async function requestGitHubJson<T>(
  accessToken: string,
  repoFullName: string,
  pathname: string,
  searchParams?: Record<string, string>
): Promise<T> {
  const { owner, repo } = parseGitHubRepoFullName(repoFullName);
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}${pathname}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const message = (await response.text()).trim() || response.statusText;
    throw new Error(`GitHub API request failed: ${message}`);
  }

  return (await response.json()) as T;
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

async function materializeGitHubRepositoryWorkspaceWithApi(input: {
  session: IntegrationSession;
  repoFullName: string;
  revision: string;
  repoDir: string;
}): Promise<string> {
  const resolvedRevision = await resolveWorkspaceRevision({
    session: input.session,
    repoFullName: input.repoFullName,
    requestedRevision: input.revision,
  });
  const treeResponse = await requestGitHubJson<GitHubTreeResponse>(
    input.session.accessToken,
    input.repoFullName,
    `/git/trees/${encodeURIComponent(resolvedRevision)}`,
    {
      recursive: '1',
    }
  );

  if (treeResponse.truncated) {
    throw new Error('GitHub 仓库树过大，当前无法完整物化源码工作区');
  }

  const blobEntries = (treeResponse.tree ?? []).filter(
    (entry): entry is Required<Pick<GitHubTreeEntry, 'path' | 'sha'>> & GitHubTreeEntry =>
      entry.type === 'blob' && Boolean(entry.path) && Boolean(entry.sha)
  );

  for (
    let startIndex = 0;
    startIndex < blobEntries.length;
    startIndex += GITHUB_SOURCE_WORKSPACE_BLOB_CONCURRENCY
  ) {
    const batch = blobEntries.slice(
      startIndex,
      startIndex + GITHUB_SOURCE_WORKSPACE_BLOB_CONCURRENCY
    );

    await Promise.all(
      batch.map(async (entry) => {
        const filePath = entry.path;
        if (!filePath) {
          return;
        }

        const blob = await requestGitHubJson<GitHubBlobResponse>(
          input.session.accessToken,
          input.repoFullName,
          `/git/blobs/${entry.sha}`
        );

        if (blob.encoding !== 'base64' || typeof blob.content !== 'string') {
          throw new Error(`GitHub blob ${filePath} 返回了不支持的编码`);
        }

        const absolutePath = path.join(input.repoDir, filePath);
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, Buffer.from(blob.content.replaceAll('\n', ''), 'base64'));
      })
    );
  }

  return resolvedRevision;
}

async function materializeRepositoryWorkspaceWithGit(input: {
  session: IntegrationSession;
  repoFullName: string;
  revision: string;
  repoDir: string;
}): Promise<string> {
  const remoteUrl = buildAuthenticatedCloneUrl({
    cloneUrl: null,
    fullName: input.repoFullName,
    provider: input.session.provider,
    accessToken: input.session.accessToken,
    serverUrl: input.session.serverUrl,
  });
  const gitEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };

  await runCommand('git', ['init'], {
    cwd: input.repoDir,
    env: gitEnv,
  });
  await runCommand('git', ['remote', 'add', 'origin', remoteUrl], {
    cwd: input.repoDir,
    env: gitEnv,
  });
  await runCommand(
    'git',
    ['fetch', '--depth', '1', '--no-tags', 'origin', normalizeGitFetchRef(input.revision)],
    {
      cwd: input.repoDir,
      env: gitEnv,
    }
  );
  await runCommand('git', ['checkout', '--force', '--detach', 'FETCH_HEAD'], {
    cwd: input.repoDir,
    env: gitEnv,
  });

  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: input.repoDir,
    env: gitEnv,
    maxBuffer: 1024 * 1024,
  });

  await rm(path.join(input.repoDir, '.git'), { recursive: true, force: true }).catch(() => {});

  return stdout.trim();
}

export async function createRepositorySourceWorkspace(input: {
  session: IntegrationSession;
  repoFullName: string;
  defaultBranch?: string | null;
  revision?: string | null;
}): Promise<SourceWorkspaceContext> {
  const requestedRevision = input.revision?.trim() || input.defaultBranch || 'main';
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'juanie-source-workspace-'));
  const repoDir = path.join(tempRoot, 'repo');

  await mkdir(repoDir, { recursive: true });

  try {
    const resolvedRevision =
      input.session.provider === 'github'
        ? await materializeGitHubRepositoryWorkspaceWithApi({
            session: input.session,
            repoFullName: input.repoFullName,
            revision: requestedRevision,
            repoDir,
          })
        : await materializeRepositoryWorkspaceWithGit({
            session: input.session,
            repoFullName: input.repoFullName,
            revision: requestedRevision,
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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });

  if (!project?.repositoryId) {
    throw new Error('项目缺少仓库绑定，无法准备源码工作区');
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repository) {
    throw new Error('仓库不存在，无法准备源码工作区');
  }

  const session = await getTeamIntegrationSession({
    integrationId: repository.providerId,
    teamId: project.teamId,
    actingUserId: input.actingUserId ?? null,
    requiredCapabilities: input.requiredCapabilities ?? ['read_repo'],
  });

  return createRepositorySourceWorkspace({
    session,
    repoFullName: repository.fullName,
    defaultBranch: repository.defaultBranch || 'main',
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
