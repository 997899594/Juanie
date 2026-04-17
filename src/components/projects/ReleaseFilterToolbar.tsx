'use client';

import { AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReleaseFilterToolbarProps {
  environmentOptions: Array<{
    value: string;
    label: string;
  }>;
  filter: string;
  riskFilter: 'all' | 'attention' | 'approval' | 'failed';
  onChange: (next: { env?: string; risk?: 'all' | 'attention' | 'approval' | 'failed' }) => void;
}

export function ReleaseFilterToolbar({
  environmentOptions,
  filter,
  riskFilter,
  onChange,
}: ReleaseFilterToolbarProps) {
  return (
    <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]">
      <div className="space-y-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          发布筛选
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {environmentOptions.map((environment) => (
              <Button
                key={environment.value}
                variant={filter === environment.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ env: environment.value })}
                className="capitalize"
              >
                {environment.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            <Button
              variant={riskFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ risk: 'all' })}
            >
              全部状态
            </Button>
            <Button
              variant={riskFilter === 'attention' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ risk: 'attention' })}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              待处理
            </Button>
            <Button
              variant={riskFilter === 'approval' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ risk: 'approval' })}
            >
              审批阻塞
            </Button>
            <Button
              variant={riskFilter === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ risk: 'failed' })}
            >
              失败迁移
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
