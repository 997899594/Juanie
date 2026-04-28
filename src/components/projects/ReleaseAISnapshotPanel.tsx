'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReleaseAIRefreshActions } from '@/components/projects/ReleaseAIRefreshActions';
import { ReleaseDynamicPluginPanel } from '@/components/projects/ReleaseDynamicPluginPanel';
import { Badge } from '@/components/ui/badge';
import { incidentIntelligenceManifest } from '@/lib/ai/plugins/incident-intelligence/manifest';
import { releaseIntelligenceManifest } from '@/lib/ai/plugins/release-intelligence/manifest';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ReleaseAISnapshotPanelProps {
  projectId: string;
  releaseId: string;
  releasePlan: ResolvedAIPluginSnapshot<ReleasePlan> | null;
  incidentAnalysis: ResolvedAIPluginSnapshot<IncidentAnalysis> | null;
  dynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
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
    <div className="rounded-[18px] bg-[rgba(15,23,42,0.035)] px-4 py-5">
      <div className="text-sm font-medium text-foreground">{emptyLabel}</div>
      <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">
        {panel.errorMessage ?? panel.availability.blockedReason ?? '无结果'}
      </div>
    </div>
  );
}

function buildUnavailableSnapshot<TOutput>(input: {
  manifest: ResolvedAIPluginSnapshot<TOutput>['manifest'];
  errorMessage: string;
}): ResolvedAIPluginSnapshot<TOutput> {
  return {
    manifest: input.manifest,
    availability: {
      enabled: false,
      providerEnabled: false,
      pluginEnabled: true,
      plan: 'free',
      requiredTier: input.manifest.tier,
      blockedReason: input.errorMessage,
    },
    snapshot: null,
    source: 'none',
    stale: false,
    providerStatus: {
      provider: '302.ai',
      configured: false,
      enabled: false,
      models: {
        chat: '',
        toolCalling: '',
        pro: '',
        json: '',
      },
    },
    errorMessage: input.errorMessage,
  };
}

