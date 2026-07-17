# ADR-0004: Isolate Scheduler Kubernetes Capabilities

## Status

Accepted

## Context

Juanie runs periodic reconciliation in a dedicated Scheduler workload and ServiceAccount. The
Scheduler originally received only namespace-scoped Lease permissions, while enabled tasks also
performed cross-namespace preview cleanup, runtime sleep and wake, route reconciliation, DbGate
session cleanup, and infrastructure remediation. Those tasks therefore started successfully but
failed at runtime with Kubernetes `403 Forbidden` responses.

Binding the Scheduler to the controller ClusterRole would restore functionality, but would also
grant namespace creation, Secret reads and writes, workload creation, Job execution, and other
control-plane capabilities that periodic reconciliation does not require.

The production contract requires enabled reconciliation to work across project namespaces while
keeping workload identities independently auditable and limiting the impact of a compromised
Scheduler process.

## Decision

Create a dedicated `juanie-scheduler` ClusterRole and ClusterRoleBinding. Grant only the verbs used
by Scheduler-owned lifecycle operations:

- get and delete expired preview namespaces;
- list and delete stuck pods and redundant services;
- inspect, scale, and delete existing Deployments and Argo Rollouts;
- reconcile HTTPRoutes;
- delete expired DbGate credential Secrets without permission to read their payloads;
- delete legacy StatefulSets and CloudNativePG clusters during preview cleanup;
- manage ApplicationSets only when preview ApplicationSet mode is enabled.

Keep leader election in the existing namespace-scoped Role. Do not grant ConfigMap access, Job
access, workload creation, Secret reads, `pods/log`, or `pods/exec`.

CI validates the rendered production permissions as a capability contract. Production verification
uses `kubectl auth can-i` for required and explicitly denied operations, followed by Scheduler logs
for the scheduled reconciliation paths.

## Consequences

### Positive

- Enabled Scheduler tasks can reconcile every project namespace without sharing controller identity.
- A compromised Scheduler cannot read Secret payloads or create arbitrary workloads and Jobs.
- Scheduler permissions become reviewable alongside the code paths that require them.
- Optional ApplicationSet authority is absent when that feature is disabled.

### Negative

- New Scheduler features that call Kubernetes must update this explicit capability contract.
- Secret deletion remains namespace-wide because Kubernetes RBAC cannot restrict dynamic DbGate
  Secret names by label or prefix. The Scheduler still cannot read, create, update, or patch Secrets.

### Neutral

- Controller permissions remain unchanged.
- The Scheduler still mounts a ServiceAccount token because Lease election and reconciliation need
  Kubernetes API access.

## Alternatives Considered

**Bind Scheduler to the controller ClusterRole**

Rejected because it grants materially broader namespace, Secret, workload, and Job capabilities
than scheduled reconciliation needs.

**Create namespace-local Roles for every project environment**

Rejected because dynamically creating and removing RoleBindings adds a second authorization
reconciliation system and creates bootstrap races during project creation and preview cleanup.

**Move all scheduled work into the controller workload**

Rejected because it collapses workload identities, couples periodic leadership to request-serving
control-plane execution, and increases the controller blast radius.

## References

- Kubernetes RBAC good practices: https://kubernetes.io/docs/concepts/security/rbac-good-practices/
- Scheduler runtime: `src/lib/queue/scheduler-runtime.ts`
- Helm RBAC contract: `deploy/k8s/charts/juanie/templates/rbac.yaml`
