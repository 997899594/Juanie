#!/usr/bin/env bash

set -euo pipefail

promotion_epoch="${1:-${CONTROL_PLANE_CONTRACT_PROMOTION:-}}"
chart_dir="${2:-deploy/k8s/charts/juanie}"
namespace="${JUANIE_NAMESPACE:-juanie}"
release="${JUANIE_HELM_RELEASE:-juanie}"

if [[ ! "${promotion_epoch}" =~ ^[0-9]{8}$ ]]; then
  echo 'Contract promotion requires an explicit 8-digit epoch' >&2
  exit 1
fi
test -d "${chart_dir}"

job_name="${release}-schema-contract-${promotion_epoch}"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

helm get values "${release}" \
  --namespace "${namespace}" \
  --all \
  --output yaml >"${work_dir}/deployed-values.yaml"

helm template "${release}" "${chart_dir}" \
  --namespace "${namespace}" \
  --values "${work_dir}/deployed-values.yaml" \
  --show-only templates/schema-sync-job.yaml \
  --set schemaSync.enabled=false \
  --set-string "schemaSync.contractPromotionEpoch=${promotion_epoch}" \
  >"${work_dir}/contract-job.yaml"

if ! kubectl --namespace "${namespace}" get "job/${job_name}" >/dev/null 2>&1; then
  kubectl apply --dry-run=server --filename "${work_dir}/contract-job.yaml" >/dev/null
  kubectl create --filename "${work_dir}/contract-job.yaml"
fi

for attempt in $(seq 1 240); do
  job_state="$(kubectl --namespace "${namespace}" get "job/${job_name}" --output json)"
  if jq -e 'any(.status.conditions[]?; .type == "Complete" and .status == "True")' \
    <<<"${job_state}" >/dev/null; then
    kubectl --namespace "${namespace}" logs "job/${job_name}"
    echo "Control-plane contract promotion ${promotion_epoch} completed"
    exit 0
  fi
  if jq -e 'any(.status.conditions[]?; .type == "Failed" and .status == "True")' \
    <<<"${job_state}" >/dev/null; then
    kubectl --namespace "${namespace}" logs "job/${job_name}" --all-containers=true || true
    echo "Control-plane contract promotion ${promotion_epoch} failed" >&2
    exit 1
  fi
  sleep 5
done

kubectl --namespace "${namespace}" logs "job/${job_name}" --all-containers=true || true
echo "Timed out waiting for control-plane contract promotion ${promotion_epoch}" >&2
exit 1
