#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-juanie}"
RELEASE_NAME="${RELEASE_NAME:-juanie}"
WEB_DEPLOYMENT="${RELEASE_NAME}-web"
WORKER_DEPLOYMENT="${RELEASE_NAME}-worker"
SCHEDULER_DEPLOYMENT="${RELEASE_NAME}-scheduler"

cleanup() {
  if [[ -n "${REMOTE_DIR:-}" ]]; then
    rm -rf "${REMOTE_DIR}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}"
    exit 1
  fi
}

decode_env() {
  local name="$1"
  local encoded="${!name:-}"
  if [[ -z "${encoded}" ]]; then
    echo "${name} is required"
    exit 1
  fi
  printf '%s' "${encoded}" | base64 -d
}

show_failure() {
  local kind="$1"
  local name="$2"
  kubectl describe "${kind}" "${name}" -n "${NAMESPACE}" || true
  kubectl get pods -n "${NAMESPACE}" -o wide || true
  kubectl get events -n "${NAMESPACE}" --sort-by=.metadata.creationTimestamp | tail -n 60 || true
}

ensure_namespace() {
  kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
}

wait_for_rollout() {
  local deployment="$1"

  if ! kubectl get deployment/"${deployment}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    echo "deployment/${deployment} not found in ${NAMESPACE}"
    exit 1
  fi

  echo "Waiting for ${deployment} rollout..."
  if ! kubectl rollout status deployment/"${deployment}" -n "${NAMESPACE}" --timeout=20m; then
    show_failure deployment "${deployment}"
    exit 1
  fi
}

apply_schema_sync_job() {
  cat <<JOB | kubectl apply -f -
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
          image: ${FULL_IMAGE_REPOSITORY}:${WORKER_IMAGE_TAG}
          imagePullPolicy: IfNotPresent
          command: ["bun", "./scripts/db-push.ts"]
          envFrom:
            - configMapRef:
                name: juanie-config
            - secretRef:
                name: juanie-secret
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
JOB
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

require_command helm
require_command kubectl
require_command tar

IMAGE_REGISTRY="$(decode_env IMAGE_REGISTRY_B64)"
FULL_IMAGE_REPOSITORY="$(decode_env FULL_IMAGE_REPOSITORY_B64)"
WEB_IMAGE_TAG="$(decode_env WEB_IMAGE_TAG_B64)"
WORKER_IMAGE_TAG="$(decode_env WORKER_IMAGE_TAG_B64)"
REMOTE_DIR="$(decode_env REMOTE_DIR_B64)"
CHART_ARCHIVE="${REMOTE_DIR}/juanie-chart.tgz"
CHART_DIR="${REMOTE_DIR}/chart"
CHART_PATH="${CHART_DIR}/juanie"
SCHEMA_JOB="juanie-schema-sync-$(printf '%s' "${WEB_IMAGE_TAG}" | cut -d- -f2 | cut -c1-7)"

if [[ ! -f "${CHART_ARCHIVE}" ]]; then
  echo "Chart archive not found: ${CHART_ARCHIVE}"
  exit 1
fi

mkdir -p "${CHART_DIR}"
tar xzf "${CHART_ARCHIVE}" -C "${CHART_DIR}"

if [[ ! -d "${CHART_PATH}" ]]; then
  echo "Chart path not found after extraction: ${CHART_PATH}"
  exit 1
fi

ensure_namespace
run_schema_sync_job

echo "Deploying Helm release..."
helm_args=(
  upgrade --install "${RELEASE_NAME}" "${CHART_PATH}"
  --namespace "${NAMESPACE}"
  --create-namespace
  --reset-values
  -f "${CHART_PATH}/values-prod.yaml"
  --set "images.web.repository=${FULL_IMAGE_REPOSITORY}"
  --set "images.web.tag=${WEB_IMAGE_TAG}"
  --set "images.worker.repository=${FULL_IMAGE_REPOSITORY}"
  --set "images.worker.tag=${WORKER_IMAGE_TAG}"
)

helm "${helm_args[@]}"

for deployment in "${WEB_DEPLOYMENT}" "${WORKER_DEPLOYMENT}" "${SCHEDULER_DEPLOYMENT}"; do
  wait_for_rollout "${deployment}"
done

echo "Current deployments:"
kubectl -n "${NAMESPACE}" get deploy -o wide
echo "Current pods:"
kubectl -n "${NAMESPACE}" get pods -o wide

echo "Deploy finished."
