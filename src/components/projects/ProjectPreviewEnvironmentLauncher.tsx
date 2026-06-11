'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  PreviewEnvironmentDialog,
  type PreviewEnvironmentDialogInput,
} from '@/components/projects/PreviewEnvironmentDialog';
import { Button } from '@/components/ui/button';
import {
  createPreviewEnvironment,
  EnvironmentClientActionError,
} from '@/lib/environments/client-actions';
import type { EnvironmentPageGovernanceSnapshot } from '@/lib/environments/governance-view';

interface ProjectPreviewEnvironmentLauncherProps {
  projectId: string;
  governance: Pick<EnvironmentPageGovernanceSnapshot, 'createPreview' | 'createIsolatedPreview'>;
  initialOpen?: boolean;
}

export function ProjectPreviewEnvironmentLauncher({
  projectId,
  governance,
  initialOpen = false,
}: ProjectPreviewEnvironmentLauncherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (input: PreviewEnvironmentDialogInput) => {
    setLoading(true);

    const branch = input.branch.trim();
    const prNumber = input.prNumber.trim();
    const ttlHours = input.ttlHours.trim();

    if (!branch && !prNumber) {
      setLoading(false);
      throw new Error('至少填写分支或 PR 号。');
    }
    if (branch && prNumber) {
      setLoading(false);
      throw new Error('分支和 PR 号一次只能填写一个。');
    }

    try {
      const data = await createPreviewEnvironment({
        projectId,
        branch: branch || undefined,
        prNumber: prNumber ? Number.parseInt(prNumber, 10) : undefined,
        ttlHours: ttlHours ? Number.parseInt(ttlHours, 10) : undefined,
        databaseStrategy: input.databaseStrategy,
      });

      setOpen(false);
      toast.success(
        data.launchState === 'building'
          ? `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在构建，完成后会自动部署`
          : `已启动 ${data.name} · ${data.sourceCommitSha?.slice(0, 7) ?? 'latest'} 正在部署`
      );
      router.push(data.releasePath ?? `/projects/${projectId}/environments/${data.id}`);
    } catch (error) {
      if (error instanceof EnvironmentClientActionError && error.releasePath) {
        setOpen(false);
        toast.error(error.message);
        router.push(error.releasePath);
        return;
      }

      throw error instanceof Error ? error : new Error('创建预览环境失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-3"
        disabled={!governance.createPreview.allowed}
        title={governance.createPreview.summary}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        新建预览
      </Button>
      <PreviewEnvironmentDialog
        open={open}
        loading={loading}
        disabled={!governance.createPreview.allowed}
        disabledSummary={governance.createPreview.summary}
        allowIsolatedClone={governance.createIsolatedPreview.allowed}
        isolatedCloneSummary={governance.createIsolatedPreview.summary}
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
