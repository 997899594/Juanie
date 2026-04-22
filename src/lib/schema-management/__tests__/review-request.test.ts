import { describe, expect, it } from 'bun:test';
import { resolveSchemaRepairReviewFiles } from '@/lib/schema-management/review-request';

describe('schema repair review request', () => {
  it('prefers real repo artifacts when repair files exist', () => {
    const result = resolveSchemaRepairReviewFiles({
      body: 'review body',
      fallbackReviewFilePath: '.juanie/schema-repair/plan-123.md',
      generatedArtifacts: {
        files: {
          '.juanie/schema-repair/generated/0001_fix.sql': '-- sql',
        },
        generatedFiles: ['.juanie/schema-repair/generated/0001_fix.sql'],
      },
    });

    expect(result.files).toEqual({
      '.juanie/schema-repair/generated/0001_fix.sql': '-- sql',
    });
    expect(result.generatedFiles).toEqual(['.juanie/schema-repair/generated/0001_fix.sql']);
  });

  it('falls back to a review note only when there are no repo artifacts', () => {
    const result = resolveSchemaRepairReviewFiles({
      body: 'review body',
      fallbackReviewFilePath: '.juanie/schema-repair/plan-123.md',
      generatedArtifacts: {
        files: {},
        generatedFiles: [],
      },
    });

    expect(result.files).toEqual({
      '.juanie/schema-repair/plan-123.md': 'review body',
    });
    expect(result.generatedFiles).toEqual(['.juanie/schema-repair/plan-123.md']);
  });
});
