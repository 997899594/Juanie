import { describe, expect, it } from 'bun:test';
import { FeishuProvider } from '@/lib/auth/feishu-provider';

describe('FeishuProvider', () => {
  it('normalizes nested Feishu user info into a NextAuth profile', async () => {
    const provider = FeishuProvider({
      clientId: 'app-id',
      clientSecret: 'secret',
    });

    const profile = await provider.profile?.(
      {
        data: {
          union_id: 'union-1',
          name: '交付同事',
          email: 'Delivery@Example.com',
          avatar_url: 'https://example.com/avatar.png',
        },
      },
      {}
    );

    expect(profile).toEqual({
      id: 'union-1',
      name: '交付同事',
      email: 'delivery@example.com',
      image: 'https://example.com/avatar.png',
    });
  });

  it('requires email so invite matching stays safe', () => {
    const provider = FeishuProvider({
      clientId: 'app-id',
      clientSecret: 'secret',
    });

    expect(() =>
      provider.profile?.(
        {
          data: {
            union_id: 'union-1',
            name: 'No Email',
          },
        },
        {}
      )
    ).toThrow('email');
  });
});
