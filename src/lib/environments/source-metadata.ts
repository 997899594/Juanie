import { extractBranchFromRef, extractPrNumberFromRef } from '@/lib/environments/preview';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';

export interface PreviewSourceMetadataInput {
  sourceRef?: string | null;
  environment?: {
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
  } | null;
  reviewRequest?: PreviewReviewMetadata | null;
}

export interface PreviewSourceMetadata {
  kind: 'pr' | 'branch' | 'standard';
  label: string | null;
  title: string | null;
  reference: string | null;
  detail: string | null;
  stateLabel: string | null;
  authorName: string | null;
  webUrl: string | null;
}

export function buildPreviewSourceMetadata(
  input: PreviewSourceMetadataInput
): PreviewSourceMetadata {
  const previewPrNumber =
    input.environment?.previewPrNumber ??
    (input.sourceRef ? extractPrNumberFromRef(input.sourceRef) : null);
  const branch =
    input.environment?.branch ?? (input.sourceRef ? extractBranchFromRef(input.sourceRef) : null);
  const isPreview = input.environment?.isPreview === true;

  if (previewPrNumber !== null) {
    const reviewLabel =
      input.reviewRequest?.label ??
      `${input.reviewRequest?.kind === 'merge_request' ? 'MR !' : 'PR #'}${previewPrNumber}`;
    const titlePrefix = isPreview ? '预览环境来自' : '发布来自';
    const titleSuffix = input.reviewRequest?.kind === 'merge_request' ? 'MR' : 'PR';

    return {
      kind: 'pr',
      label: reviewLabel,
      title: `${titlePrefix}${titleSuffix}`,
      reference: input.sourceRef ?? null,
      detail: input.reviewRequest?.title ?? null,
      stateLabel: input.reviewRequest?.stateLabel ?? null,
      authorName: input.reviewRequest?.authorName ?? null,
      webUrl: input.reviewRequest?.webUrl ?? null,
    };
  }

  if (branch) {
    return {
      kind: 'branch',
      label: branch,
      title: isPreview ? '预览环境来自分支' : '发布来自分支',
      reference: input.sourceRef ?? `refs/heads/${branch}`,
      detail: null,
      stateLabel: null,
      authorName: null,
      webUrl: null,
    };
  }

  return {
    kind: 'standard',
    label: null,
    title: null,
    reference: input.sourceRef ?? null,
    detail: null,
    stateLabel: null,
    authorName: null,
    webUrl: null,
  };
}
