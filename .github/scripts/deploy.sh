#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS=(
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=10
  -o TCPKeepAlive=yes
  -o ConnectTimeout=20
)
IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
FULL_IMAGE_REPOSITORY="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}"
WEB_IMAGE_TAG="web-${GITHUB_SHA}"
WORKER_IMAGE_TAG="worker-${GITHUB_SHA}"
REMOTE_DIR="/root/juanie-deploy-${GITHUB_SHA}"
REMOTE_CHART_ARCHIVE="${REMOTE_DIR}/juanie-chart.tgz"
LOCAL_CHART_ARCHIVE="$(mktemp /tmp/juanie-chart-${GITHUB_SHA}.XXXXXX.tgz)"

trap 'rm -f "${LOCAL_CHART_ARCHIVE}"' EXIT

encode_env() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

retry() {
  local attempts="$1"
  shift

  local attempt=1
  local delay=5

  until "$@"; do
    if (( attempt >= attempts )); then
      return 1
    fi

    sleep "${delay}"
    attempt=$((attempt + 1))
  done
}

tar -czf "${LOCAL_CHART_ARCHIVE}" -C deploy/k8s/charts juanie

retry 6 ssh "${SSH_OPTS[@]}" "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}'"
retry 6 scp "${SSH_OPTS[@]}" "${LOCAL_CHART_ARCHIVE}" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_CHART_ARCHIVE}"

retry 6 ssh "${SSH_OPTS[@]}" "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "IMAGE_REGISTRY_B64='$(encode_env "${IMAGE_REGISTRY}")' FULL_IMAGE_REPOSITORY_B64='$(encode_env "${FULL_IMAGE_REPOSITORY}")' WEB_IMAGE_TAG_B64='$(encode_env "${WEB_IMAGE_TAG}")' WORKER_IMAGE_TAG_B64='$(encode_env "${WORKER_IMAGE_TAG}")' REMOTE_DIR_B64='$(encode_env "${REMOTE_DIR}")' bash -s" <<'EOF'
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

decode_optional_env() {
  local name="$1"
  local encoded="${!name:-}"
  if [[ -z "${encoded}" ]]; then
    return 0
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
          command: ["bun", "./node_modules/drizzle-kit/bin.cjs", "push", "--config", "./drizzle.config.ts"]
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
EOF
