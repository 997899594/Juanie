# ADR-0001: Require a Prometheus operator control plane

## Status

Accepted

## Context

Juanie production releases install `PrometheusRule` resources for durable control-plane failure
modes. The production cluster did not provide the corresponding Kubernetes API or a controller
that consumed those rules, so Helm could not deploy the application. Installing only the CRDs
would make admission succeed while leaving rules inert.

The current production cluster is a single four-core node with 3.7 GiB of memory and local-path
storage. The monitoring control plane must therefore have bounded storage and requests.

## Decision

Install kube-prometheus-stack as a version-pinned platform dependency. Run one persistent
Prometheus and Alertmanager, Prometheus Operator, kube-state-metrics, and node-exporter. Disable
Grafana and Kubernetes control-plane scrapers that do not match K3s and Cilium. Discover Juanie
rules and PodMonitors across namespaces.

Juanie production charts must render both a `PrometheusRule` and a `PodMonitor`. The PodMonitor
scrapes the outbox dispatcher, which exposes the durable outbox, AI task, and workflow projection
metrics referenced by the rules.

## Consequences

### Positive

- Production alert rules have both an API owner and a live metrics target.
- Helm rejects production releases that silently drop the monitoring contract.
- Monitoring storage and memory remain bounded for the current node.

### Negative

- The single-node monitoring plane is not highly available.
- External alert delivery still requires an Alertmanager receiver owned outside this decision.
- Prometheus and Alertmanager consume 6 GiB of local persistent storage.

## Alternatives Considered

- Install only Prometheus Operator CRDs: rejected because no controller would consume rules.
- Skip unknown monitoring resources: rejected because it weakens the production readiness gate.
- VictoriaMetrics Operator: deferred because it adds a Prometheus compatibility conversion layer.

## References

- `deploy/k8s/infrastructure/monitoring/values.yaml`
- `deploy/k8s/charts/juanie/templates/prometheus-rule.yaml`
- `deploy/k8s/charts/juanie/templates/pod-monitor.yaml`
