'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSignalBlock, PlatformSignalChipList } from '@/components/ui/platform-signals';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import type { getProjectReleasesPageData } from '@/lib/releases/service';
import { formatPlatformDateTime } from '@/lib/time/format';
import { cn } from '@/lib/utils';

const dialogPanelClassName =
  'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)] sm:p-6';
const dialogSubtleClassName =
  'rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

function getStrategyLabel(
  strategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null
): string | null {
  switch (strategy) {
    case 'rolling':
      return '滚动发布';
    case 'controlled':
      return '受控放量';
    case 'canary':
      return '金丝雀';
    case 'blue_green':
      return '蓝绿切换';
    default:
      return null;
  }
}

function getAILevelLabel(level?: 'low' | 'medium' | 'high' | null): string | null {
  switch (level) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
    default:
      return null;
  }
}

function getPromotionStrategyLabel(
  strategy?: 'reuse_release_artifacts' | 'rebuild_from_ref' | null
): string | null {
  switch (strategy) {
    case 'reuse_release_artifacts':
      return '复用已有制品';
    case 'rebuild_from_ref':
      return '重新构建';
    default:
      return null;
  }
}

interface ReleasePromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionPlans: Awaited<ReturnType<typeof getProjectReleasesPageData>>['promotionPlans'];
  selectedFlowId: string | null;
  onSelectedFlowIdChange: (flowId: string | null) => void;
  canPromote: boolean;
  promoting: boolean;
  loadingPlan?: boolean;
  planError?: string | null;
  onPromote: () => void;
}

