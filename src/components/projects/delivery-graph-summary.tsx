import { Boxes, Cable, Library, PackageCheck, Server } from 'lucide-react';
import type { DeliveryGraph, DeliveryGraphSummary } from '@/lib/delivery-graph/model';

interface DeliveryGraphSummaryViewProps {
  graph: DeliveryGraph;
  summary: DeliveryGraphSummary;
}

const metrics = [
  { key: 'workloads', label: '运行单元', icon: Server },
  { key: 'artifacts', label: '构建制品', icon: PackageCheck },
  { key: 'libraries', label: '依赖库', icon: Library },
  { key: 'resources', label: '资源', icon: Cable },
] as const;

export function DeliveryGraphSummaryView({ graph, summary }: DeliveryGraphSummaryViewProps) {
  const counts = {
    workloads: summary.workloadCount,
    artifacts: summary.artifactCount,
    libraries: summary.libraryCount,
    resources: summary.managedResourceCount + summary.externalResourceCount,
  };
  const managedResources = graph.resources.filter((resource) => resource.management === 'managed');
  const externalResources = graph.resources.filter(
    (resource) => resource.management === 'external'
  );

  return (
    <section className="border-y border-border/70 py-5">
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4" />
        <h2 className="text-sm font-semibold">交付拓扑</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {metrics.map(({ key, label, icon: Icon }) => (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{counts[key]}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">将运行</div>
          <div className="mt-1 font-medium">
            {graph.workloads.map((workload) => workload.name).join('、') || '无'}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">将保留</div>
          <div className="mt-1 font-medium">
            {graph.artifacts.map((artifact) => artifact.name).join('、') || '无额外制品'}
          </div>
        </div>
        {managedResources.length > 0 ? (
          <div>
            <div className="text-xs text-muted-foreground">平台资源</div>
            <div className="mt-1 font-medium">
              {managedResources.map((resource) => resource.name).join('、')}
            </div>
          </div>
        ) : null}
        {externalResources.length > 0 ? (
          <div>
            <div className="text-xs text-muted-foreground">外部绑定</div>
            <div className="mt-1 font-medium">
              {externalResources.map((resource) => resource.name).join('、')}
            </div>
          </div>
        ) : null}
      </div>

      {graph.warnings.length > 0 ? (
        <div className="mt-4 space-y-1 border-l-2 border-amber-500 pl-3 text-xs text-muted-foreground">
          {graph.warnings.map((warning) => (
            <p key={`${warning.code}:${warning.nodeId}`}>{warning.message}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
