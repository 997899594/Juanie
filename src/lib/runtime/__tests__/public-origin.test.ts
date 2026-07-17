import { describe, expect, it } from 'bun:test';
import { getPublicOrigin } from '@/lib/runtime/public-origin';

function withPublicOrigin(value: string | undefined, assertion: () => void): void {
  const previousPublicOrigin = process.env.JUANIE_PUBLIC_ORIGIN;
  try {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, 'JUANIE_PUBLIC_ORIGIN');
    } else {
      Reflect.set(process.env, 'JUANIE_PUBLIC_ORIGIN', value);
    }
    assertion();
  } finally {
    if (previousPublicOrigin === undefined) {
      Reflect.deleteProperty(process.env, 'JUANIE_PUBLIC_ORIGIN');
    } else {
      Reflect.set(process.env, 'JUANIE_PUBLIC_ORIGIN', previousPublicOrigin);
    }
  }
}

describe('public origin', () => {
  it('normalizes a public HTTPS origin', () => {
    withPublicOrigin('https://juanie.example.com/', () => {
      expect(getPublicOrigin()).toBe('https://juanie.example.com');
    });
  });

  it('allows HTTP only for local development', () => {
    withPublicOrigin('http://localhost:3001', () => {
      expect(getPublicOrigin()).toBe('http://localhost:3001');
    });

    withPublicOrigin('http://juanie.example.com', () => {
      expect(() => getPublicOrigin()).toThrow('HTTPS origin');
    });
  });

  it('rejects origins with a path', () => {
    withPublicOrigin('https://juanie.example.com/control-plane', () => {
      expect(() => getPublicOrigin()).toThrow('without credentials or a path');
    });
  });

  it('fails closed when the public origin is missing', () => {
    withPublicOrigin(undefined, () => {
      expect(() => getPublicOrigin()).toThrow('JUANIE_PUBLIC_ORIGIN is required');
    });
  });
});
