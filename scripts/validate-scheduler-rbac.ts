import { readFileSync } from 'node:fs';
import { parseAllDocuments } from 'yaml';

interface RbacRule {
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
}

interface KubernetesDocument {
  kind?: string;
  metadata?: { name?: string };
  rules?: RbacRule[];
  roleRef?: { kind?: string; name?: string };
  subjects?: Array<{ kind?: string; name?: string; namespace?: string }>;
}

function fail(message: string): never {
  throw new Error(`Scheduler RBAC contract violation: ${message}`);
}

const documents = parseAllDocuments(readFileSync(0, 'utf8')).map(
  (document) => document.toJS() as KubernetesDocument
);
const role = documents.find(
  (document) => document.kind === 'ClusterRole' && document.metadata?.name === 'juanie-scheduler'
);
if (!role) fail('juanie-scheduler ClusterRole is missing');

const permissions = new Set<string>();
for (const rule of role.rules ?? []) {
  for (const apiGroup of rule.apiGroups ?? []) {
    for (const resource of rule.resources ?? []) {
      for (const verb of rule.verbs ?? []) {
        if (apiGroup === '*' || resource === '*' || verb === '*') {
          fail('wildcard permissions are forbidden');
        }
        permissions.add(`${apiGroup}:${resource}:${verb}`);
      }
    }
  }
}

const expectedPermissions = new Set([
  ':namespaces:get',
  ':namespaces:delete',
  ':pods:get',
  ':pods:list',
  ':pods:delete',
  ':services:get',
  ':services:list',
  ':services:delete',
  ':secrets:delete',
  'apps:deployments:get',
  'apps:deployments:list',
  'apps:deployments:update',
  'apps:deployments:patch',
  'apps:deployments:delete',
  'apps:statefulsets:delete',
  'gateway.networking.k8s.io:httproutes:get',
  'gateway.networking.k8s.io:httproutes:list',
  'gateway.networking.k8s.io:httproutes:create',
  'gateway.networking.k8s.io:httproutes:update',
  'gateway.networking.k8s.io:httproutes:patch',
  'gateway.networking.k8s.io:httproutes:delete',
  'argoproj.io:rollouts:get',
  'argoproj.io:rollouts:list',
  'argoproj.io:rollouts:patch',
  'argoproj.io:rollouts:delete',
  'postgresql.cnpg.io:clusters:delete',
]);
for (const permission of expectedPermissions) {
  if (!permissions.has(permission)) fail(`expected permission ${permission} is missing`);
}
for (const permission of permissions) {
  if (!expectedPermissions.has(permission)) fail(`unexpected permission ${permission} is present`);
}

const binding = documents.find(
  (document) =>
    document.kind === 'ClusterRoleBinding' && document.metadata?.name === 'juanie-scheduler'
);
if (!binding) fail('juanie-scheduler ClusterRoleBinding is missing');
if (binding.roleRef?.kind !== 'ClusterRole' || binding.roleRef.name !== 'juanie-scheduler') {
  fail('Scheduler binding must reference the dedicated juanie-scheduler ClusterRole');
}
if (
  !binding.subjects?.some(
    (subject) =>
      subject.kind === 'ServiceAccount' &&
      subject.name === 'juanie-scheduler' &&
      subject.namespace === 'juanie'
  )
) {
  fail('Scheduler binding must target the juanie/juanie-scheduler ServiceAccount');
}

console.log('Scheduler RBAC contract is valid');
