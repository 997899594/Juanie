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
K3S_REGISTRIES_PATH="${K3S_REGISTRIES_PATH:-/etc/rancher/k3s/registries.yaml}"
DOCKER_IO_MIRRORS="${DOCKER_IO_MIRRORS:-https://mirror.ccs.tencentyun.com,https://hub-mirror.c.163.com,https://mirror.baidubce.com}"
GHCR_IO_MIRRORS="${GHCR_IO_MIRRORS:-https://ghcr.nju.edu.cn}"
DEPLOY_REGISTRY_INTERNAL_ENDPOINT="${DEPLOY_REGISTRY_INTERNAL_ENDPOINT:-}"

if ! command -v htpasswd >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y apache2-utils
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

existing_http_secret_b64="$(
  kubectl get secret "${REGISTRY_AUTH_SECRET_NAME}" \
    -n "${NAMESPACE}" \
    -o jsonpath='{.data.REGISTRY_HTTP_SECRET}' 2>/dev/null || true
)"

if [[ -n "${existing_http_secret_b64}" ]]; then
  REGISTRY_HTTP_SECRET="$(printf '%s' "${existing_http_secret_b64}" | base64 --decode)"
else
  REGISTRY_HTTP_SECRET="$(openssl rand -hex 32)"
fi

emit_yaml_endpoints() {
  local csv="$1"
  IFS=',' read -r -a endpoints <<< "${csv}"

  for endpoint in "${endpoints[@]}"; do
    local trimmed="${endpoint#"${endpoint%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"

    if [[ -n "${trimmed}" ]]; then
      printf '      - "%s"\n' "${trimmed}"
    fi
  done
}

write_k3s_registries_config() {
  local endpoint="${DEPLOY_REGISTRY_INTERNAL_ENDPOINT}"
  local endpoint_host="${endpoint#http://}"
  endpoint_host="${endpoint_host#https://}"
  local output_file="${tmp_dir}/registries.yaml"

  {
    echo 'mirrors:'
    echo '  docker.io:'
    echo '    endpoint:'
    emit_yaml_endpoints "${DOCKER_IO_MIRRORS}"
    echo '  ghcr.io:'
    echo '    endpoint:'
    emit_yaml_endpoints "${GHCR_IO_MIRRORS}"
    printf '  %s:\n' "${REGISTRY_HOST}"
    echo '    endpoint:'
    printf '      - "%s"\n' "${endpoint}"
    echo 'configs:'
    printf '  %s:\n' "${REGISTRY_HOST}"
    echo '    auth:'
    printf '      username: "%s"\n' "${REGISTRY_USERNAME}"
    printf '      password: "%s"\n' "${REGISTRY_PASSWORD}"
    printf '  %s:\n' "${endpoint_host}"
    echo '    auth:'
    printf '      username: "%s"\n' "${REGISTRY_USERNAME}"
    printf '      password: "%s"\n' "${REGISTRY_PASSWORD}"
  } > "${output_file}"

  sudo mkdir -p "$(dirname "${K3S_REGISTRIES_PATH}")"

  if sudo test -f "${K3S_REGISTRIES_PATH}"; then
    sudo cp "${K3S_REGISTRIES_PATH}" "${K3S_REGISTRIES_PATH}.bak"
  fi

  sudo install -m 600 "${output_file}" "${K3S_REGISTRIES_PATH}"
}

restart_k3s_for_registry_config() {
  sudo systemctl restart k3s
  sudo systemctl is-active --quiet k3s
  kubectl wait --for=condition=Ready nodes --all --timeout=10m
}

htpasswd -Bbn "${REGISTRY_USERNAME}" "${REGISTRY_PASSWORD}" > "${tmp_dir}/htpasswd"

kubectl create secret generic "${REGISTRY_AUTH_SECRET_NAME}" \
  -n "${NAMESPACE}" \
  --from-file=htpasswd="${tmp_dir}/htpasswd" \
  --from-literal=REGISTRY_HTTP_SECRET="${REGISTRY_HTTP_SECRET}" \
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
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/configmap.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/deployment.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/service.yaml
kubectl apply -f deploy/k8s/infrastructure/deploy-registry/httproute.yaml

kubectl rollout status deployment/deploy-registry -n "${NAMESPACE}" --timeout=10m

if [[ -z "${DEPLOY_REGISTRY_INTERNAL_ENDPOINT}" ]]; then
  REGISTRY_SERVICE_IP="$(
    kubectl get service deploy-registry -n "${NAMESPACE}" -o jsonpath='{.spec.clusterIP}'
  )"
  DEPLOY_REGISTRY_INTERNAL_ENDPOINT="http://${REGISTRY_SERVICE_IP}:5000"
fi

write_k3s_registries_config
restart_k3s_for_registry_config

kubectl rollout restart deployment/juanie-web -n "${NAMESPACE}"
kubectl rollout restart deployment/juanie-worker -n "${NAMESPACE}"
kubectl rollout restart deployment/juanie-scheduler -n "${NAMESPACE}"
kubectl rollout status deployment/juanie-web -n "${NAMESPACE}" --timeout=10m
kubectl rollout status deployment/juanie-worker -n "${NAMESPACE}" --timeout=10m
kubectl rollout status deployment/juanie-scheduler -n "${NAMESPACE}" --timeout=10m

echo "Deploy registry is ready at https://${REGISTRY_HOST}"
echo "Internal pull endpoint: ${DEPLOY_REGISTRY_INTERNAL_ENDPOINT}"
echo "Next step: set GitHub vars/secrets DEPLOY_REGISTRY, DEPLOY_REGISTRY_PULL_SECRET_NAME, DEPLOY_REGISTRY_USERNAME, DEPLOY_REGISTRY_PASSWORD."
