import { ReleaseAIRefreshActions } from '@/components/projects/ReleaseAIRefreshActions';
import { ReleaseDynamicPluginPanel } from '@/components/projects/ReleaseDynamicPluginPanel';
import { Badge } from '@/components/ui/badge';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ReleaseAISnapshotPanelProps {
  projectId: string;
  releaseId: string;
  releasePlan: ResolvedAIPluginSnapshot<ReleasePlan>;
  incidentAnalysis: ResolvedAIPluginSnapshot<IncidentAnalysis>;
  dynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput>;
  }>;
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
): 'secondary' | 'warning' | 'destructive' {
  if (level === 'high') {
    return 'destructive';
  }

  if (level === 'medium') {
    return 'warning';
  }

  return 'secondary';
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
    <div className="rounded-[20px] bg-[rgba(243,240,233,0.7)] px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]">
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
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';
  const subCardClassName =
    'rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={shellClassName}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">发布计划</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReleaseAIRefreshActions projectId={props.projectId} releaseId={props.releaseId} />
              <Badge variant="secondary">
                {getSourceLabel(props.releasePlan.source, props.releasePlan.stale)}
              </Badge>
              <Badge variant="secondary">{props.releasePlan.availability.plan}</Badge>
            </div>
          </div>

          {releasePlanSnapshot ? (
            <div className="space-y-4">
              {props.releasePlan.errorMessage && (
                <div className={subCardClassName}>{props.releasePlan.errorMessage}</div>
              )}
              <div className={subCardClassName}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{releasePlanSnapshot.recommendation.strategy}</Badge>
                  <Badge variant={getRiskBadgeVariant(releasePlanSnapshot.risk.level)}>
                    {releasePlanSnapshot.risk.level}
                  </Badge>
                  <Badge variant="secondary">{releasePlanSnapshot.recommendation.confidence}</Badge>
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
                  <div key={check.key} className={subCardClassName}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{check.label}</div>
                      <Badge variant={getCheckBadgeVariant(check.status)}>{check.status}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{check.summary}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={subCardClassName}>
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
                <div className={subCardClassName}>
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
                        <Badge key={signal} variant="secondary">
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

        <div className={shellClassName}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">故障归因</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {getSourceLabel(props.incidentAnalysis.source, props.incidentAnalysis.stale)}
              </Badge>
              <Badge variant="secondary">{props.incidentAnalysis.availability.plan}</Badge>
            </div>
          </div>

          {incidentSnapshot ? (
            <div className="space-y-4">
              {props.incidentAnalysis.errorMessage && (
                <div className={subCardClassName}>{props.incidentAnalysis.errorMessage}</div>
              )}
              <div className={subCardClassName}>
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
                  <Badge variant="secondary">{incidentSnapshot.diagnosis.category}</Badge>
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
                <div className={subCardClassName}>
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
                <div className={subCardClassName}>
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

              <div className={subCardClassName}>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  动作
                </div>
                <div className="mt-3 space-y-3">
                  {incidentSnapshot.actions.safe.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground">可直接执行</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {incidentSnapshot.actions.safe.map((action) => (
                          <Badge key={action.key} variant="secondary">
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
      </div>

      {props.dynamicPluginPanels && props.dynamicPluginPanels.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {props.dynamicPluginPanels.map((panel) => (
            <ReleaseDynamicPluginPanel
              key={panel.pluginId}
              projectId={props.projectId}
              releaseId={props.releaseId}
              pluginId={panel.pluginId}
              initialPanel={panel.snapshot}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
