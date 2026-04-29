import { DetailsSection } from '@/components/ui/details-section';
import { PlatformSignalChipList } from '@/components/ui/platform-signals';
import type { ProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

interface ProjectGovernancePanelProps {
  governance: ProjectGovernanceSnapshot;
}

const detailsClassName =
  'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]';

export function ProjectGovernancePanel({ governance }: ProjectGovernancePanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">治理</div>
        <div className="mt-2 text-sm font-medium text-foreground">
          当前角色：{governance.roleLabel}
        </div>
      </div>

      <DetailsSection
        title="权限说明"
        summary={governance.primarySummary}
        className={detailsClassName}
      >
        <PlatformSignalChipList chips={governance.signals} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {governance.capabilities.map((capability) => (
            <div
              key={capability.key}
              className="rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]"
            >
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
      </DetailsSection>

      <DetailsSection title="角色矩阵" className={detailsClassName}>
        <div className="overflow-hidden rounded-[18px] bg-white/72">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <div>项目能力</div>
            <div className="text-center">Owner</div>
            <div className="text-center">Admin</div>
            <div className="text-center">Member</div>
          </div>
          {governance.matrix.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px] border-t border-black/5 px-4 py-3 text-sm"
            >
              <div>{row.label}</div>
              <div className="text-center">{row.owner ? '✓' : '—'}</div>
              <div className="text-center">{row.admin ? '✓' : '—'}</div>
              <div className="text-center">{row.member ? '✓' : '—'}</div>
            </div>
          ))}
        </div>
      </DetailsSection>
    </div>
  );
}
