import { Badge } from '@/components/ui/badge';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview';
import {
  getMigrationApprovalPolicyLabel,
  getMigrationCompatibilityLabel,
  getMigrationExecutionModeLabel,
  getMigrationLockStrategyLabel,
  getMigrationPhaseLabel,
} from '@/lib/migrations/presentation';

export interface MigrationSpecDetailsValue {
  tool: string;
  phase: string;
  command: string;
  executionMode?: string | null;
  workingDirectory?: string | null;
  migrationPath?: string | null;
  compatibility?: string | null;
  approvalPolicy?: string | null;
  lockStrategy?: string | null;
  filePreview?: MigrationFilePreviewSnapshot | null;
}

interface MigrationSpecDetailsProps {
  specification: MigrationSpecDetailsValue;
  databaseType?: string | null;
  compact?: boolean;
}

function resolveMigrationPath(value?: string | null, databaseType?: string | null): string {
  if (value && value.trim().length > 0) {
    return value;
  }

  if (databaseType && databaseType.trim().length > 0) {
    return `migrations/${databaseType}`;
  }

  return '未设置';
}

export function MigrationSpecDetails({
  specification,
  databaseType,
  compact = false,
}: MigrationSpecDetailsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">{specification.tool}</div>
        <Badge variant="outline">{getMigrationPhaseLabel(specification.phase)}</Badge>
        <Badge variant="secondary">
          {getMigrationExecutionModeLabel(specification.executionMode)}
        </Badge>
        {specification.compatibility === 'breaking' ? (
          <Badge variant="destructive">
            {getMigrationCompatibilityLabel(specification.compatibility)}
          </Badge>
        ) : null}
      </div>

      <div className="console-surface rounded-2xl px-3 py-2">
        <code className="break-all text-xs">{specification.command}</code>
      </div>

      <div
        className={
          compact ? 'grid gap-2 text-xs sm:grid-cols-2' : 'grid gap-2 text-xs md:grid-cols-2'
        }
      >
        <div className="console-card rounded-xl px-2.5 py-2">
          <div className="text-muted-foreground">工作目录</div>
          <code className="mt-1 block break-all text-foreground">
            {specification.workingDirectory ?? '.'}
          </code>
        </div>
        <div className="console-card rounded-xl px-2.5 py-2">
          <div className="text-muted-foreground">迁移路径</div>
          <code className="mt-1 block break-all text-foreground">
            {resolveMigrationPath(specification.migrationPath, databaseType)}
          </code>
        </div>
        <div className="console-card rounded-xl px-2.5 py-2">
          <div className="text-muted-foreground">审批策略</div>
          <div className="mt-1 text-foreground">
            {getMigrationApprovalPolicyLabel(specification.approvalPolicy)}
          </div>
        </div>
        <div className="console-card rounded-xl px-2.5 py-2">
          <div className="text-muted-foreground">锁策略</div>
          <div className="mt-1 text-foreground">
            {getMigrationLockStrategyLabel(specification.lockStrategy)}
          </div>
        </div>
      </div>

      {specification.filePreview && (
        <div className="console-surface rounded-2xl px-3 py-2">
          <div className="text-xs text-muted-foreground">
            迁移文件预览 · {specification.filePreview.sourceLabel}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            待执行 {specification.filePreview.total} · 已执行{' '}
            {specification.filePreview.executedTotal} · 声明{' '}
            {specification.filePreview.declaredTotal}
          </div>
          {specification.filePreview.files.length > 0 ? (
            <div className="mt-2 space-y-1">
              {specification.filePreview.files.map((file) => (
                <div key={file} className="break-all font-mono text-xs text-foreground">
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">没有待执行迁移文件。</div>
          )}
          {specification.filePreview.truncated && (
            <div className="mt-2 text-xs text-muted-foreground">
              文件较多，仅展示前 {specification.filePreview.files.length} 项。
            </div>
          )}
          {specification.filePreview.warning && (
            <div className="mt-2 text-xs text-warning">{specification.filePreview.warning}</div>
          )}
        </div>
      )}
    </div>
  );
}
