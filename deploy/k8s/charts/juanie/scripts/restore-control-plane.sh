#!/usr/bin/env bash
set -euo pipefail

namespace="${JUANIE_NAMESPACE:-juanie}"
release="${JUANIE_RELEASE:-juanie}"
backup_file="${1:-}"
database_name="${DATABASE_NAME:-juanie}"

if [[ -z "${backup_file}" || ! -s "${backup_file}" ]]; then
  echo "usage: CONFIRM_RESTORE=<namespace>/<database> $0 <postgres-custom-dump>" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "${namespace}/${database_name}" ]]; then
  echo "set CONFIRM_RESTORE=${namespace}/${database_name} to acknowledge destructive restore" >&2
  exit 1
fi

postgres_pod="$(kubectl -n "${namespace}" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')"
mapfile -t deployments < <(
  kubectl -n "${namespace}" get deployment -l "app.kubernetes.io/name=${release}" -o name
)

for deployment in "${deployments[@]}"; do
  kubectl -n "${namespace}" scale "${deployment}" --replicas=0 >/dev/null
done
kubectl -n "${namespace}" scale statefulset "${release}-restate" --replicas=0 >/dev/null
kubectl -n "${namespace}" cp "${backup_file}" "${postgres_pod}:/tmp/control-plane.dump"
kubectl -n "${namespace}" exec "${postgres_pod}" -- dropdb -U postgres --force "${database_name}"
kubectl -n "${namespace}" exec "${postgres_pod}" -- createdb -U postgres "${database_name}"
kubectl -n "${namespace}" exec "${postgres_pod}" -- \
  pg_restore -U postgres --dbname "${database_name}" --exit-on-error /tmp/control-plane.dump
kubectl -n "${namespace}" exec "${postgres_pod}" -- rm -f /tmp/control-plane.dump
echo "PostgreSQL restore completed with Juanie workloads stopped."
echo "Run the normal Helm upgrade so schema jobs complete before replicas and Restate reopen traffic."
