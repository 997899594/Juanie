'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { openGlobalAIPanelWithReplay } from '@/components/layout/global-ai-panel';
import { AIInfoWindow } from '@/components/projects/AIInfoWindow';
import { fetchJSONWithTimeout } from '@/components/projects/ai-info-fetch';
import { EnvironmentAISummaryPanel } from '@/components/projects/EnvironmentAISummaryPanel';
import { EnvironmentDynamicPluginPanel } from '@/components/projects/EnvironmentDynamicPluginPanel';
import { EnvironmentEnvvarRiskPanel } from '@/components/projects/EnvironmentEnvvarRiskPanel';
import { EnvironmentMigrationReviewPanel } from '@/components/projects/EnvironmentMigrationReviewPanel';
import { EnvironmentTaskCenter } from '@/components/projects/EnvironmentTaskCenter';
import { setGlobalCopilotReplaySeed } from '@/lib/ai/copilot/context-seed';
import { buildCopilotContextMarkdown, buildCopilotReplayPayload } from '@/lib/ai/copilot/replay';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';
import type { EnvironmentTaskCenterSnapshot } from '@/lib/ai/tasks/environment-task-center';

function mergeHighlights(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].slice(0, 4);
}

function getEnvironmentTone(input: {
  summary: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
  migration: ResolvedAIPluginSnapshot<MigrationReview> | null;
  envvar: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
}): 'healthy' | 'attention' | 'risk' | 'neutral' {
  const states = [
    input.summary?.snapshot?.output?.headline.status,
    input.migration?.snapshot?.output?.headline.status,
    input.envvar?.snapshot?.output?.headline.status,
  ];

  if (states.includes('risk')) {
    return 'risk';
  }

  if (states.includes('attention')) {
    return 'attention';
  }

  if (states.includes('healthy')) {
    return 'healthy';
  }

  return 'neutral';
}

