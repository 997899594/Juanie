import { AppErrorState } from '@/components/layout/AppErrorState';

export default function NotFoundPage() {
  return (
    <AppErrorState
      eyebrow="没有找到"
      title="这个页面不存在"
      summary="链接可能已经失效，或者你没有权限查看这个资源。"
      operatorHint="如果这是项目、环境或发布详情页，请确认资源 ID 是否存在，以及当前账号是否仍在对应团队中。"
      code="not_found"
      primaryAction={{ label: '回到项目列表', href: '/projects' }}
    />
  );
}
