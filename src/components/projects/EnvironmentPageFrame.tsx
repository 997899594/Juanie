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
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  beforeHeader?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: PageShellSize;
  showEnvironmentNav?: boolean;
}

export function EnvironmentPageFrame({
  projectId,
  environmentId,
  title,
  description,
  eyebrow,
  meta,
  actions,
  beforeHeader,
  children,
  className,
  size = 'section',
  showEnvironmentNav = true,
}: EnvironmentPageFrameProps) {
  return (
    <PageShell size={size} className={className}>
      {beforeHeader}
      <PageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        meta={meta}
        actions={actions}
      />
      {showEnvironmentNav ? (
        <EnvironmentSectionNav projectId={projectId} environmentId={environmentId} />
      ) : null}
      {children}
    </PageShell>
  );
}