export function EnvironmentAIInfoWindow(input: {
  projectId: string;
  environmentId: string;
  initialAiSummary?: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
  initialMigrationReview?: ResolvedAIPluginSnapshot<MigrationReview> | null;
  initialEnvvarRisk?: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
  initialTaskCenter?: EnvironmentTaskCenterSnapshot | null;
  initialDynamicPluginPanels?: Array<{
    pluginId: string;
    snapshot: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
  }>;
}) {
  const [summaryPanel, setSummaryPanel] = useState(input.initialAiSummary ?? null);
  const [migrationPanel, setMigrationPanel] = useState(input.initialMigrationReview ?? null);
  const [envvarPanel, setEnvvarPanel] = useState(input.initialEnvvarRisk ?? null);
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
        const [summaryResult, migrationResult, envvarResult, tasksResult] = await Promise.all([
          fetchJSONWithTimeout<ResolvedAIPluginSnapshot<EnvironmentSummary>>(
            `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-summary`,
            { method, timeoutMs }
          ),
          fetchJSONWithTimeout<ResolvedAIPluginSnapshot<MigrationReview>>(
            `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-migration-review`,
            { method, timeoutMs }
          ),
          fetchJSONWithTimeout<ResolvedAIPluginSnapshot<EnvvarRisk>>(
            `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-envvar-risk`,
            { method, timeoutMs }
          ),
          fetchJSONWithTimeout<EnvironmentTaskCenterSnapshot>(
            `/api/projects/${input.projectId}/environments/${input.environmentId}/tasks`,
            { timeoutMs: 2500 }
          ),
        ]);

        if (summaryResult.ok) {
          setSummaryPanel(summaryResult.data);
        }

        if (migrationResult.ok) {
          setMigrationPanel(migrationResult.data);
        }

        if (envvarResult.ok) {
          setEnvvarPanel(envvarResult.data);
        }

        if (tasksResult.ok) {
          setTaskCenter(tasksResult.data);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [input.environmentId, input.projectId]
  );

  useEffect(() => {
    if (
      !input.initialAiSummary ||
      !input.initialMigrationReview ||
      !input.initialEnvvarRisk ||
      !input.initialTaskCenter
    ) {
      void load(false);
    }
  }, [
    input.initialAiSummary,
    input.initialEnvvarRisk,
    input.initialMigrationReview,
    input.initialTaskCenter,
    load,
  ]);

  const bundle = useMemo(() => {
    const summaryOutput = summaryPanel?.snapshot?.output ?? null;
    const migrationOutput = migrationPanel?.snapshot?.output ?? null;
    const envvarOutput = envvarPanel?.snapshot?.output ?? null;
    const tone = getEnvironmentTone({
      summary: summaryPanel,
      migration: migrationPanel,
      envvar: envvarPanel,
    });
    const title =
      summaryOutput?.headline.summary ??
      migrationOutput?.headline.summary ??
      envvarOutput?.headline.summary ??
      '正在整理当前环境状态';
    const summary =
      summaryOutput?.operatorNarrative ??
      migrationOutput?.operatorNarrative ??
      envvarOutput?.operatorNarrative ??
      taskCenter?.summary ??
      '当前环境的 AI 汇总会显示在这里。';
    const risk =
      (migrationOutput?.headline.status && migrationOutput.headline.status !== 'healthy'
        ? migrationOutput.headline.summary
        : null) ??
      (envvarOutput?.headline.status && envvarOutput.headline.status !== 'healthy'
        ? envvarOutput.headline.summary
        : null) ??
      null;
    const nextStep =
      migrationOutput?.headline.nextAction ??
      envvarOutput?.headline.nextAction ??
      summaryOutput?.headline.nextAction ??
      null;
    const highlights = mergeHighlights([
      taskCenter?.actionableCount ? taskCenter.summary : null,
      ...(summaryOutput?.focusPoints ?? []),
      migrationOutput?.migration.summary,
      envvarOutput?.coverage.summary,
      migrationOutput?.schema.summary,
    ]);
    const provider =
      summaryPanel?.providerStatus.provider ?? migrationPanel?.providerStatus.provider;
    const model =
      summaryPanel?.providerStatus.models.chat ?? migrationPanel?.providerStatus.models.chat;

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
  }, [envvarPanel, migrationPanel, summaryPanel, taskCenter]);

  const contextCard = useMemo(
    () => ({
      scopeLabel: '当前环境',
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
      kind: 'environment',
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
      scopeLabel="当前环境"
      markdown={markdown}
      tone={bundle.tone}
      modulesLabel={
        input.initialDynamicPluginPanels?.length
          ? `${input.initialDynamicPluginPanels.length + 4} 个来源`
          : '4 个来源'
      }
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      onContinue={() => {
        openGlobalAIPanelWithReplay(replayPayload);
      }}
      detailsTitle="查看结构化分析"
    >
      <EnvironmentTaskCenter
        projectId={input.projectId}
        environmentId={input.environmentId}
        initialSnapshot={taskCenter}
      />
      <EnvironmentAISummaryPanel
        projectId={input.projectId}
        environmentId={input.environmentId}
        initialPanel={summaryPanel}
      />
      <section className="grid gap-3 lg:grid-cols-2">
        <EnvironmentMigrationReviewPanel
          projectId={input.projectId}
          environmentId={input.environmentId}
          initialPanel={migrationPanel}
        />
        <EnvironmentEnvvarRiskPanel
          projectId={input.projectId}
          environmentId={input.environmentId}
          initialPanel={envvarPanel}
        />
      </section>
      {input.initialDynamicPluginPanels && input.initialDynamicPluginPanels.length > 0 ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {input.initialDynamicPluginPanels.map((panel) => (
            <EnvironmentDynamicPluginPanel
              key={panel.pluginId}
              projectId={input.projectId}
              environmentId={input.environmentId}
              pluginId={panel.pluginId}
              initialPanel={panel.snapshot}
            />
          ))}
        </section>
      ) : null}
    </AIInfoWindow>
  );
}