export function ReleasePromoteDialog({
  open,
  onOpenChange,
  promotionPlans,
  selectedFlowId,
  onSelectedFlowIdChange,
  canPromote,
  promoting,
  loadingPlan = false,
  planError = null,
  onPromote,
}: ReleasePromoteDialogProps) {
  const selectedPlan =
    promotionPlans.find((plan) => plan.flowId === selectedFlowId) ?? promotionPlans[0] ?? null;
  const selectedFlowValue = selectedPlan?.flowId ?? '__default__';
  const promoteAI = selectedPlan?.ai ?? null;
  const promotePanel = selectedPlan
    ? buildReleasePlanningPanel({
        plan: selectedPlan.plan,
        sourceCommitSha: selectedPlan.sourceRelease?.sourceCommitSha,
      })
    : null;
  const schemaRefresh = selectedPlan?.plan.schema.refresh ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="workspace" layout="workspace">
        <DialogHeader chrome>
          <DialogTitle>提升到 {selectedPlan?.targetEnvironment?.name ?? '目标环境'}</DialogTitle>
          <DialogDescription>
            沿着已配置的提升链路复用制品或重新构建，避免环境之间的代码漂移。
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="text-sm font-semibold text-foreground">提升配置</div>

                {promotionPlans.length > 1 ? (
                  <div className="mt-4">
                    <Select
                      value={selectedFlowValue}
                      onValueChange={(value) =>
                        onSelectedFlowIdChange(value === '__default__' ? null : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择提升链路" />
                      </SelectTrigger>
                      <SelectContent>
                        {promotionPlans.map((plan) => (
                          <SelectItem
                            key={plan.flowId ?? '__default__'}
                            value={plan.flowId ?? '__default__'}
                          >
                            {(plan.sourceEnvironment?.name ?? '来源环境') +
                              ' -> ' +
                              (plan.targetEnvironment?.name ?? '目标环境')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {selectedPlan ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                        {selectedPlan.sourceEnvironment?.name ?? '来源环境'}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                        {selectedPlan.targetEnvironment?.name ?? '目标环境'}
                      </Badge>
                      {getPromotionStrategyLabel(selectedPlan.strategy) ? (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                          {getPromotionStrategyLabel(selectedPlan.strategy)}
                        </Badge>
                      ) : null}
                      {selectedPlan.requiresApproval ? (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                          需要审批
                        </Badge>
                      ) : null}
                    </div>

                    {selectedPlan.sourceRelease ? (
                      <div className={dialogSubtleClassName}>
                        <div className="text-xs text-muted-foreground">来源发布</div>
                        <div className="mt-1 text-foreground">
                          {selectedPlan.sourceRelease.summary ??
                            `最近一次 ${selectedPlan.sourceEnvironment?.name ?? '来源环境'} 成功版本`}
                        </div>
                        {selectedPlan.sourceRelease.sourceCommitSha && (
                          <code className="mt-2 inline-flex rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
                            {selectedPlan.sourceRelease.sourceCommitSha.slice(0, 12)}
                          </code>
                        )}
                      </div>
                    ) : (
                      <div className={cn(dialogSubtleClassName, 'text-sm text-muted-foreground')}>
                        {selectedPlan.sourceEnvironment?.name ?? '来源环境'} 暂无可复用的成功发布。
                      </div>
                    )}

                    <div className={dialogSubtleClassName}>
                      <div className="text-xs text-muted-foreground">目标环境</div>
                      <div className="mt-1 text-foreground">
                        {selectedPlan.targetEnvironment?.name ?? '目标环境'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="没有可用的提升链路" className="mt-4 min-h-40 rounded-[20px]" />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className={dialogPanelClassName}>
                <div className="mb-3 text-sm font-semibold text-foreground">检查</div>

                {loadingPlan ? (
                  <EmptyState
                    title="正在读取提升计划"
                    description="先展示持久门禁快照，Schema 深度检查会在后台继续刷新。"
                    className="min-h-40 rounded-[20px]"
                  />
                ) : planError ? (
                  <div className={cn(dialogSubtleClassName, 'text-sm text-destructive')}>
                    {planError}
                  </div>
                ) : promotePanel ? (
                  <div className="space-y-3">
                    <PlatformSignalBlock
                      chips={promotePanel.chips}
                      summary={promotePanel.issueSummary}
                      nextActionLabel={promotePanel.nextActionLabel}
                      summaryClassName="rounded-[20px]"
                    />

                    {schemaRefresh?.missingCount ? (
                      <div className={cn(dialogSubtleClassName, 'text-sm text-muted-foreground')}>
                        还有 {schemaRefresh.missingCount}{' '}
                        个数据库尚无持久检查结果；创建发布时会强校验。
                      </div>
                    ) : null}

                    {promoteAI?.summary && (
                      <div className={dialogSubtleClassName}>
                        <div className="flex flex-wrap items-center gap-2">
                          {promoteAI.strategy && (
                            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                              {getStrategyLabel(promoteAI.strategy)}
                            </Badge>
                          )}
                          {promoteAI.riskLevel && (
                            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                              {getAILevelLabel(promoteAI.riskLevel)}
                            </Badge>
                          )}
                          {promoteAI.confidence && (
                            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                              {promoteAI.confidence}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {promoteAI.summary}
                        </div>
                        {promoteAI.reasons.length > 0 && (
                          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                            {promoteAI.reasons.map((reason) => (
                              <div key={reason}>• {reason}</div>
                            ))}
                          </div>
                        )}
                        {promoteAI.generatedAt && (
                          <div className="mt-3 text-[11px] text-muted-foreground">
                            {formatPlatformDateTime(promoteAI.generatedAt) ?? '—'}
                            {promoteAI.stale ? ' · 历史' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {!promoteAI?.summary && promoteAI?.errorMessage && (
                      <div className={cn(dialogSubtleClassName, 'text-sm text-muted-foreground')}>
                        {promoteAI.errorMessage}
                      </div>
                    )}

                    {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={promotePanel.warningChips} />
                    )}

                    {promoteAI?.checks.length ? (
                      <div className={cn(dialogSubtleClassName, 'space-y-2')}>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          检查
                        </div>
                        {promoteAI.checks.map((check) => (
                          <div key={check.key} className="text-sm">
                            <div className="font-medium text-foreground">{check.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {check.summary}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="没有可用检查"
                    description="当前没有可执行的提升链路，先在环境治理里配置来源和目标环境。"
                    className="min-h-40 rounded-[20px]"
                  />
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter chrome>
          <Button
            variant="ghost"
            className="w-full rounded-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full rounded-full sm:w-auto"
            onClick={onPromote}
            disabled={promoting || loadingPlan || !canPromote}
          >
            {promoting ? '创建中...' : loadingPlan ? '预检中...' : '确认提升'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
