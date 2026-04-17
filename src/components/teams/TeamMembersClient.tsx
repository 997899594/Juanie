'use client';

import { Check, Copy, Link, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function TeamMembersClient({ teamId, initialData }: TeamMembersClientProps) {
  const [overview, setOverview] = useState(initialData.overview);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkRole, setLinkRole] = useState('member');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshData = async () => {
    setRefreshing(true);
    setErrorMessage(null);

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
      setErrorMessage(error instanceof Error ? error.message : '刷新成员信息失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      setErrorMessage(null);
      await inviteTeamMember({ teamId, email: inviteEmail, role: inviteRole });
      setIsOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '邀请成员失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!deleteId) return;

    try {
      setErrorMessage(null);
      await removeTeamMember({ teamId, memberId: deleteId });
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '移除成员失败');
    } finally {
      setDeleteId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      setErrorMessage(null);
      await changeTeamMemberRole({ teamId, memberId, role: newRole });
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '修改成员角色失败');
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    setGeneratedLink(null);

    try {
      setErrorMessage(null);
      const data = await createTeamInvitationLink({ teamId, role: linkRole });
      setGeneratedLink(data.inviteUrl);
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成邀请链接失败');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      setErrorMessage(null);
      await revokeTeamInvitation({ teamId, invitationId });
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '撤销邀请失败');
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
                  setLinkRole('member');
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl px-4"
                  disabled={!canInviteByLink}
                >
                  <Link className="h-4 w-4" />
                  邀请链接
                </Button>
              </DialogTrigger>
              <DialogContent
                size="form"
                className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
              >
                <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
                  <DialogTitle>生成邀请链接</DialogTitle>
                  <DialogDescription>
                    先选成员角色，再生成可直接分享的团队邀请链接。
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                  <div className="space-y-4">
                    <div className="ui-control-muted p-4 sm:p-5">
                      <div className="space-y-2">
                        <Label className="text-sm">新成员角色</Label>
                        <Select value={linkRole} onValueChange={setLinkRole}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">管理员</SelectItem>
                            <SelectItem value="member">成员</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {generatedLink ? (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm">邀请链接</Label>
                          <div className="flex gap-2">
                            <Input
                              value={generatedLink}
                              readOnly
                              className="h-11 rounded-xl text-xs"
                            />
                            <Button
                              className="h-11 shrink-0 rounded-xl px-4"
                              onClick={handleCopyLink}
                            >
                              {copied ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          title="生成后显示链接"
                          className="mt-4 min-h-32 rounded-[20px]"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl sm:w-auto"
                    onClick={() => setIsLinkDialogOpen(false)}
                  >
                    关闭
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-xl sm:w-auto"
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                  >
                    {generatingLink ? '处理中...' : generatedLink ? '重新生成' : '生成'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-xl px-4" disabled={!canInviteByEmail}>
                  <Plus className="h-4 w-4" />
                  邀请成员
                </Button>
              </DialogTrigger>
              <DialogContent
                size="form"
                className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
              >
                <form onSubmit={handleInvite} className="flex min-h-0 flex-1 flex-col">
                  <DialogHeader className="shrink-0 px-4 py-5 sm:px-6">
                    <DialogTitle>邀请成员</DialogTitle>
                    <DialogDescription>
                      通过邮箱邀请新成员加入团队，并直接设置初始角色。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                    <div className="space-y-4">
                      <div className="ui-control-muted p-4 sm:p-5">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm">
                            邮箱
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="h-11 rounded-xl"
                            required
                          />
                        </div>
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm">角色</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="member">成员</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="console-divider-top shrink-0 bg-background px-4 py-4 sm:px-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl sm:w-auto"
                      onClick={() => setIsOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={submitting}
                    >
                      {submitting ? '邀请中...' : '发送邀请'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {overview.stats.map((stat) => (
          <div key={stat.label} className="ui-control-muted rounded-[20px] px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div className="ui-control rounded-[20px] bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员？</AlertDialogTitle>
            <AlertDialogDescription>将移除该成员的团队访问权限。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="ui-control-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground">
            仅移除团队成员关系。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="w-full sm:w-auto">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
