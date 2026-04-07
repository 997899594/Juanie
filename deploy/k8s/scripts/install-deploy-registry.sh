#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-juanie}"
REGISTRY_HOST="${DEPLOY_REGISTRY:-registry.juanie.art}"
REGISTRY_USERNAME="${DEPLOY_REGISTRY_USERNAME:?DEPLOY_REGISTRY_USERNAME is required}"
REGISTRY_PASSWORD="${DEPLOY_REGISTRY_PASSWORD:?DEPLOY_REGISTRY_PASSWORD is required}"
REGISTRY_AUTH_SECRET_NAME="${REGISTRY_AUTH_SECRET_NAME:-deploy-registry-auth}"
REGISTRY_PULL_SECRET_NAME="${DEPLOY_REGISTRY_PULL_SECRET_NAME:-deploy-registry-pull-secret}"
PLATFORM_SECRET_NAME="${PLATFORM_SECRET_NAME:-juanie-secret}"
PLATFORM_CONFIGMAP_NAME="${PLATFORM_CONFIGMAP_NAME:-juanie-config}"

if ! command -v htpasswd >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y apache2-utils
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

htpasswd -Bbn "${REGISTRY_USERNAME}" "${REGISTRY_PASSWORD}" > "${tmp_dir}/htpasswd"

kubectl create secret generic "${REGISTRY_AUTH_SECRET_NAME}" \
  -n "${NAMESPACE}" \
  --from-file=htpasswd="${tmp_dir}/htpasswd" \
  --dry-run=client \
  -o yaml | kubectl apply -f -

kubectl create secret docker-registry "${REGISTRY_PULL_SECRET_NAME}" \
  -n "${NAMESPACE}" \
  --docker-server="${REGISTRY_HOST}" \
  --docker-username="${REGISTRY_USERNAME}" \
  --docker-password="${REGISTRY_PASSWORD}" \
  --dry-run=client \
  -o yaml | kubectl apply -f -

kubectl patch secret "${PLATFORM_SECRET_NAME}" -n "${NAMESPACE}" --type merge -p "$(
  cat <<EOF
{"stringData":{"DEPLOY_REGISTRY_USERNAME":"${REGISTRY_USERNAME}","DEPLOY_REGISTRY_PASSWORD":"${REGISTRY_PASSWORD}"}}
EOF
)"

kubectl patch configmap "${PLATFORM_CONFIGMAP_NAME}" -n "${NAMESPACE}" --type merge -p "$(
  cat <<EOF
{"data":{"DEPLOY_REGISTRY":"${REGISTRY_HOST}","DEPLOY_REGISTRY_PULL_SECRET_NAME":"${REGISTRY_PULL_SECRET_NAME}"}}
EOF
)"

kubectl apply -f deploy/k8s/infrastructure/deploy-registry/pvc.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/deployment.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/service.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/httproute.yaml

kubectl rollout status deployment/deploy-registry -n "${NAMESPACE}" --timeout=10m
kubectl rollout restart deployment/juanie-web -n "${NAMESPACE}"
kubectl rollout restart deployment/juanie-worker -n "${NAMESPACE}"
kubectl rollout status deployment/juanie-web -n "${NAMESPACE}" --timeout=10m
kubectl rollout status deployment/juanie-worker -n "${NAMESPACE}" --timeout=10m

echo "Deploy registry is ready at https://${REGISTRY_HOST}"
echo "Next step: set GitHub vars/secrets DEPLOY_REGISTRY, DEPLOY_REGISTRY_PULL_SECRET_NAME, DEPLOY_REGISTRY_USERNAME, DEPLOY_REGISTRY_PASSWORD."
