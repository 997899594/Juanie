#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-juanie}"
RELEASE_NAME="${RELEASE_NAME:-juanie}"
WEB_DEPLOYMENT="${RELEASE_NAME}-web"
WORKER_DEPLOYMENT="${RELEASE_NAME}-worker"
SCHEDULER_DEPLOYMENT="${RELEASE_NAME}-scheduler"

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
  kubectl describe "$kind" "$name" -n "${NAMESPACE}" || true
  kubectl get pods -n "${NAMESPACE}" -o wide || true
  kubectl get events -n "${NAMESPACE}" --sort-by=.metadata.creationTimestamp | tail -n 60 || true
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
        - name: ${IMAGE_PULL_SECRET_NAME}
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
          image: ${IMAGE_REPOSITORY}:${MIGRATE_IMAGE_TAG}
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

build_and_push_image() {
  local target="$1"
  local tag="$2"
  echo "Building ${target} image..."
  docker buildx build \
    --progress=plain \
    --file "${SOURCE_DIR}/Dockerfile" \
    --target "${target}" \
    --push \
    --provenance=false \
    --sbom=false \
    --tag "${IMAGE_REPOSITORY}:${tag}" \
    "${SOURCE_DIR}"
}

require_command docker
require_command helm
require_command kubectl

DEPLOY_REGISTRY="$(decode_env DEPLOY_REGISTRY_B64)"
IMAGE_REPOSITORY="$(decode_env IMAGE_REPOSITORY_B64)"
WEB_IMAGE_TAG="$(decode_env WEB_IMAGE_TAG_B64)"
WORKER_IMAGE_TAG="$(decode_env WORKER_IMAGE_TAG_B64)"
MIGRATE_IMAGE_TAG="$(decode_env MIGRATE_IMAGE_TAG_B64)"
IMAGE_PULL_SECRET_NAME="$(decode_env IMAGE_PULL_SECRET_NAME_B64)"
REGISTRY_USERNAME="$(decode_env REGISTRY_USERNAME_B64)"
REGISTRY_PASSWORD="$(decode_env REGISTRY_PASSWORD_B64)"
SOURCE_DIR="$(decode_env SOURCE_DIR_B64)"
CHART_DIR="$(decode_env CHART_DIR_B64)"
SCHEMA_JOB="juanie-schema-sync-$(printf '%s' "${WEB_IMAGE_TAG}" | cut -d- -f2 | cut -c1-7)"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Source directory not found: ${SOURCE_DIR}"
  exit 1
fi

if [[ ! -d "${CHART_DIR}" ]]; then
  echo "Chart directory not found: ${CHART_DIR}"
  exit 1
fi

echo "Logging into deploy registry..."
printf '%s' "${REGISTRY_PASSWORD}" | docker login "${DEPLOY_REGISTRY}" -u "${REGISTRY_USERNAME}" --password-stdin

build_and_push_image web "${WEB_IMAGE_TAG}"
build_and_push_image worker "${WORKER_IMAGE_TAG}"
build_and_push_image migrate "${MIGRATE_IMAGE_TAG}"

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
  --set env.DEPLOY_REGISTRY="${DEPLOY_REGISTRY}" \
  --set env.DEPLOY_REGISTRY_PULL_SECRET_NAME="${IMAGE_PULL_SECRET_NAME}" \
  --set-string imagePullSecrets[0]="${IMAGE_PULL_SECRET_NAME}"

for deployment in "${WEB_DEPLOYMENT}" "${WORKER_DEPLOYMENT}" "${SCHEDULER_DEPLOYMENT}"; do
  wait_for_rollout "${deployment}"
done

echo "Current deployments:"
kubectl -n "${NAMESPACE}" get deploy -o wide
echo "Current pods:"
kubectl -n "${NAMESPACE}" get pods -o wide

docker logout "${DEPLOY_REGISTRY}" >/dev/null 2>&1 || true

echo "Deploy finished."
