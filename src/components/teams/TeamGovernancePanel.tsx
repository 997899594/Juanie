import type { ReactNode } from 'react';
import { PlatformSignalChipList } from '@/components/ui/platform-signals';
import type { TeamGovernanceSnapshot } from '@/lib/teams/governance-view';

interface TeamGovernancePanelProps {
  governance: TeamGovernanceSnapshot;
}

function GovernanceDetails(props: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span>{props.title}</span>
        <span className="text-xs font-normal text-muted-foreground">展开</span>
      </summary>
      <div className="mt-4 space-y-4">
        {props.summary ? (
          <div className="text-sm text-muted-foreground">{props.summary}</div>
        ) : null}
        {props.children}
      </div>
    </details>
  );
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
        <div
          key={item.key}
          className="rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]"
        >
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
      <div className="rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
        <div className="text-sm font-medium">当前角色：{governance.roleLabel}</div>
      </div>

      <GovernanceDetails title="团队权限说明" summary={governance.primarySummary}>
        <PlatformSignalChipList chips={governance.signals} />
        <GovernanceCapabilityGrid items={governance.capabilities} />
        <GovernanceMatrix title="团队治理" rows={governance.matrix} />
      </GovernanceDetails>

      <GovernanceDetails title="平台权限说明" summary={governance.platformSummary}>
        <GovernanceCapabilityGrid items={governance.platformCapabilities} />
        <GovernanceMatrix title="平台能力" rows={governance.platformMatrix} />
      </GovernanceDetails>
    </div>
  );
}
