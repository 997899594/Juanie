import { customFetch } from 'next-auth';
import type { OAuth2Config } from 'next-auth/providers';

interface FeishuProviderOptions {
  clientId: string;
  clientSecret: string;
}

interface FeishuUserInfo {
  sub?: string;
  open_id?: string;
  union_id?: string;
  user_id?: string;
  name?: string;
  en_name?: string;
  avatar_url?: string;
  avatar_thumb?: string;
  picture?: string;
  email?: string;
}

interface FeishuUserInfoResponse extends FeishuUserInfo {
  data?: FeishuUserInfo;
}

function normalizeFeishuProfile(profile: FeishuUserInfoResponse): FeishuUserInfo {
  return profile.data ?? profile;
}

function normalizeFeishuTokenPayload(payload: Record<string, unknown>) {
  const data = (
    payload.data && typeof payload.data === 'object' ? payload.data : payload
  ) as Record<string, unknown>;

  return {
    access_token: data.access_token ?? data.user_access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type ?? 'Bearer',
    scope: data.scope,
  };
}

function parseOAuthRequestBody(body: BodyInit | null | undefined) {
  if (!body) {
    return new URLSearchParams();
  }

  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof body === 'string') {
    return new URLSearchParams(body);
  }

  return new URLSearchParams();
}

export function FeishuProvider(
  options: FeishuProviderOptions
): OAuth2Config<FeishuUserInfoResponse> {
  return {
    id: 'feishu',
    name: '飞书',
    type: 'oauth',
    checks: ['state'],
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorization: {
      url: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
      params: {
        app_id: options.clientId,
      },
    },
    token: {
      url: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      async conform(response: Response) {
        const payload = await response.json();
        return Response.json(normalizeFeishuTokenPayload(payload), response);
      },
    },
    userinfo: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Feishu userinfo request failed: ${response.status}`);
        }

        return response.json();
      },
    },
    profile(profile) {
      const user = normalizeFeishuProfile(profile);
      const id = user.union_id ?? user.user_id ?? user.open_id ?? user.sub;
      const email = user.email?.trim().toLowerCase();

      if (!id) {
        throw new Error('Feishu user profile is missing stable id');
      }

      if (!email) {
        throw new Error('Feishu user profile is missing email');
      }

      return {
        id,
        name: user.name ?? user.en_name ?? email,
        email,
        image: user.avatar_url ?? user.avatar_thumb ?? user.picture ?? null,
      };
    },
    style: {
      brandColor: '#00d6b9',
    },
    allowDangerousEmailAccountLinking: true,
    async [customFetch](...args: Parameters<typeof fetch>): Promise<Response> {
      const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);

      if (url.pathname.endsWith('/authen/v2/oauth/token')) {
        const [requestUrl, requestInit] = args;
        const oauthBody = parseOAuthRequestBody(requestInit?.body ?? null);
        const response = await fetch(requestUrl, {
          ...requestInit,
          headers: {
            ...requestInit?.headers,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: oauthBody.get('grant_type') ?? 'authorization_code',
            code: oauthBody.get('code'),
            redirect_uri: oauthBody.get('redirect_uri'),
            client_id: options.clientId,
            client_secret: options.clientSecret,
          }),
        });
        const payload = await response.json();

        return Response.json(normalizeFeishuTokenPayload(payload), response);
      }

      return fetch(...args);
    },
    options,
  };
}
