#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-juanie}"

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

if [[ -z "${WEB_IMAGE:-}" || -z "${WORKER_IMAGE:-}" ]]; then
  echo "WEB_IMAGE and WORKER_IMAGE are required"
  exit 1
fi

echo "Cleaning stale schema jobs (best-effort)..."
kubectl -n "${NAMESPACE}" delete job \
  juanie-schema-sync-47ffe2f \
  juanie-schema-sync-976a5ae \
  --ignore-not-found=true || true

echo "Updating deployment images..."
kubectl -n "${NAMESPACE}" set image deployment/juanie-web juanie="${WEB_IMAGE}"
kubectl -n "${NAMESPACE}" set image deployment/juanie-worker worker="${WORKER_IMAGE}"

for deployment in juanie-web juanie-worker; do
  wait_for_rollout "${deployment}"
done

echo "Current deployments:"
kubectl -n "${NAMESPACE}" get deploy -o wide
echo "Current pods:"
kubectl -n "${NAMESPACE}" get pods -o wide

echo "Deploy finished."
