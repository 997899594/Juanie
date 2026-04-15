import { PlatformSignalChipList } from '@/components/ui/platform-signals';
import type { ProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

interface ProjectGovernancePanelProps {
  governance: ProjectGovernanceSnapshot;
}

export function ProjectGovernancePanel({ governance }: ProjectGovernancePanelProps) {
  return (
    <div className="space-y-4">
      <div className="console-surface rounded-2xl px-4 py-3">
        <div className="text-sm font-medium">{governance.primarySummary}</div>
        <div className="mt-1 text-xs text-muted-foreground">{governance.roleLabel}</div>
      </div>

      <PlatformSignalChipList chips={governance.signals} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {governance.capabilities.map((capability) => (
          <div key={capability.key} className="console-card bg-secondary/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className={
                  capability.allowed
                    ? 'h-2 w-2 rounded-full bg-success'
                    : 'h-2 w-2 rounded-full bg-destructive'
                }
              />
              <div className="text-sm font-medium">{capability.label}</div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{capability.summary}</div>
          </div>
        ))}
      </div>

      <div className="console-grid-table">
        <div className="console-grid-table-head grid grid-cols-[minmax(0,1fr)_72px_72px_72px] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <div>项目能力</div>
          <div className="text-center">Owner</div>
          <div className="text-center">Admin</div>
          <div className="text-center">Member</div>
        </div>
        {governance.matrix.map((row) => (
          <div
            key={row.key}
            className="console-grid-table-row grid grid-cols-[minmax(0,1fr)_72px_72px_72px] px-4 py-3 text-sm"
          >
            <div>{row.label}</div>
            <div className="text-center">{row.owner ? '✓' : '—'}</div>
            <div className="text-center">{row.admin ? '✓' : '—'}</div>
            <div className="text-center">{row.member ? '✓' : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
