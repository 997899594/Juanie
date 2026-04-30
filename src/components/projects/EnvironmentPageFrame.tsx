'use client';

import type { ReactNode } from 'react';
import { EnvironmentSectionNav } from '@/components/projects/EnvironmentSectionNav';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell, type PageShellSize } from '@/components/ui/page-shell';

interface EnvironmentPageFrameProps {
  projectId: string;
  environmentId?: string | null;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: PageShellSize;
}

export function EnvironmentPageFrame({
  projectId,
  environmentId,
  title,
  description,
  actions,
  children,
  className,
  size = 'section',
}: EnvironmentPageFrameProps) {
  return (
    <PageShell size={size} className={className}>
      <PageHeader title={title} description={description} actions={actions} />
      <EnvironmentSectionNav projectId={projectId} environmentId={environmentId} />
      {children}
    </PageShell>
  );
}
