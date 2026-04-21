'use client';

import { useForm } from '@tanstack/react-form';
import { Check, Copy, Link, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { TeamGovernancePanel } from '@/components/teams/TeamGovernancePanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  changeTeamMemberRole,
  createTeamInvitationLink,
  fetchTeamMembersSnapshot,
  inviteTeamMember,
  removeTeamMember,
  revokeTeamInvitation,
} from '@/lib/teams/client-actions';
import type { getTeamMembersPageData } from '@/lib/teams/service';
import { formatPlatformDateTimeShort } from '@/lib/time/format';

interface TeamMembersClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamMembersPageData>>>;
}

type TeamMembersOverview = TeamMembersClientProps['initialData']['overview'];
type TeamMemberCard = TeamMembersOverview['members'][number];
type TeamInvitationCard = TeamMembersOverview['invitations'][number];

interface MembersApiResponse {
  governance?: TeamMembersOverview['governance'];
  members?: TeamMemberCard[];
}

interface InvitationApiResponse {
  id: string;
  role: string;
  expires: string;
  createdAt: string;
}

function mapInvitation(invitation: InvitationApiResponse): TeamInvitationCard {
  return {
    id: invitation.id,
    role: invitation.role,
    roleLabel: invitation.role === 'admin' ? '管理员' : '成员',
    expiresLabel: formatPlatformDateTimeShort(invitation.expires) ?? '—',
    createdAtLabel: formatPlatformDateTimeShort(invitation.createdAt) ?? '—',
  };
}

function getErrorMessage(errors: unknown[]): string | null {
  const firstError = errors[0];

  if (typeof firstError === 'string') {
    return firstError;
  }

  if (
    typeof firstError === 'object' &&
    firstError !== null &&
    'message' in firstError &&
    typeof firstError.message === 'string'
  ) {
    return firstError.message;
  }

  return null;
}

