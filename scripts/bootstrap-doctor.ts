import { spawnSync } from 'node:child_process';

type Status = 'ok' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

const namespace = process.env.PLATFORM_NAMESPACE?.trim() || process.env.JUANIE_NAMESPACE?.trim() || 'juanie';
const certManagerNamespace = process.env.CERT_MANAGER_NAMESPACE?.trim() || 'cert-manager';
const argocdNamespace = process.env.ARGOCD_NAMESPACE?.trim() || 'argocd';
const argoRolloutsNamespace = process.env.ARGO_ROLLOUTS_NAMESPACE?.trim() || 'argo-rollouts';
const cnpgNamespace = process.env.CNPG_NAMESPACE?.trim() || 'cnpg-system';
const externalSecretsNamespace =
  process.env.EXTERNAL_SECRETS_NAMESPACE?.trim() || 'external-secrets';
const gatewayClassName = process.env.GATEWAY_CLASS_NAME?.trim() || 'cilium';

const results: CheckResult[] = [];

function run(command: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return {
    ok: result.status === 0,
    output,
  };
}

function add(name: string, status: Status, detail: string): void {
  results.push({ name, status, detail });
}

function checkCommand(command: string): boolean {
  const result = run(command, ['--version']);
  add(
    `本地命令 ${command}`,
    result.ok ? 'ok' : 'fail',
    result.ok ? result.output.split('\n')[0] || '已安装' : `未找到或不可执行：${command}`
  );
  return result.ok;
}

function checkKubectl(name: string, args: string[], okDetail: string): void {
  const result = run('kubectl', args);
  add(name, result.ok ? 'ok' : 'fail', result.ok ? okDetail : result.output || args.join(' '));
}

function checkHelmRelease(name: string, release: string, releaseNamespace: string): void {
  const result = run('helm', ['status', release, '-n', releaseNamespace]);
  add(
    `Helm ${name}`,
    result.ok ? 'ok' : 'fail',
    result.ok ? `${releaseNamespace}/${release}` : result.output || `${releaseNamespace}/${release} 不存在`
  );
}

function checkNamespace(targetNamespace: string): void {
  checkKubectl(
    `命名空间 ${targetNamespace}`,
    ['get', 'namespace', targetNamespace],
    `${targetNamespace} 已存在`
  );
}

function checkCrd(crd: string): void {
  checkKubectl(`CRD ${crd}`, ['get', 'crd', crd], `${crd} 已安装`);
}

function checkCanI(verb: string, resource: string, targetNamespace?: string): void {
  const args = ['auth', 'can-i', verb, resource];
  if (targetNamespace) {
    args.push('-n', targetNamespace);
  }
  checkKubectl(
    `权限 ${verb} ${resource}${targetNamespace ? ` @ ${targetNamespace}` : ''}`,
    args,
    '允许'
  );
}

const hasKubectl = checkCommand('kubectl');
const hasHelm = checkCommand('helm');

if (hasKubectl) {
  const context = run('kubectl', ['config', 'current-context']);
  add(
    'Kubernetes 当前上下文',
    context.ok ? 'ok' : 'fail',
    context.ok ? context.output : '无法读取 kubectl current-context'
  );

  checkKubectl('Kubernetes API 访问', ['version', '--client=true'], 'kubectl client 可用');
  checkCanI('create', 'namespace');
  checkCanI('get', 'pods', namespace);
  checkCanI('create', 'jobs', namespace);
  checkCanI('create', 'secrets', namespace);
  checkCanI('create', 'configmaps', namespace);

  [
    namespace,
    certManagerNamespace,
    argocdNamespace,
    argoRolloutsNamespace,
    cnpgNamespace,
    externalSecretsNamespace,
  ].forEach(checkNamespace);

  [
    'applications.argoproj.io',
    'applicationsets.argoproj.io',
    'rollouts.argoproj.io',
    'clusters.postgresql.cnpg.io',
    'externalsecrets.external-secrets.io',
    'certificates.cert-manager.io',
    'clusterissuers.cert-manager.io',
    'gateways.gateway.networking.k8s.io',
    'httproutes.gateway.networking.k8s.io',
  ].forEach(checkCrd);

  checkKubectl(
    `GatewayClass ${gatewayClassName}`,
    ['get', 'gatewayclass', gatewayClassName],
    `${gatewayClassName} 已存在`
  );
  checkKubectl('平台 ConfigMap', ['get', 'configmap', 'juanie-config', '-n', namespace], 'juanie-config 已存在');
  checkKubectl('平台 Secret', ['get', 'secret', 'juanie-secret', '-n', namespace], 'juanie-secret 已存在');
}

if (hasHelm) {
  checkHelmRelease('cert-manager', 'cert-manager', certManagerNamespace);
  checkHelmRelease('DNSPod webhook', 'cert-manager-webhook-dnspod', certManagerNamespace);
  checkHelmRelease('Argo CD', 'argocd', argocdNamespace);
  checkHelmRelease('Argo Rollouts', 'argo-rollouts', argoRolloutsNamespace);
  checkHelmRelease('CloudNativePG', 'cloudnative-pg', cnpgNamespace);
  checkHelmRelease('External Secrets', 'external-secrets', externalSecretsNamespace);
}

const nameWidth = Math.max(...results.map((result) => result.name.length), 8);
for (const result of results) {
  const label = result.status === 'ok' ? 'OK' : result.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${label.padEnd(5)} ${result.name.padEnd(nameWidth)} ${result.detail}`);
}

const failed = results.filter((result) => result.status === 'fail');
if (failed.length > 0) {
  console.error(`\nbootstrap doctor 失败：${failed.length} 项未通过。`);
  process.exit(1);
}

console.log('\nbootstrap doctor 通过：集群与 Juanie 平台运行契约一致。');
