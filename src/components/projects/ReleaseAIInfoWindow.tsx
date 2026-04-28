'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { openGlobalAIPanelWithReplay } from '@/components/layout/global-ai-panel';
import { AIInfoWindow } from '@/components/projects/AIInfoWindow';
import { fetchJSONWithTimeout } from '@/components/projects/ai-info-fetch';
import { ReleaseAISnapshotPanel } from '@/components/projects/ReleaseAISnapshotPanel';
import { ReleaseTaskCenter } from '@/components/projects/ReleaseTaskCenter';
import { setGlobalCopilotReplaySeed } from '@/lib/ai/copilot/context-seed';
import { buildCopilotContextMarkdown, buildCopilotReplayPayload } from '@/lib/ai/copilot/replay';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import type { ReleaseTaskCenterSnapshot } from '@/lib/ai/tasks/release-task-center';

function mergeHighlights(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].slice(0, 4);
}

function getReleaseTone(input: {
  plan: ResolvedAIPluginSnapshot<ReleasePlan> | null;
  incident: ResolvedAIPluginSnapshot<IncidentAnalysis> | null;
  tasks: ReleaseTaskCenterSnapshot | null;
}): 'healthy' | 'attention' | 'risk' | 'neutral' {
  const riskLevel = input.plan?.snapshot?.output?.risk.level ?? null;

  if (riskLevel === 'high') {
    return 'risk';
  }

  if (
    riskLevel === 'medium' ||
    (input.tasks?.actionableCount ?? 0) > 0 ||
    input.incident?.snapshot?.output?.diagnosis.category === 'migration_blocked'
  ) {
    return 'attention';
  }

  if (riskLevel === 'low' || input.incident?.snapshot?.output) {
    return 'healthy';
  }

  return 'neutral';
}

export function ReleaseAIInfoWindow(input: {
  projectId: string;
  releaseId: string;
  canManageActions: boolean;
  disabledSummary?: string | null;
  dynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
  }>;
  initialTaskCenter?: ReleaseTaskCenterSnapshot | null;
  children?: ReactNode;
}) {
  const [planPanel, setPlanPanel] = useState<ResolvedAIPluginSnapshot<ReleasePlan> | null>(null);
  const [incidentPanel, setIncidentPanel] =
    useState<ResolvedAIPluginSnapshot<IncidentAnalysis> | null>(null);
  const [taskCenter, setTaskCenter] = useState(input.initialTaskCenter ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      const method = forceRefresh ? 'POST' : 'GET';
      const timeoutMs = forceRefresh ? 45000 : 2500;

      if (forceRefresh) {
        setRefreshing(true);
      }

      try {
        const [planResult, incidentResult, tasksResult] = await Promise.all([
          fetchJSONWithTimeout<ResolvedAIPluginSnapshot<ReleasePlan>>(
            `/api/projects/${input.projectId}/releases/${input.releaseId}/ai-plan`,
            { method, timeoutMs }
          ),
          fetchJSONWithTimeout<ResolvedAIPluginSnapshot<IncidentAnalysis>>(
            `/api/projects/${input.projectId}/releases/${input.releaseId}/ai-incident`,
            { method, timeoutMs }
          ),
          fetchJSONWithTimeout<ReleaseTaskCenterSnapshot>(
            `/api/projects/${input.projectId}/releases/${input.releaseId}/tasks`,
            { timeoutMs: 2500 }
          ),
        ]);

        if (planResult.ok) {
          setPlanPanel(planResult.data);
        }

        if (incidentResult.ok) {
          setIncidentPanel(incidentResult.data);
        }

        if (tasksResult.ok) {
          setTaskCenter(tasksResult.data);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [input.projectId, input.releaseId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const bundle = useMemo(() => {
    const planOutput = planPanel?.snapshot?.output ?? null;
    const incidentOutput = incidentPanel?.snapshot?.output ?? null;
    const tone = getReleaseTone({
      plan: planPanel,
      incident: incidentPanel,
      tasks: taskCenter,
    });
    const title =
      planOutput?.recommendation.summary ??
      incidentOutput?.diagnosis.summary ??
      '正在整理当前发布状态';
    const summary =
      planOutput?.operatorNarrative ??
      incidentOutput?.operatorNarrative ??
      taskCenter?.summary ??
      '当前发布的 AI 汇总会显示在这里。';
    const risk =
      (planOutput?.risk.level && planOutput.risk.level !== 'low'
        ? planOutput.risk.primaryRisk
        : null) ??
      (incidentOutput?.diagnosis.category && incidentOutput.diagnosis.category !== 'unknown'
        ? incidentOutput.diagnosis.rootCause
        : null) ??
      null;
    const nextStep =
      (taskCenter?.actionableCount ?? 0) > 0
        ? (taskCenter?.summary ?? null)
        : (planOutput?.executionSteps.find((step) => step.required)?.step ??
          incidentOutput?.actions.manual[0]?.summary ??
          null);
    const highlights = mergeHighlights([
      (taskCenter?.actionableCount ?? 0) > 0 ? taskCenter?.summary : null,
      planOutput?.checks.find((check) => check.status !== 'pass')?.summary,
      planOutput?.recommendation.why[0],
      incidentOutput?.evidence[0]?.summary,
      incidentOutput?.actions.manual[0]?.summary,
    ]);
    const provider = planPanel?.providerStatus.provider ?? incidentPanel?.providerStatus.provider;
    const model =
      planPanel?.providerStatus.models.chat ?? incidentPanel?.providerStatus.models.chat;

    return {
      tone,
      title,
      summary,
      risk,
      nextStep,
      highlights,
      provider,
      model,
    };
  }, [incidentPanel, planPanel, taskCenter]);

  const contextCard = useMemo(
    () => ({
      scopeLabel: '当前发布',
      title: bundle.title,
      summary: bundle.summary,
      risk: bundle.risk,
      nextStep: bundle.nextStep,
      highlights: bundle.highlights,
    }),
    [bundle]
  );
  const markdown = useMemo(() => buildCopilotContextMarkdown(contextCard), [contextCard]);

  const replayPayload = useMemo(() => {
    return buildCopilotReplayPayload({
      kind: 'release',
      contextCard,
      provider: bundle.provider,
      model: bundle.model,
    });
  }, [bundle.model, bundle.provider, contextCard]);

  useEffect(() => {
    setGlobalCopilotReplaySeed(replayPayload);

    return () => {
      setGlobalCopilotReplaySeed(null);
    };
  }, [replayPayload]);

  return (
    <AIInfoWindow
      scopeLabel="当前发布"
      markdown={markdown}
      tone={bundle.tone}
      modulesLabel={
        input.dynamicPluginPanels?.length
          ? `${input.dynamicPluginPanels.length + 3} 个来源`
          : '3 个来源'
      }
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      onContinue={() => {
        openGlobalAIPanelWithReplay(replayPayload);
      }}
      detailsTitle="查看结构化分析"
    >
      <ReleaseTaskCenter
        projectId={input.projectId}
        releaseId={input.releaseId}
        canManageActions={input.canManageActions}
        disabledSummary={input.disabledSummary}
        initialSnapshot={taskCenter}
      />
      <ReleaseAISnapshotPanel
        projectId={input.projectId}
        releaseId={input.releaseId}
        releasePlan={planPanel}
        incidentAnalysis={incidentPanel}
        dynamicPluginPanels={input.dynamicPluginPanels}
      />
      {input.children}
    </AIInfoWindow>
  );
}
