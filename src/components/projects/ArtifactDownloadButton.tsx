'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ArtifactDownloadButtonProps {
  releaseId: string;
  artifactId?: string | null;
}

export function ArtifactDownloadButton({ releaseId, artifactId }: ArtifactDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!artifactId) {
      toast.error('交付物还没有完成登记');
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/releases/${releaseId}/artifacts/${artifactId}/download`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? '下载链接生成失败');
      }

      window.location.href = payload.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载链接生成失败');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="rounded-full"
      disabled={isDownloading}
      onClick={handleDownload}
    >
      {isDownloading ? '准备中' : '下载'}
    </Button>
  );
}
