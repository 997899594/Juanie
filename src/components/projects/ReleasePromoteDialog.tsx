'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlatformSignalChipList, PlatformSignalSummary } from '@/components/ui/platform-signals';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="workspace"
        className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
      >
        <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
          <DialogTitle>提升到 {selectedPlan?.targetEnvironment?.name ?? '目标环境'}</DialogTitle>
          <DialogDescription>
            沿着已配置的提升链路复用制品或重新构建，避免环境之间的代码漂移。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="ui-control p-4 sm:p-5">
                <div className="text-sm font-semibold text-foreground">提升链路</div>

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
                      <Badge variant="outline">
                        {selectedPlan.sourceEnvironment?.name ?? '来源环境'}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline">
                        {selectedPlan.targetEnvironment?.name ?? '目标环境'}
                      </Badge>
                      {getPromotionStrategyLabel(selectedPlan.strategy) ? (
                        <Badge variant="outline">
                          {getPromotionStrategyLabel(selectedPlan.strategy)}
                        </Badge>
                      ) : null}
                      {selectedPlan.requiresApproval ? (
                        <Badge variant="outline">需要审批</Badge>
                      ) : null}
                    </div>

                    {selectedPlan.sourceRelease ? (
                      <div className="ui-control-muted px-4 py-3">
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
                      <div className="ui-control-muted px-4 py-3 text-sm text-muted-foreground">
                        {selectedPlan.sourceEnvironment?.name ?? '来源环境'} 暂无可复用的成功发布。
                      </div>
                    )}

                    <div className="ui-control-muted px-4 py-3">
                      <div className="text-xs text-muted-foreground">目标环境</div>
                      <div className="mt-1 text-foreground">
                        {selectedPlan.targetEnvironment?.name ?? '目标环境'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ui-control-muted mt-4 px-4 py-8 text-sm text-muted-foreground">
                    没有可用的提升链路。
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="ui-control-muted p-4 sm:p-5">
                <div className="mb-3 text-sm font-semibold text-foreground">检查</div>

                {promotePanel ? (
                  <div className="space-y-3">
                    <PlatformSignalChipList chips={promotePanel.chips} />
                    <PlatformSignalSummary
                      summary={promotePanel.issueSummary}
                      nextActionLabel={promotePanel.nextActionLabel}
                    />

                    {promoteAI?.summary && (
                      <div className="ui-control px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {promoteAI.strategy && (
                            <Badge variant="outline">{getStrategyLabel(promoteAI.strategy)}</Badge>
                          )}
                          {promoteAI.riskLevel && (
                            <Badge variant="outline">{getAILevelLabel(promoteAI.riskLevel)}</Badge>
                          )}
                          {promoteAI.confidence && (
                            <Badge variant="outline">{promoteAI.confidence}</Badge>
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

                    {promotePanel.blockingReason && (
                      <div className="ui-control bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
                        {promotePanel.blockingReason}
                      </div>
                    )}

                    {!promoteAI?.summary && promoteAI?.errorMessage && (
                      <div className="ui-control-muted px-4 py-3 text-sm text-muted-foreground">
                        {promoteAI.errorMessage}
                      </div>
                    )}

                    {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={promotePanel.warningChips} />
                    )}

                    {promoteAI?.checks.length ? (
                      <div className="ui-control-muted space-y-2 px-4 py-3">
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
                  <div className="ui-control px-4 py-8 text-sm text-muted-foreground">
                    加载中...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={onPromote}
            disabled={promoting || !canPromote}
          >
            {promoting ? '提升中...' : '确认提升'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
