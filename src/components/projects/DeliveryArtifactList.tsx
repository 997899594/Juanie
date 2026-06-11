'use client';

import { Package2 } from 'lucide-react';
import { ArtifactDownloadButton } from '@/components/projects/ArtifactDownloadButton';
import { Badge } from '@/components/ui/badge';
import { getReleaseArtifactKindLabel, getReleaseArtifactUri } from '@/lib/releases/artifacts';
import { cn } from '@/lib/utils';

export interface DeliveryArtifactListItem {
  id?: string | null;
  releaseId?: string | null;
  kind?: string | null;
  name?: string | null;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  uri?: string | null;
  imageUrl?: string | null;
  serviceId?: string | null;
  service?: {
    id: string;
    name: string;
  } | null;
  status?: string | null;
  sourceImageDigest?: string | null;
}

interface DeliveryArtifactListProps {
  artifacts: DeliveryArtifactListItem[];
  className?: string;
  emptyLabel?: string;
  fallbackReleaseId?: string | null;
  itemClassName?: string;
  maxItems?: number;
}

function formatArtifactReference(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value.split('/').pop() ?? value;
  return compact.length > 42 ? `${compact.slice(0, 39)}...` : compact;
}

function getArtifactTitle(artifact: DeliveryArtifactListItem): string {
  return (
    [artifact.name, artifact.variant, artifact.platform].filter(Boolean).join(' / ') || 'artifact'
  );
}

function getArtifactMeta(artifact: DeliveryArtifactListItem): string | null {
  const meta = [
    artifact.format,
    artifact.sourceImageDigest ? `image ${artifact.sourceImageDigest.slice(0, 18)}...` : null,
    artifact.status,
  ]
    .filter(Boolean)
    .join(' · ');

  return meta || null;
}

function isManagedArtifactReference(reference: string | null): reference is string {
  return Boolean(reference?.startsWith('s3://'));
}

function isExternalArtifactReference(reference: string | null): reference is string {
  return Boolean(reference?.startsWith('https://') || reference?.startsWith('http://'));
}

export function DeliveryArtifactList({
  artifacts,
  className,
  emptyLabel = '暂无交付物',
  fallbackReleaseId,
  itemClassName,
  maxItems,
}: DeliveryArtifactListProps) {
  const visibleArtifacts = typeof maxItems === 'number' ? artifacts.slice(0, maxItems) : artifacts;

  if (visibleArtifacts.length === 0) {
    return <div className={cn('text-sm text-muted-foreground', className)}>{emptyLabel}</div>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {visibleArtifacts.map((artifact) => {
        const reference = getReleaseArtifactUri(artifact);
        const releaseId = artifact.releaseId ?? fallbackReleaseId ?? null;
        const meta = getArtifactMeta(artifact);

        return (
          <div
            key={artifact.id ?? `${artifact.kind}:${getArtifactTitle(artifact)}`}
            className={cn('console-inset px-3 py-3', itemClassName)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Package2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-all text-sm font-medium text-foreground">
                    {getArtifactTitle(artifact)}
                  </span>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                    {getReleaseArtifactKindLabel(artifact)}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {meta ? <span>{meta}</span> : null}
                  {reference ? <span>{formatArtifactReference(reference)}</span> : null}
                </div>
              </div>

              {isManagedArtifactReference(reference) && releaseId ? (
                <ArtifactDownloadButton releaseId={releaseId} artifactId={artifact.id} />
              ) : isExternalArtifactReference(reference) ? (
                <a
                  href={reference}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-sm font-medium text-foreground transition hover:bg-foreground/[0.05]"
                >
                  下载
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">等待回传</span>
              )}
            </div>
          </div>
        );
      })}
      {typeof maxItems === 'number' && artifacts.length > maxItems ? (
        <div className="text-xs text-muted-foreground">还有 {artifacts.length - maxItems} 个</div>
      ) : null}
    </div>
  );
}
