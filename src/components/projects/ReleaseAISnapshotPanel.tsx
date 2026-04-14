import { ReleaseAIRefreshActions } from '@/components/projects/ReleaseAIRefreshActions';
import { Badge } from '@/components/ui/badge';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ReleaseAISnapshotPanelProps {
  projectId: string;
  releaseId: string;
  releasePlan: ResolvedAIPluginSnapshot<ReleasePlan>;
  incidentAnalysis: ResolvedAIPluginSnapshot<IncidentAnalysis>;
}

function getSourceLabel(source: ResolvedAIPluginSnapshot['source'], stale: boolean): string {
  if (source === 'fresh') {
    return '最新';
  }

  if (stale) {
    return '历史';
  }

  if (source === 'cache') {
    return '缓存';
  }

  return '未生成';
}

function getRiskBadgeVariant(
  level: 'low' | 'medium' | 'high'
): 'outline' | 'warning' | 'destructive' {
  if (level === 'high') {
    return 'destructive';
  }

  if (level === 'medium') {
    return 'warning';
  }

  return 'outline';
}

function getCheckBadgeVariant(
  status: 'pass' | 'warning' | 'blocked'
): 'success' | 'warning' | 'destructive' {
  if (status === 'blocked') {
    return 'destructive';
  }

  if (status === 'warning') {
    return 'warning';
  }

  return 'success';
}

function renderUnavailableState(panel: ResolvedAIPluginSnapshot, emptyLabel: string) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-5">
      <div className="text-sm font-medium text-foreground">{emptyLabel}</div>
      <div className="mt-2 text-sm text-muted-foreground">
        {panel.errorMessage ?? panel.availability.blockedReason ?? '无结果'}
      </div>
    </div>
  );
}

export function ReleaseAISnapshotPanel(props: ReleaseAISnapshotPanelProps) {
  const releasePlanSnapshot = props.releasePlan.snapshot?.output ?? null;
  const incidentSnapshot = props.incidentAnalysis.snapshot?.output ?? null;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="console-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">发布计划</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReleaseAIRefreshActions projectId={props.projectId} releaseId={props.releaseId} />
            <Badge variant="outline">
              {getSourceLabel(props.releasePlan.source, props.releasePlan.stale)}
            </Badge>
            <Badge variant="outline">{props.releasePlan.availability.plan}</Badge>
          </div>
        </div>

        {releasePlanSnapshot ? (
          <div className="space-y-4">
            {props.releasePlan.errorMessage && (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                {props.releasePlan.errorMessage}
              </div>
            )}
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{releasePlanSnapshot.recommendation.strategy}</Badge>
                <Badge variant={getRiskBadgeVariant(releasePlanSnapshot.risk.level)}>
                  {releasePlanSnapshot.risk.level}
                </Badge>
                <Badge variant="outline">{releasePlanSnapshot.recommendation.confidence}</Badge>
              </div>
              <div className="mt-3 text-sm font-medium text-foreground">
                {releasePlanSnapshot.recommendation.summary}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {releasePlanSnapshot.operatorNarrative}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {formatPlatformDateTime(props.releasePlan.snapshot?.generatedAt) ?? '—'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                检查
              </div>
              {releasePlanSnapshot.checks.slice(0, 4).map((check) => (
                <div
                  key={check.key}
                  className="rounded-2xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{check.label}</div>
                    <Badge variant={getCheckBadgeVariant(check.status)}>{check.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{check.summary}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  步骤
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {releasePlanSnapshot.executionSteps.slice(0, 5).map((step, index) => (
                    <div key={`${step.type}:${step.step}`} className="flex gap-2">
                      <span className="text-foreground">{index + 1}.</span>
                      <span>
                        {step.step}
                        {!step.required && '（可选）'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  回滚
                </div>
                <div className="mt-3 text-sm text-foreground">
                  {releasePlanSnapshot.rollbackPlan.summary}
                </div>
                {releasePlanSnapshot.rollbackPlan.target && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {releasePlanSnapshot.rollbackPlan.target}
                  </div>
                )}
                {releasePlanSnapshot.rollbackPlan.triggerSignals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {releasePlanSnapshot.rollbackPlan.triggerSignals.slice(0, 4).map((signal) => (
                      <Badge key={signal} variant="outline">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          renderUnavailableState(props.releasePlan, '没有发布计划')
        )}
      </div>

      <div className="console-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">故障归因</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {getSourceLabel(props.incidentAnalysis.source, props.incidentAnalysis.stale)}
            </Badge>
            <Badge variant="outline">{props.incidentAnalysis.availability.plan}</Badge>
          </div>
        </div>

        {incidentSnapshot ? (
          <div className="space-y-4">
            {props.incidentAnalysis.errorMessage && (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                {props.incidentAnalysis.errorMessage}
              </div>
            )}
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={getRiskBadgeVariant(
                    incidentSnapshot.diagnosis.confidence === 'high'
                      ? 'high'
                      : incidentSnapshot.diagnosis.confidence === 'medium'
                        ? 'medium'
                        : 'low'
                  )}
                >
                  {incidentSnapshot.diagnosis.confidence}
                </Badge>
                <Badge variant="outline">{incidentSnapshot.diagnosis.category}</Badge>
              </div>
              <div className="mt-3 text-sm font-medium text-foreground">
                {incidentSnapshot.diagnosis.summary}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {incidentSnapshot.diagnosis.rootCause}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {formatPlatformDateTime(props.incidentAnalysis.snapshot?.generatedAt) ?? '—'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  过程
                </div>
                <div className="mt-3 space-y-3">
                  {incidentSnapshot.causalChain.slice(0, 4).map((item, index) => (
                    <div key={`${item.at ?? 'na'}:${item.event}:${index}`} className="text-sm">
                      <div className="font-medium text-foreground">{item.event}</div>
                      <div className="mt-1 text-muted-foreground">{item.impact}</div>
                      {item.at && (
                        <div className="mt-1 text-xs text-muted-foreground">{item.at}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  证据
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {incidentSnapshot.evidence.slice(0, 5).map((item, index) => (
                    <div key={`${item.source}:${index}`}>
                      <span className="font-medium text-foreground">{item.source}</span>
                      {' · '}
                      {item.summary}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                动作
              </div>
              <div className="mt-3 space-y-3">
                {incidentSnapshot.actions.safe.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-foreground">可直接执行</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {incidentSnapshot.actions.safe.map((action) => (
                        <Badge key={action.key} variant="outline">
                          {action.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {incidentSnapshot.actions.manual.length > 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {incidentSnapshot.actions.manual.slice(0, 4).map((action, index) => (
                      <div key={`${action.label}:${index}`}>
                        <span className="font-medium text-foreground">{action.label}</span>
                        {' · '}
                        {action.summary}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {incidentSnapshot.operatorNarrative}
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderUnavailableState(props.incidentAnalysis, '没有归因')
        )}
      </div>
    </section>
  );
}
