import { Badge } from '@/components/ui/badge';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview';
import {
  getMigrationApprovalPolicyLabel,
  getMigrationCompatibilityLabel,
  getMigrationExecutionModeLabel,
  getMigrationLockStrategyLabel,
  getMigrationPhaseLabel,
  getSchemaSourceLabel,
} from '@/lib/migrations/presentation';
import { usesPlatformInternalCommand } from '@/lib/migrations/schema-source';

export interface MigrationSpecDetailsValue {
  source?: string | null;
  tool: string;
  phase: string;
  command: string;
  sourceConfigPath?: string | null;
  executionMode?: string | null;
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
  const isInternalCommand = usesPlatformInternalCommand(specification.command);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">{getSchemaSourceLabel(specification.source)}</div>
        <Badge variant="secondary">{getMigrationPhaseLabel(specification.phase)}</Badge>
        <Badge variant="secondary">
          {getMigrationExecutionModeLabel(specification.executionMode)}
        </Badge>
        {specification.compatibility === 'breaking' ? (
          <Badge variant="destructive">
            {getMigrationCompatibilityLabel(specification.compatibility)}
          </Badge>
        ) : null}
      </div>

      <div
        className={
          compact ? 'grid gap-2 text-xs sm:grid-cols-2' : 'grid gap-2 text-xs md:grid-cols-2'
        }
      >
        <div className="rounded-[16px] bg-[rgba(255,255,255,0.88)] px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.025)]">
          <div className="text-muted-foreground">执行引擎</div>
          <code className="mt-1 block break-all text-foreground">
            {getSchemaSourceLabel(specification.tool)}
          </code>
        </div>
        <div className="rounded-[16px] bg-[rgba(255,255,255,0.88)] px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.025)]">
          <div className="text-muted-foreground">Schema 配置</div>
          <code className="mt-1 block break-all text-foreground">
            {specification.sourceConfigPath ?? '平台自动推断'}
          </code>
        </div>
        <div className="rounded-[16px] bg-[rgba(255,255,255,0.88)] px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.025)]">
          <div className="text-muted-foreground">审批策略</div>
          <div className="mt-1 text-foreground">
            {getMigrationApprovalPolicyLabel(specification.approvalPolicy)}
          </div>
        </div>
        <div className="rounded-[16px] bg-[rgba(255,255,255,0.88)] px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.025)]">
          <div className="text-muted-foreground">锁策略</div>
          <div className="mt-1 text-foreground">
            {getMigrationLockStrategyLabel(specification.lockStrategy)}
          </div>
        </div>
      </div>

      {(specification.migrationPath || !isInternalCommand) && (
        <div className="rounded-2xl bg-[rgba(243,240,233,0.68)] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {specification.migrationPath ? <span>派生迁移目录</span> : null}
            {!isInternalCommand ? <span>执行命令</span> : null}
          </div>
          {specification.migrationPath ? (
            <code className="mt-1 block break-all text-xs text-foreground">
              {resolveMigrationPath(specification.migrationPath, databaseType)}
            </code>
          ) : null}
          {!isInternalCommand ? (
            <code className="mt-2 block break-all text-xs text-foreground">
              {specification.command}
            </code>
          ) : null}
        </div>
      )}

      {specification.filePreview && (
        <div className="rounded-2xl bg-[rgba(243,240,233,0.68)] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>执行预览</span>
            <span>{specification.filePreview.sourceLabel}</span>
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
