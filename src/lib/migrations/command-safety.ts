import type { MigrationSpecificationRecord } from './types';

export interface MigrationCommandSafetySnapshot {
  blocksExecution: boolean;
  summary: string | null;
}

function includesPattern(command: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(command));
}

export function assessMigrationCommandSafety(
  specification: Pick<MigrationSpecificationRecord, 'tool' | 'command'>
): MigrationCommandSafetySnapshot {
  const command = specification.command.trim();

  if (!command) {
    return {
      blocksExecution: true,
      summary: '迁移命令为空，平台无法执行。',
    };
  }

  const genericInteractivePatterns = [
    /\bread\s+/i,
    /\bselect\s+/i,
    /\binquirer\b/i,
    /\bprompt\b/i,
    /\b--interactive\b/i,
    /\s-it(\s|$)/i,
  ];

  if (includesPattern(command, genericInteractivePatterns)) {
    return {
      blocksExecution: true,
      summary: '迁移命令包含交互式输入，平台不会执行可能卡住的命令。',
    };
  }

  if (
    specification.tool === 'drizzle' &&
    includesPattern(command, [/\bdb:push\b/i, /\bdrizzle-kit\s+push\b/i])
  ) {
    return {
      blocksExecution: true,
      summary: 'Drizzle push 可能触发交互确认，平台要求改成非交互迁移命令后再执行。',
    };
  }

  if (
    specification.tool === 'prisma' &&
    includesPattern(command, [/\bprisma\s+migrate\s+dev\b/i, /\bprisma\s+migrate\s+reset\b/i])
  ) {
    return {
      blocksExecution: true,
      summary: 'Prisma dev/reset 会进入交互模式，平台要求改成非交互迁移命令。',
    };
  }

  return {
    blocksExecution: false,
    summary: null,
  };
}
