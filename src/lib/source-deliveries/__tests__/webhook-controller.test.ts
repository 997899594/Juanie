import { describe, expect, it } from 'bun:test';
import {
  getWebhookControllerRetryDelayMs,
  isWebhookControllerInSync,
} from '@/lib/source-deliveries/webhook-controller';

describe('repository webhook controller semantics', () => {
  it('uses bounded exponential retry delays', () => {
    expect(getWebhookControllerRetryDelayMs(1)).toBe(30_000);
    expect(getWebhookControllerRetryDelayMs(2)).toBe(60_000);
    expect(getWebhookControllerRetryDelayMs(100)).toBe(6 * 60 * 60 * 1000);
  });

  it('requires both status and generation convergence', () => {
    expect(
      isWebhookControllerInSync({
        status: 'in_sync',
        desiredGeneration: 3,
        observedGeneration: 3,
      })
    ).toBe(true);
    expect(
      isWebhookControllerInSync({
        status: 'in_sync',
        desiredGeneration: 4,
        observedGeneration: 3,
      })
    ).toBe(false);
  });
});