export function TeamMembersClient({ teamId, initialData }: TeamMembersClientProps) {
  const [overview, setOverview] = useState(initialData.overview);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = async () => {
    setRefreshing(true);

    try {
      const snapshot = await fetchTeamMembersSnapshot(teamId);
      const membersData = snapshot.members as MembersApiResponse;
      const invitationsData = snapshot.invitations as InvitationApiResponse[];
      setOverview((prev) => {
        const nextMembers = Array.isArray(membersData.members) ? membersData.members : prev.members;
        const nextInvitations = Array.isArray(invitationsData)
          ? invitationsData.map(mapInvitation)
          : prev.invitations;

        return {
          ...prev,
          governance: membersData.governance ?? prev.governance,
          members: nextMembers,
          invitations: nextInvitations,
          stats: [
            { label: '成员', value: String(nextMembers.length) },
            {
              label: '待处理邀请',
              value: String(nextInvitations.length),
            },
            prev.stats[2],
          ],
          headerDescription: `${nextMembers.length} 名成员${
            nextInvitations.length > 0 ? ` · ${nextInvitations.length} 个待处理邀请` : ''
          }`,
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新成员信息失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!deleteId) return;

    try {
      await removeTeamMember({ teamId, memberId: deleteId });
      toast.success('成员已移除');
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移除成员失败');
    } finally {
      setDeleteId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await changeTeamMemberRole({ teamId, memberId, role: newRole });
      toast.success('成员角色已更新');
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改成员角色失败');
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('邀请链接已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeTeamInvitation({ teamId, invitationId });
      toast.success('邀请已撤销');
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '撤销邀请失败');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return email[0]?.toUpperCase() ?? '?';
  };

  const canInviteByLink = overview.governance.capabilities.find(
    (item) => item.key === 'invite_by_link'
  )?.allowed;
  const canInviteByEmail = overview.governance.capabilities.find(
    (item) => item.key === 'invite_by_email'
  )?.allowed;

  const inviteForm = useForm({
    defaultValues: {
      email: '',
      role: 'member',
    },
    onSubmit: async ({ value }) => {
      await inviteTeamMember({ teamId, email: value.email.trim(), role: value.role });
      toast.success('邀请已发送');
      setIsOpen(false);
      await refreshData();
      inviteForm.reset();
    },
  });

  const linkForm = useForm({
    defaultValues: {
      role: 'member',
    },
    onSubmit: async ({ value }) => {
      setGeneratedLink(null);
      const data = await createTeamInvitationLink({ teamId, role: value.role });
      setGeneratedLink(data.inviteUrl);
      toast.success('邀请链接已生成');
      await refreshData();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="成员"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Dialog
              open={isLinkDialogOpen}
              onOpenChange={(open) => {
                setIsLinkDialogOpen(open);
                if (!open) {
                  setGeneratedLink(null);
                  linkForm.reset();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 rounded-full px-4"
                  disabled={!canInviteByLink}
                >
                  <Link className="h-4 w-4" />
                  邀请链接
                </Button>
              </DialogTrigger>
              <DialogContent
                size="form"
                className="flex max-h-[calc(100vh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[94vh]"
              >
                <DialogHeader className="shrink-0 px-5 py-6 sm:px-8 sm:py-7">
                  <DialogTitle>生成邀请链接</DialogTitle>
                  <DialogDescription>
                    先选成员角色，再生成可直接分享的团队邀请链接。
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
                  <FormSection className="space-y-4 px-0 py-0 shadow-none">
                    <linkForm.Field name="role">
                      {(field) => (
                        <FormField>
                          <FormLabel htmlFor="invite-link-role">新成员角色</FormLabel>
                          <Select value={field.state.value} onValueChange={field.handleChange}>
                            <SelectTrigger id="invite-link-role" className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="member">成员</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>链接会继承这里选择的默认角色。</FormDescription>
                          <FormMessage />
                        </FormField>
                      )}
                    </linkForm.Field>

                    {generatedLink ? (
                      <FormField>
                        <FormLabel htmlFor="generated-invite-link">邀请链接</FormLabel>
                        <div className="flex gap-2">
                          <Input
                            id="generated-invite-link"
                            value={generatedLink}
                            readOnly
                            className="h-11 text-xs"
                          />
                          <Button
                            className="h-11 shrink-0 rounded-full px-4"
                            onClick={handleCopyLink}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormField>
                    ) : (
                      <EmptyState title="生成后显示链接" className="min-h-32 rounded-[20px]" />
                    )}
                  </FormSection>
                </div>
                <DialogFooter className="console-divider-top shrink-0 bg-background/88 px-5 py-4 backdrop-blur sm:px-8">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full rounded-full sm:w-auto"
                    onClick={() => setIsLinkDialogOpen(false)}
                  >
                    关闭
                  </Button>
                  <linkForm.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
                    {({ isSubmitting }) => (
                      <Button
                        type="button"
                        className="w-full rounded-full sm:w-auto"
                        onClick={() => {
                          void linkForm.handleSubmit().catch((error: unknown) => {
                            toast.error(
                              error instanceof Error ? error.message : '生成邀请链接失败'
                            );
                          });
                        }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? '处理中...' : generatedLink ? '重新生成' : '生成'}
                      </Button>
                    )}
                  </linkForm.Subscribe>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-full px-4" disabled={!canInviteByEmail}>
                  <Plus className="h-4 w-4" />
                  邀请成员
                </Button>
              </DialogTrigger>
              <DialogContent
                size="form"
                className="flex max-h-[calc(100vh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[94vh]"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void inviteForm.handleSubmit().catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : '邀请成员失败');
                    });
                  }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <DialogHeader className="shrink-0 px-5 py-6 sm:px-8 sm:py-7">
                    <DialogTitle>邀请成员</DialogTitle>
                    <DialogDescription>
                      通过邮箱邀请新成员加入团队，并直接设置初始角色。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
                    <FormSection className="space-y-4 px-0 py-0 shadow-none">
                      <inviteForm.Field
                        name="email"
                        validators={{
                          onChange: ({ value }) => {
                            if (!value.trim()) return '请输入邮箱';
                            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
                              return '请输入有效邮箱';
                            }
                            return undefined;
                          },
                        }}
                      >
                        {(field) => (
                          <FormField>
                            <FormLabel htmlFor={field.name}>邮箱</FormLabel>
                            <Input
                              id={field.name}
                              type="email"
                              placeholder="colleague@example.com"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="h-11"
                              aria-invalid={field.state.meta.errors.length > 0}
                            />
                            <FormMessage>
                              {field.state.meta.isTouched
                                ? getErrorMessage(field.state.meta.errors)
                                : null}
                            </FormMessage>
                          </FormField>
                        )}
                      </inviteForm.Field>

                      <inviteForm.Field name="role">
                        {(field) => (
                          <FormField>
                            <FormLabel htmlFor="invite-role">角色</FormLabel>
                            <Select value={field.state.value} onValueChange={field.handleChange}>
                              <SelectTrigger id="invite-role" className="h-11">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">管理员</SelectItem>
                                <SelectItem value="member">成员</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>成员可后续调整。</FormDescription>
                            <FormMessage />
                          </FormField>
                        )}
                      </inviteForm.Field>
                    </FormSection>
                  </div>
                  <DialogFooter className="console-divider-top shrink-0 bg-background/88 px-5 py-4 backdrop-blur sm:px-8">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full rounded-full sm:w-auto"
                      onClick={() => setIsOpen(false)}
                    >
                      取消
                    </Button>
                    <inviteForm.Subscribe
                      selector={(state) => ({
                        canSubmit: state.canSubmit,
                        isSubmitting: state.isSubmitting,
                      })}
                    >
                      {({ canSubmit, isSubmitting }) => (
                        <Button
                          type="submit"
                          className="w-full rounded-full sm:w-auto"
                          disabled={!canSubmit}
                        >
                          {isSubmitting ? '邀请中...' : '发送邀请'}
                        </Button>
                      )}
                    </inviteForm.Subscribe>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {overview.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[20px] bg-[linear-gradient(180deg,rgba(243,240,233,0.74),rgba(255,255,255,0.88))] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset,0_0_0_1px_rgba(17,17,17,0.028)]"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <section className="ui-floating overflow-hidden">
        <div className="console-divider-bottom px-5 py-4">
          <div className="text-sm font-semibold">治理</div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <TeamGovernancePanel governance={overview.governance} />
        </div>
      </section>

      {overview.members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
          title="没有成员"
          action={{ label: '邀请成员', onClick: () => setIsOpen(true) }}
          className="min-h-80"
        />
      ) : (
        <div className="ui-floating console-list overflow-hidden px-0 py-0">
          {overview.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-xl">
                  <AvatarImage src={member.user.image ?? undefined} />
                  <AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold">
                    {getInitials(member.user.name, member.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{member.user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {member.roleLabel} · 加入于 {member.createdAtLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={member.role}
                  onValueChange={(value) => handleChangeRole(member.id, value)}
                  disabled={!member.actions.canChangeRole}
                >
                  <SelectTrigger className="h-9 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner" disabled>
                      拥有者
                    </SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="member">成员</SelectItem>
                  </SelectContent>
                </Select>

                {member.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(member.id)}
                    disabled={!member.actions.canRemove}
                    title={member.actions.removeSummary}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="md:ml-auto md:min-w-44">
                <div className="text-xs text-muted-foreground">{member.actions.roleSummary}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {member.actions.removeSummary}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overview.invitations.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">待处理邀请链接</div>
          <div className="ui-floating console-list overflow-hidden px-0 py-0">
            {overview.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{invitation.roleLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    创建于 {invitation.createdAtLabel} · 到期于 {invitation.expiresLabel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevokeInvitation(invitation.id)}
                  title="撤销邀请"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent size="form">
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员？</AlertDialogTitle>
            <AlertDialogDescription>将移除该成员的团队访问权限。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-2xl bg-[rgba(243,240,233,0.66)] px-4 py-3 text-sm text-muted-foreground">
            仅移除团队成员关系。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="w-full rounded-full sm:w-auto">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
