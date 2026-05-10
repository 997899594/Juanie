import { AppErrorState } from '@/components/layout/AppErrorState';

const authErrorCopy: Record<
  string,
  {
    title: string;
    summary: string;
    operatorHint: string;
  }
> = {
  Configuration: {
    title: '登录服务暂时不可用',
    summary: 'GitHub 已完成授权，但 Juanie 服务端没有完成后续登录确认。',
    operatorHint:
      '管理员需要检查 OAuth 配置、NEXTAUTH_URL / NEXTAUTH_SECRET，以及服务端是否能访问 GitHub token 接口。',
  },
  AccessDenied: {
    title: '没有登录权限',
    summary: '当前账号没有被允许进入这个工作区。',
    operatorHint: '如果这是误判，请联系团队管理员检查账号权限或登录域名限制。',
  },
  Verification: {
    title: '登录链接已失效',
    summary: '这次登录请求已经过期或被重复使用。',
    operatorHint: '请重新发起登录。如果持续出现，需要检查服务端时间、Cookie 和回调地址。',
  },
};

function getAuthErrorCopy(error?: string) {
  if (error && authErrorCopy[error]) {
    return authErrorCopy[error];
  }

  return {
    title: '登录没有完成',
    summary: '登录过程中遇到了服务端异常。',
    operatorHint: '请检查服务端 auth 日志，确认 OAuth provider、数据库连接和外部网络是否正常。',
  };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const error = resolvedSearchParams?.error;
  const copy = getAuthErrorCopy(error);

  return (
    <AppErrorState
      eyebrow="登录异常"
      title={copy.title}
      summary={copy.summary}
      operatorHint={copy.operatorHint}
      code={error}
      primaryAction={{ label: '重新登录', href: '/login' }}
      secondaryAction={{ label: '返回首页', href: '/' }}
    />
  );
}
