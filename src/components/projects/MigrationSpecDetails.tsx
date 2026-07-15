import { Badge } from '@/components/ui/badge';
import type {
  MigrationFilePreviewDetail,
  MigrationFilePreviewSnapshot,
} from '@/lib/migrations/file-preview';
import {
  getMigrationApprovalPolicyLabel,
  getMigrationCompatibilityLabel,
  getMigrationExecutionModeLabel,
  getMigrationLockStrategyLabel,
  getMigrationPhaseLabel,
  getSchemaSourceLabel,
} from '@/lib/migrations/presentation';
import { getMigrationReleaseStageLabel } from '@/lib/migrations/release-graph';
import { usesPlatformInternalCommand } from '@/lib/migrations/schema-source';

export interface MigrationSpecDetailsValue {
  source?: string | null;
  tool: string;
  phase: string;
  releaseStage?: string | null;
  stageOrder?: number | null;
  targetVersion?: string | null;
  baselineVersion?: string | null;
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

function getCodeLanguageLabel(language: MigrationFilePreviewDetail['language']): string {
  if (language === 'sql') return 'SQL';
  if (language === 'typescript') return 'TypeScript';
  if (language === 'javascript') return 'JavaScript';
  return 'Text';
}

export function MigrationSpecDetails({
  specification,
  databaseType,
  compact = false,
}: MigrationSpecDetailsProps) {
  const isInternalCommand = usesPlatformInternalCommand(specification.command);
  const filePreview = specification.filePreview;
  const pendingFileCount = filePreview?.total ?? 0;
  const hasPendingChanges = pendingFileCount > 0;
  const hasExecutionPlan = Boolean(filePreview?.executionPlan?.content?.trim());
  const hasFileDetails = (filePreview?.fileDetails?.length ?? 0) > 0;
  const hasFileList = (filePreview?.files?.length ?? 0) > 0;
  const hasAuditablePreview = hasExecutionPlan || hasFileDetails || hasFileList;
  const previewTitle = hasPendingChanges
    ? filePreview?.sourceLabel === 'Atlas schema diff'
      ? '执行计划'
      : '执行预览'
    : hasAuditablePreview
      ? '历史内容'
      : '已对齐';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">{getSchemaSourceLabel(specification.source)}</div>
        <Badge variant="secondary">
          {specification.releaseStage && specification.releaseStage !== 'standard'
            ? getMigrationReleaseStageLabel(specification.releaseStage)
            : getMigrationPhaseLabel(specification.phase)}
        </Badge>
        {specification.targetVersion ? (
          <Badge variant="outline">Atlas {specification.targetVersion}</Badge>
        ) : null}
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

      {filePreview && (
        <div className="rounded-2xl bg-[rgba(243,240,233,0.68)] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{previewTitle}</span>
            <span>{filePreview.sourceLabel}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            待执行 {filePreview.total} · 已执行 {filePreview.executedTotal} · 声明{' '}
            {filePreview.declaredTotal}
          </div>
          {hasExecutionPlan && filePreview?.executionPlan ? (
            <div className="mt-3">
              <details
                className="rounded-[14px] bg-[rgba(255,255,255,0.9)] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_8px_20px_rgba(55,53,47,0.03)]"
                open
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-foreground">
                  <span className="min-w-0 break-all font-mono">
                    {filePreview.executionPlan.path}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    SQL
                  </span>
                </summary>
                <pre className="max-h-80 overflow-auto border-t border-border/70 px-3 py-3 text-xs leading-relaxed text-foreground">
                  <code>{filePreview.executionPlan.content}</code>
                </pre>
              </details>
            </div>
          ) : hasFileDetails && filePreview?.fileDetails ? (
            <div className="mt-3 space-y-3">
              {filePreview.fileDetails.map((file) => (
                <details
                  key={file.path}
                  className="rounded-[14px] bg-[rgba(255,255,255,0.9)] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_8px_20px_rgba(55,53,47,0.03)]"
                  open={filePreview.fileDetails!.length === 1}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-foreground">
                    <span className="min-w-0 break-all font-mono">{file.path}</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {getCodeLanguageLabel(file.language)}
                    </span>
                  </summary>
                  <pre className="max-h-80 overflow-auto border-t border-border/70 px-3 py-3 text-xs leading-relaxed text-foreground">
                    <code>{file.content}</code>
                  </pre>
                  {file.truncated && (
                    <div className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
                      内容较长，已截断展示。
                    </div>
                  )}
                </details>
              ))}
            </div>
          ) : hasFileList && filePreview?.files ? (
            <div className="mt-2 space-y-1">
              {filePreview.files.map((file) => (
                <div key={file} className="break-all font-mono text-xs text-foreground">
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">
              {filePreview?.total === 0 && filePreview?.declaredTotal > 0
                ? '数据库已与期望 schema 对齐，无需迁移。'
                : '没有待执行迁移文件。'}
            </div>
          )}
          {hasPendingChanges && filePreview.truncated && (
            <div className="mt-2 text-xs text-muted-foreground">
              文件较多，仅展示前 {filePreview.files.length} 项。
            </div>
          )}
          {filePreview.warning && (
            <div className="mt-2 text-xs text-warning">{filePreview.warning}</div>
          )}
        </div>
      )}
    </div>
  );
}
