'use client';

import { useEffect } from 'react';
import { AppErrorState } from '@/components/layout/AppErrorState';
import './globals.css';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled global application error', error);
  }, [error]);

  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <AppErrorState
          title="应用启动异常"
          summary="Juanie 的基础页面框架没有正常加载。你可以先重试，如果仍然失败，请联系管理员检查服务端日志。"
          operatorHint="请优先检查应用外壳、登录状态初始化、环境变量和最近一次发布。生产环境不会在页面上展示完整异常详情。"
          code={error.digest ?? error.name}
          detail={process.env.NODE_ENV === 'development' ? error.message : null}
          primaryAction={{ label: '重新加载', onClick: reset }}
        />
      </body>
    </html>
  );
}
