'use client';

import { useEffect } from 'react';
import { AppErrorState } from '@/components/layout/AppErrorState';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error', error);
  }, [error]);

  return (
    <AppErrorState
      title="页面暂时不可用"
      summary="Juanie 在加载这个页面时遇到了异常。你可以先重试，如果仍然失败，请把错误编号发给管理员。"
      operatorHint="请根据错误编号查看 Web 服务日志、最近一次发布和相关外部依赖状态。生产环境不会在页面上展示原始异常堆栈。"
      code={error.digest ?? error.name}
      detail={process.env.NODE_ENV === 'development' ? error.message : null}
      primaryAction={{ label: '重新加载', onClick: reset }}
    />
  );
}
