/**
 * GitProviderService 组织管理扩展方法
 *
 * 这些方法需要添加到 GitProviderService 类中
 * 用于支持 GitHub 个人账号的闭环体验
 */

/**
 * 检查 GitHub 用户是否有创建 Organization 的权限
 * 个人账号无法通过 API 创建 Organization
 *
 * 添加位置: GitProviderService 类中,在 getGitHubUser 方法之后
 */
export async function canCreateGitHubOrganization(
  this: any,
  accessToken: string,
): Promise<{
  canCreate: boolean
  reason?: string
  accountType: 'personal' | 'enterprise'
}> {
  try {
    const user = await this.getGitHubUser(accessToken)

    // 检查用户类型
    if (user.type === 'Organization') {
      return {
        canCreate: false,
        reason: '当前令牌属于组织账号，无法创建新组织',
        accountType: 'enterprise',
      }
    }

    // 尝试获取用户的组织列表，判断是否有企业账号
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DevOps-Platform',
      },
    })

    if (orgsResponse.ok) {
      const orgs = (await orgsResponse.json()) as any[]

      // 如果用户已经是某些组织的 owner，可能有企业账号
      const ownedOrgs = orgs.filter((org) => org.role === 'admin')

      if (ownedOrgs.length > 0) {
        // 有管理的组织，可能是企业用户，但仍然无法通过 API 创建
        return {
          canCreate: false,
          reason:
            'GitHub 个人账号无法通过 API 创建 Organization，请在 GitHub 网站手动创建或关联已有组织',
          accountType: 'personal',
        }
      }
    }

    // 个人账号
    return {
      canCreate: false,
      reason:
        'GitHub 个人账号无法通过 API 创建 Organization，请在 GitHub 网站手动创建或关联已有组织',
      accountType: 'personal',
    }
  } catch (error) {
    this.logger.error('Failed to check GitHub organization creation permission:', error)
    return {
      canCreate: false,
      reason: '无法检查账号权限',
      accountType: 'personal',
    }
  }
}

/**
 * 关联已有的 GitHub Organization
 * 适用于个人账号用户，他们无法通过 API 创建组织，但可以关联已有组织
 *
 * 添加位置: GitProviderService 类中,在 createGitHubOrganization 方法之后
 */
export async function linkExistingGitHubOrganization(
  this: any,
  accessToken: string,
  orgName: string,
): Promise<{
  id: number
  login: string
  name: string
  url: string
  avatarUrl: string
  role: string
}> {
  this.logger.log(`Linking existing GitHub organization: ${orgName}`)

  // 获取组织信息
  const response = await fetch(`https://api.github.com/orgs/${orgName}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-DevOps-Platform',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub 组织 "${orgName}" 不存在`)
    }
    throw new Error(`无法访问 GitHub 组织 "${orgName}"`)
  }

  const orgData = (await response.json()) as any

  // 检查用户在组织中的角色
  const user = await this.getGitHubUser(accessToken)
  const membershipResponse = await fetch(
    `https://api.github.com/orgs/${orgName}/memberships/${user.login}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DevOps-Platform',
      },
    },
  )

  let role = 'member'
  if (membershipResponse.ok) {
    const membership = (await membershipResponse.json()) as any
    role = membership.role || 'member'

    // 验证用户是否有足够的权限
    if (role !== 'admin') {
      throw new Error(`您在组织 "${orgName}" 中没有管理员权限，无法关联此组织`)
    }
  } else {
    throw new Error(`您不是组织 "${orgName}" 的成员`)
  }

  return {
    id: orgData.id,
    login: orgData.login,
    name: orgData.name || orgData.login,
    url: orgData.html_url,
    avatarUrl: orgData.avatar_url,
    role,
  }
}

/**
 * 列出用户可访问的 GitHub Organizations
 * 用于个人账号用户选择要关联的组织
 *
 * 添加位置: GitProviderService 类中,在 linkExistingGitHubOrganization 方法之后
 */
export async function listGitHubOrganizations(
  this: any,
  accessToken: string,
): Promise<
  Array<{
    id: number
    login: string
    name: string
    url: string
    avatarUrl: string
    role: string
  }>
> {
  this.logger.log('Listing GitHub organizations')

  const response = await fetch('https://api.github.com/user/orgs', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-DevOps-Platform',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to list GitHub organizations')
  }

  const orgs = (await response.json()) as any[]

  // 获取每个组织的详细信息和用户角色
  const orgDetails = await Promise.all(
    orgs.map(async (org) => {
      try {
        const user = await this.getGitHubUser(accessToken)
        const membershipResponse = await fetch(
          `https://api.github.com/orgs/${org.login}/memberships/${user.login}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'AI-DevOps-Platform',
            },
          },
        )

        let role = 'member'
        if (membershipResponse.ok) {
          const membership = (await membershipResponse.json()) as any
          role = membership.role || 'member'
        }

        return {
          id: org.id,
          login: org.login,
          name: org.name || org.login,
          url: org.html_url || `https://github.com/${org.login}`,
          avatarUrl: org.avatar_url,
          role,
        }
      } catch (error) {
        this.logger.warn(`Failed to get details for org ${org.login}:`, error)
        return {
          id: org.id,
          login: org.login,
          name: org.name || org.login,
          url: org.html_url || `https://github.com/${org.login}`,
          avatarUrl: org.avatar_url,
          role: 'member',
        }
      }
    }),
  )

  return orgDetails
}

/**
 * 使用说明:
 *
 * 1. 将这些方法添加到 GitProviderService 类中
 * 2. 修改 getGitHubUser 方法的返回类型,添加 type 字段
 * 3. 在 createGitHubOrganization 方法开始处添加权限检查
 * 4. 更新 createOrganization 统一接口,支持 'link' 模式
 *
 * 示例:
 *
 * // 检查是否可以创建组织
 * const check = await gitProvider.canCreateGitHubOrganization(token)
 * if (!check.canCreate) {
 *   // 显示关联已有组织的选项
 *   const orgs = await gitProvider.listGitHubOrganizations(token)
 *   // 用户选择组织后
 *   const linked = await gitProvider.linkExistingGitHubOrganization(token, orgName)
 * }
 */
