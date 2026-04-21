import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const ATLAS_VERSION = process.env.ATLAS_VERSION ?? '1.1.0';
const ATLAS_DOCKER_IMAGE =
  process.env.ATLAS_DOCKER_IMAGE ?? `arigaio/atlas:${ATLAS_VERSION}-community`;

export class AtlasCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(message);
    this.name = 'AtlasCommandError';
  }
}

export function hasExecutable(command: string): boolean {
  return spawnSync(command, ['--help'], { stdio: 'ignore' }).status === 0;
}

export function hasLocalAtlas(): boolean {
  return hasExecutable('atlas');
}

export function canUseDockerAtlas(): boolean {
  return !hasLocalAtlas() && hasExecutable('docker');
}

export function normalizeAtlasDatabaseUrl(rawUrl: string): string {
  if (!canUseDockerAtlas()) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'host.docker.internal';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

interface AtlasCommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface AtlasCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  network?: string;
}

function buildDockerEnvArgs(env: Record<string, string | undefined>): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      continue;
    }

    args.push('-e', `${key}=${value}`);
  }

  return args;
}

function getAtlasCommand(
  args: string[],
  options: AtlasCommandOptions = {}
): AtlasCommandInvocation {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = {
    ...process.env,
    ...options.env,
  };

  if (hasLocalAtlas()) {
    return {
      command: 'atlas',
      args,
      cwd,
      env,
    };
  }

  if (!hasExecutable('docker')) {
    throw new Error('Atlas CLI 未安装，且当前环境没有可用的 Docker，无法执行 Atlas 命令');
  }

  const dockerArgs = ['run', '--rm', '-v', `${cwd}:/workspace`, '-w', '/workspace'];

  if (process.platform === 'linux') {
    dockerArgs.push('--add-host', 'host.docker.internal:host-gateway');
  }

  if (options.network) {
    dockerArgs.push('--network', options.network);
  }

  dockerArgs.push(...buildDockerEnvArgs(options.env ?? process.env));

  return {
    command: 'docker',
    args: [...dockerArgs, ATLAS_DOCKER_IMAGE, ...args],
    cwd,
    env,
  };
}

function emitBufferedLines(
  buffer: string,
  stream: 'stdout' | 'stderr',
  onOutputLine?: (line: string, stream: 'stdout' | 'stderr') => void
): string {
  if (!onOutputLine) {
    return buffer;
  }

  const normalized = buffer.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      onOutputLine(trimmed, stream);
    }
  }

  return remainder;
}

export async function runAtlasCommand(
  args: string[],
  options: AtlasCommandOptions & {
    onOutputLine?: (line: string, stream: 'stdout' | 'stderr') => void;
  } = {}
): Promise<{ stdout: string; stderr: string }> {
  const invocation = getAtlasCommand(args, options);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      stdoutBuffer = emitBufferedLines(stdoutBuffer, 'stdout', options.onOutputLine);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrBuffer += text;
      stderrBuffer = emitBufferedLines(stderrBuffer, 'stderr', options.onOutputLine);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (stdoutBuffer.trim().length > 0) {
        options.onOutputLine?.(stdoutBuffer.trim(), 'stdout');
      }
      if (stderrBuffer.trim().length > 0) {
        options.onOutputLine?.(stderrBuffer.trim(), 'stderr');
      }

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new AtlasCommandError(
          stderr.trim() || stdout.trim() || `Atlas command exited with code ${code ?? 'unknown'}`,
          code ?? null,
          stdout,
          stderr
        )
      );
    });
  });
}
