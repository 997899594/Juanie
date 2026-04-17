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
    <div className="ui-control-muted space-y-4 rounded-[24px] px-4 py-4">
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
            待处理门禁
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
  );
}
