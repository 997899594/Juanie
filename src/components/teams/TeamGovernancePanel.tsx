import { PlatformSignalChipList } from '@/components/ui/platform-signals';
import type { TeamGovernanceSnapshot } from '@/lib/teams/governance-view';

interface TeamGovernancePanelProps {
  governance: TeamGovernanceSnapshot;
}

function GovernanceMatrix(props: {
  title: string;
  rows: Array<{
    key: string;
    label: string;
    owner: boolean;
    admin: boolean;
    member: boolean;
  }>;
}) {
  return (
    <div className="console-grid-table">
      <div className="console-grid-table-head grid grid-cols-[minmax(0,1fr)_72px_72px_72px] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <div>{props.title}</div>
        <div className="text-center">Owner</div>
        <div className="text-center">Admin</div>
        <div className="text-center">Member</div>
      </div>
      {props.rows.map((row) => (
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
  );
}

function GovernanceCapabilityGrid(props: {
  items: Array<{
    key: string;
    label: string;
    allowed: boolean;
    summary: string;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {props.items.map((item) => (
        <div key={item.key} className="console-card bg-secondary/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className={
                item.allowed
                  ? 'h-2 w-2 rounded-full bg-success'
                  : 'h-2 w-2 rounded-full bg-destructive'
              }
            />
            <div className="text-sm font-medium">{item.label}</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{item.summary}</div>
        </div>
      ))}
    </div>
  );
}

export function TeamGovernancePanel({ governance }: TeamGovernancePanelProps) {
  return (
    <div className="space-y-4">
      <div className="console-surface rounded-2xl px-4 py-3">
        <div className="text-sm font-medium">{governance.primarySummary}</div>
        <div className="mt-1 text-xs text-muted-foreground">{governance.roleLabel}</div>
      </div>
      <PlatformSignalChipList chips={governance.signals} />
      <GovernanceCapabilityGrid items={governance.capabilities} />
      <GovernanceMatrix title="团队治理" rows={governance.matrix} />

      <div className="console-surface rounded-2xl px-4 py-3">
        <div className="text-sm font-medium">{governance.platformSummary}</div>
        <div className="mt-1 text-xs text-muted-foreground">项目和环境操作边界</div>
      </div>
      <GovernanceCapabilityGrid items={governance.platformCapabilities} />
      <GovernanceMatrix title="平台能力" rows={governance.platformMatrix} />
    </div>
  );
}