export function ReleaseAISnapshotPanel(props: ReleaseAISnapshotPanelProps) {
  const [releasePlanPanel, setReleasePlanPanel] = useState(props.releasePlan);
  const [incidentPanel, setIncidentPanel] = useState(props.incidentAnalysis);
  const [loading, setLoading] = useState(!props.releasePlan || !props.incidentAnalysis);
  const shellClassName =
    'rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)] ring-1 ring-[rgba(15,23,42,0.06)]';
  const subCardClassName = 'rounded-[18px] bg-[rgba(15,23,42,0.035)] px-4 py-4';
  const releasePlanSnapshot = releasePlanPanel?.snapshot?.output ?? null;
  const incidentSnapshot = incidentPanel?.snapshot?.output ?? null;

  const loadCachedAnalysis = useCallback(async () => {
    setLoading(true);

    try {
      const [planResponse, incidentResponse] = await Promise.all([
        fetch(`/api/projects/${props.projectId}/releases/${props.releaseId}/ai-plan`),
        fetch(`/api/projects/${props.projectId}/releases/${props.releaseId}/ai-incident`),
      ]);

      const [planData, incidentData] = await Promise.all([
        planResponse.json().catch(() => null),
        incidentResponse.json().catch(() => null),
      ]);

      if (!planResponse.ok) {
        const message =
          planData &&
          typeof planData === 'object' &&
          'error' in planData &&
          typeof planData.error === 'string'
            ? planData.error
            : '发布计划加载失败';
        setReleasePlanPanel(
          buildUnavailableSnapshot({
            manifest: releaseIntelligenceManifest,
            errorMessage: message,
          })
        );
      } else {
        setReleasePlanPanel(planData as ResolvedAIPluginSnapshot<ReleasePlan>);
      }

      if (!incidentResponse.ok) {
        const message =
          incidentData &&
          typeof incidentData === 'object' &&
          'error' in incidentData &&
          typeof incidentData.error === 'string'
            ? incidentData.error
            : '故障归因加载失败';
        setIncidentPanel(
          buildUnavailableSnapshot({
            manifest: incidentIntelligenceManifest,
            errorMessage: message,
          })
        );
      } else {
        setIncidentPanel(incidentData as ResolvedAIPluginSnapshot<IncidentAnalysis>);
      }
    } finally {
      setLoading(false);
    }
  }, [props.projectId, props.releaseId]);

  useEffect(() => {
    setReleasePlanPanel(props.releasePlan);
  }, [props.releasePlan]);

  useEffect(() => {
    setIncidentPanel(props.incidentAnalysis);
  }, [props.incidentAnalysis]);

  useEffect(() => {
    if (!props.releasePlan || !props.incidentAnalysis) {
      void loadCachedAnalysis();
    }
  }, [props.incidentAnalysis, props.releasePlan, loadCachedAnalysis]);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={shellClassName}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">发布计划</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReleaseAIRefreshActions
                projectId={props.projectId}
                releaseId={props.releaseId}
                refreshPage={false}
                onRefreshed={loadCachedAnalysis}
              />
              {releasePlanPanel ? (
                <>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {getSourceLabel(releasePlanPanel.source, releasePlanPanel.stale)}
                  </Badge>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {releasePlanPanel.availability.plan}
                  </Badge>
                </>
              ) : null}
            </div>
          </div>

          {loading && !releasePlanPanel ? (
            <div className="text-sm text-[rgba(15,23,42,0.48)]">分析中…</div>
          ) : releasePlanPanel && releasePlanSnapshot ? (
            <div className="space-y-4">
              {releasePlanPanel.errorMessage && (
                <div className={subCardClassName}>{releasePlanPanel.errorMessage}</div>
              )}
              <div className={subCardClassName}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {releasePlanSnapshot.recommendation.strategy}
                  </Badge>
                  <Badge
                    variant={getRiskBadgeVariant(releasePlanSnapshot.risk.level)}
                    className="rounded-full border-0 shadow-none"
                  >
                    {releasePlanSnapshot.risk.level}
                  </Badge>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {releasePlanSnapshot.recommendation.confidence}
                  </Badge>
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">
                  {releasePlanSnapshot.recommendation.summary}
                </div>
                <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">
                  {releasePlanSnapshot.operatorNarrative}
                </div>
                <div className="mt-3 text-xs text-[rgba(15,23,42,0.42)]">
                  {formatPlatformDateTime(releasePlanPanel.snapshot?.generatedAt) ?? '—'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                  检查
                </div>
                {releasePlanSnapshot.checks.slice(0, 4).map((check) => (
                  <div key={check.key} className={subCardClassName}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{check.label}</div>
                      <Badge
                        variant={getCheckBadgeVariant(check.status)}
                        className="rounded-full border-0 shadow-none"
                      >
                        {check.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-[rgba(15,23,42,0.56)]">{check.summary}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={subCardClassName}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                    步骤
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[rgba(15,23,42,0.56)]">
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                    回滚
                  </div>
                  <div className="mt-3 text-sm text-foreground">
                    {releasePlanSnapshot.rollbackPlan.summary}
                  </div>
                  {releasePlanSnapshot.rollbackPlan.target && (
                    <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">
                      {releasePlanSnapshot.rollbackPlan.target}
                    </div>
                  )}
                  {releasePlanSnapshot.rollbackPlan.triggerSignals.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {releasePlanSnapshot.rollbackPlan.triggerSignals.slice(0, 4).map((signal) => (
                        <Badge
                          key={signal}
                          className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none"
                        >
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            renderUnavailableState(
              releasePlanPanel ??
                buildUnavailableSnapshot({
                  manifest: releaseIntelligenceManifest,
                  errorMessage: '没有发布计划',
                }),
              '没有发布计划'
            )
          )}
        </div>

        <div className={shellClassName}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">故障归因</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {incidentPanel ? (
                <>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {getSourceLabel(incidentPanel.source, incidentPanel.stale)}
                  </Badge>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {incidentPanel.availability.plan}
                  </Badge>
                </>
              ) : null}
            </div>
          </div>

          {loading && !incidentPanel ? (
            <div className="text-sm text-[rgba(15,23,42,0.48)]">分析中…</div>
          ) : incidentPanel && incidentSnapshot ? (
            <div className="space-y-4">
              {incidentPanel.errorMessage && (
                <div className={subCardClassName}>{incidentPanel.errorMessage}</div>
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
                    className="rounded-full border-0 shadow-none"
                  >
                    {incidentSnapshot.diagnosis.confidence}
                  </Badge>
                  <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.62)] shadow-none">
                    {incidentSnapshot.diagnosis.category}
                  </Badge>
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">
                  {incidentSnapshot.diagnosis.summary}
                </div>
                <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">
                  {incidentSnapshot.diagnosis.rootCause}
                </div>
                <div className="mt-3 text-xs text-[rgba(15,23,42,0.42)]">
                  {formatPlatformDateTime(incidentPanel.snapshot?.generatedAt) ?? '—'}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={subCardClassName}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                    过程
                  </div>
                  <div className="mt-3 space-y-3">
                    {incidentSnapshot.causalChain.slice(0, 4).map((item, index) => (
                      <div key={`${item.at ?? 'na'}:${item.event}:${index}`} className="text-sm">
                        <div className="font-medium text-foreground">{item.event}</div>
                        <div className="mt-1 text-[rgba(15,23,42,0.56)]">{item.impact}</div>
                        {item.at && (
                          <div className="mt-1 text-xs text-[rgba(15,23,42,0.42)]">{item.at}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={subCardClassName}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                    证据
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[rgba(15,23,42,0.56)]">
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
            renderUnavailableState(
              incidentPanel ??
                buildUnavailableSnapshot({
                  manifest: incidentIntelligenceManifest,
                  errorMessage: '没有归因',
                }),
              '没有归因'
            )
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
