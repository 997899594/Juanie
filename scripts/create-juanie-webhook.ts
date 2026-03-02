import { db } from '../src/lib/db';
import { gitProviders, projects, repositories, teams, webhooks } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createGitProvider } from '../src/lib/git';
import { nanoid } from 'nanoid';

async function main() {
  console.log('🚀 开始配置 Juanie 自身的 Webhook...\n');

  // 查找第一个 git provider (应该有 GitHub 的)
  const provider = await db.query.gitProviders.findFirst();

  if (!provider || !provider.accessToken) {
    console.error('❌ 没有找到 Git provider，请先登录 GitHub');
    process.exit(1);
  }

  console.log(`✅ 找到 Git provider: ${provider.type} (${provider.username})`);

  // 查找或创建仓库记录
  let repository = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, '997899594/Juanie'),
  });

  if (!repository) {
    const [newRepo] = await db
      .insert(repositories)
      .values({
        providerId: provider.id,
        externalId: '997899594/Juanie',
        fullName: '997899594/Juanie',
        name: 'Juanie',
        owner: '997899594',
        cloneUrl: 'https://github.com/997899594/Juanie.git',
        webUrl: 'https://github.com/997899594/Juanie',
        defaultBranch: 'main',
        isPrivate: false,
      })
      .returning();
    repository = newRepo;
    console.log('✅ 创建仓库记录');
  } else {
    console.log('✅ 仓库记录已存在');
  }

  // 查找或创建团队
  let team = await db.query.teams.findFirst();
  if (!team) {
    const [newTeam] = await db
      .insert(teams)
      .values({
        name: 'Default',
        slug: 'default',
      })
      .returning();
    team = newTeam;
    console.log('✅ 创建团队');
  } else {
    console.log(`✅ 团队已存在: ${team.name}`);
  }

  // 检查 Juanie 项目是否已存在
  let project = await db.query.projects.findFirst({
    where: eq(projects.slug, 'juanie'),
  });

  if (!project) {
    const [newProject] = await db
      .insert(projects)
      .values({
        teamId: team.id,
        repositoryId: repository.id,
        name: 'Juanie',
        slug: 'juanie',
        description: 'Juanie DevOps Platform',
        productionBranch: 'main',
        autoDeploy: true,
        status: 'active',
      })
      .returning();
    project = newProject;
    console.log('✅ 创建项目记录');
  } else {
    console.log('✅ 项目记录已存在');
  }

  // 检查 webhook 是否已存在
  const existingWebhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.projectId, project.id),
  });

  if (existingWebhook) {
    console.log('\n⚠️  Webhook 已存在:');
    console.log(`   ID: ${existingWebhook.id}`);
    console.log(`   URL: ${existingWebhook.url}`);
    console.log(`   Active: ${existingWebhook.active}`);
    process.exit(0);
  }

  // 创建 webhook
  const webhookSecret = nanoid(32);
  const webhookUrl = 'https://juanie.art/api/webhooks/git';

  console.log(`\n📡 正在创建 Webhook...`);
  console.log(`   URL: ${webhookUrl}`);

  const client = createGitProvider({
    type: provider.type,
    serverUrl: provider.serverUrl || undefined,
    clientId: provider.clientId || '',
    clientSecret: provider.clientSecret || '',
    redirectUri: '',
  });

  try {
    const { id: externalId } = await client.createWebhook(provider.accessToken, {
      repoFullName: '997899594/Juanie',
      webhookUrl,
      secret: webhookSecret,
      events: ['push'],
    });

    await db.insert(webhooks).values({
      projectId: project.id,
      externalId,
      type: 'git-push',
      url: webhookUrl,
      events: ['push'],
      secret: webhookSecret,
      active: true,
    });

    console.log('\n✅ Webhook 创建成功!');
    console.log(`   External ID: ${externalId}`);
    console.log(`   Secret: ${webhookSecret.slice(0, 8)}...`);
    console.log('\n🎉 现在 push 到 main 分支会自动触发部署!');
  } catch (error) {
    console.error('\n❌ 创建 webhook 失败:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
