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

interface ReleasePromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotePlan: Awaited<ReturnType<typeof getProjectReleasesPageData>>['promotePlan'];
  promoteAI: Awaited<ReturnType<typeof getProjectReleasesPageData>>['promoteAI'];
  canPromote: boolean;
  promoting: boolean;
  onPromote: () => void;
}

export function ReleasePromoteDialog({
  open,
  onOpenChange,
  promotePlan,
  promoteAI,
  canPromote,
  promoting,
  onPromote,
}: ReleasePromoteDialogProps) {
  const promotePanel = promotePlan
    ? buildReleasePlanningPanel({
        plan: promotePlan.plan,
        sourceCommitSha: promotePlan.sourceRelease?.sourceCommitSha,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-5 sm:px-6">
          <DialogTitle>发布到生产</DialogTitle>
          <DialogDescription>
            平台会先沿用 staging 成功版本，再按 preflight 结果创建生产 release。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-border bg-secondary/20 p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">提升来源</div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    生产发布会直接沿用 staging 成功版本，避免重复构建和环境偏差。
                  </div>
                </div>

                {promotePlan?.sourceRelease ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl border border-border bg-background px-4 py-3">
                      <div className="text-xs text-muted-foreground">来源 release</div>
                      <div className="mt-1 text-foreground">
                        {promotePlan.sourceRelease.summary ?? '沿用最近一次 staging 成功版本'}
                      </div>
                      {promotePlan.sourceRelease.sourceCommitSha && (
                        <code className="mt-2 inline-flex rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
                          {promotePlan.sourceRelease.sourceCommitSha.slice(0, 12)}
                        </code>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground">
                    当前没有可提升到生产的 staging 成功版本。
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-border bg-background p-4 sm:p-5">
                <div className="mb-3 space-y-1">
                  <div className="text-sm font-semibold text-foreground">生产预检</div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    平台会先检查审批、环境保护和迁移风险，再决定是否允许创建生产 release。
                  </div>
                </div>

                {promotePanel ? (
                  <div className="space-y-3">
                    <PlatformSignalChipList chips={promotePanel.chips} />
                    <PlatformSignalSummary
                      summary={promotePanel.issueSummary}
                      nextActionLabel={promotePanel.nextActionLabel}
                    />

                    {promoteAI?.summary && (
                      <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {promoteAI.strategy && (
                            <Badge variant="outline">{getStrategyLabel(promoteAI.strategy)}</Badge>
                          )}
                          {promoteAI.riskLevel && (
                            <Badge variant="outline">{getAILevelLabel(promoteAI.riskLevel)}</Badge>
                          )}
                          {promoteAI.confidence && (
                            <Badge variant="outline">{promoteAI.confidence} 置信度</Badge>
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
                            AI 更新时间：{formatPlatformDateTime(promoteAI.generatedAt) ?? '—'}
                            {promoteAI.stale ? ' · 使用历史 snapshot' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {promotePanel.blockingReason && (
                      <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                        {promotePanel.blockingReason}
                      </div>
                    )}

                    {!promoteAI?.summary && promoteAI?.errorMessage && (
                      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        AI 建议暂不可用：{promoteAI.errorMessage}
                      </div>
                    )}

                    {!promotePanel.blockingReason && promotePanel.warningChips.length > 0 && (
                      <PlatformSignalChipList chips={promotePanel.warningChips} />
                    )}

                    {promoteAI?.checks.length ? (
                      <div className="space-y-2 rounded-2xl border border-border bg-background px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          AI 重点检查
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
                  <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-8 text-sm text-muted-foreground">
                    正在加载发布预检...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 bg-background px-4 py-4 sm:px-6">
          <Button
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          <Button
            className="w-full rounded-xl sm:w-auto"
            onClick={onPromote}
            disabled={promoting || !canPromote}
          >
            {promoting ? '发布中...' : '确认发布'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
