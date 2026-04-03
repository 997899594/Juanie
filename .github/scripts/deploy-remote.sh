#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-juanie}"
RELEASE_NAME="${RELEASE_NAME:-juanie}"
SCHEMA_JOB="juanie-schema-sync-$(printf '%s' "$WEB_IMAGE_TAG" | cut -d- -f2 | cut -c1-7)"

show_failure() {
  local kind="$1"
  local name="$2"
  kubectl describe "$kind" "$name" -n "${NAMESPACE}" || true
  kubectl get pods -n "${NAMESPACE}" -o wide || true
  kubectl get events -n "${NAMESPACE}" --sort-by=.metadata.creationTimestamp | tail -n 60 || true
}

require_resource() {
  local kind="$1"
  local name="$2"
  kubectl get "${kind}" "${name}" -n "${NAMESPACE}" >/dev/null
}

apply_schema_sync_job() {
  cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${SCHEMA_JOB}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: ${RELEASE_NAME}
    app.kubernetes.io/component: schema-sync
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${RELEASE_NAME}
        app.kubernetes.io/component: schema-sync
    spec:
      restartPolicy: Never
      serviceAccountName: ${RELEASE_NAME}
      imagePullSecrets:
        - name: ghcr-pull-secret
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      initContainers:
        - name: wait-for-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z postgres 5432; do sleep 2; done']
      containers:
        - name: schema-sync
          image: ${MIGRATE_IMAGE}
          imagePullPolicy: IfNotPresent
          envFrom:
            - configMapRef:
                name: juanie-config
            - secretRef:
                name: juanie-secret
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
EOF
}

run_schema_sync_job() {
  echo "Running schema sync job..."
  kubectl delete job "${SCHEMA_JOB}" -n "${NAMESPACE}" --ignore-not-found=true
  kubectl wait --for=delete job/"${SCHEMA_JOB}" -n "${NAMESPACE}" --timeout=120s || true

  apply_schema_sync_job

  if ! kubectl wait --for=condition=complete job/"${SCHEMA_JOB}" -n "${NAMESPACE}" --timeout=45m; then
    show_failure job "${SCHEMA_JOB}"
    kubectl logs job/"${SCHEMA_JOB}" -n "${NAMESPACE}" --tail=200 || true
    exit 1
  fi

  kubectl logs job/"${SCHEMA_JOB}" -n "${NAMESPACE}" --tail=120 || true
}

wait_for_rollout() {
  local deployment="$1"

  echo "Waiting for ${deployment} rollout..."
  if ! kubectl rollout status deployment/"${deployment}" -n "${NAMESPACE}" --timeout=20m; then
    show_failure deployment "${deployment}"
    exit 1
  fi
}

echo "Checking GHCR pull secret..."
require_resource secret ghcr-pull-secret
echo "Checking deployment baseline resources..."
require_resource configmap juanie-config
require_resource secret juanie-secret

run_schema_sync_job

echo "Deploying Helm release..."
helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  --reset-values \
  -f "${CHART_DIR}/values-prod.yaml" \
  --set images.web.repository="${IMAGE_REPOSITORY}" \
  --set images.web.tag="${WEB_IMAGE_TAG}" \
  --set images.worker.repository="${IMAGE_REPOSITORY}" \
  --set images.worker.tag="${WORKER_IMAGE_TAG}" \
  --set images.migrate.repository="${IMAGE_REPOSITORY}" \
  --set images.migrate.tag="${MIGRATE_IMAGE_TAG}" \
  --set-string imagePullSecrets[0]=ghcr-pull-secret

for deployment in juanie-web juanie-worker; do
  wait_for_rollout "${deployment}"
done

rm -rf "$(dirname "${CHART_DIR}")"
echo "Deployment finished."
