#!/usr/bin/env bash

set -euo pipefail

: "${GITHUB_SHA:?}"
: "${PLATFORM_DEPLOY_REQUIRED:?}"
: "${OPERATOR_DEPLOY_REQUIRED:?}"

case "${PLATFORM_DEPLOY_REQUIRED}:${OPERATOR_DEPLOY_REQUIRED}" in
  true:true | true:false | false:true) ;;
  *)
    echo 'Production reconciliation requires a platform or operator change' >&2
    exit 1
    ;;
esac

deploy_root="/tmp/juanie-direct-deploy-${GITHUB_SHA}"
trap 'rm -rf "${deploy_root}"' EXIT
mkdir -p "${deploy_root}"

if [ "${PLATFORM_DEPLOY_REQUIRED}" = true ]; then
  : "${DEPLOY_CHART_DIR:?}"
  : "${GITHUB_REPOSITORY:?}"
  : "${IMAGE_REGISTRY:?}"
  : "${IMAGE_REPOSITORY:?}"
  : "${WEB_IMAGE_TAG:?}"
  : "${RUNTIME_IMAGE_TAG:?}"
  : "${SCHEMA_RUNNER_IMAGE_TAG:?}"

  test -d "${DEPLOY_CHART_DIR}"
  registry_hosts_dir=/var/lib/rancher/k3s/agent/etc/containerd/certs.d
  test -f "${registry_hosts_dir}/ghcr.io/hosts.toml"
  preload_log="${deploy_root}/image-preload.log"

  for image_tag in \
    "${SCHEMA_RUNNER_IMAGE_TAG}" \
    "${RUNTIME_IMAGE_TAG}" \
    "${WEB_IMAGE_TAG}"; do
    if ! timeout 15m k3s ctr --namespace k8s.io images pull \
      --local \
      --hosts-dir "${registry_hosts_dir}" \
      --platform linux/amd64 \
      --max-concurrent-downloads 3 \
      "${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}:${image_tag}" \
      >"${preload_log}" 2>&1; then
      tail -200 "${preload_log}"
      exit 1
    fi
    echo "Preloaded ${image_tag%%@*}"
  done
fi

if [ "${OPERATOR_DEPLOY_REQUIRED}" = true ]; then
  : "${RESTATE_OPERATOR_VERSION:?}"
  : "${RESTATE_OPERATOR_CHART_DIGEST:?}"
  : "${RESTATE_OPERATOR_CHART_SHA256:?}"
  : "${RESTATE_OPERATOR_IMAGE_DIGEST:?}"
  : "${RESTATE_OPERATOR_AMD64_DIGEST:?}"

  operator_state="$(kubectl -n restate-operator get deployment restate-operator \
    --ignore-not-found -o json)"
  operator_namespace="$(kubectl get namespace restate-operator --ignore-not-found -o name)"
  installed_chart=''
  operator_image_id=''

  if [ -n "${operator_namespace}" ]; then
    installed_chart="$(helm list -n restate-operator \
      --filter '^restate-operator$' -o json \
      | jq -r '.[0].chart // empty')"
    operator_image_id="$(kubectl -n restate-operator get pod \
      -l app=restate-operator -o json \
      | jq -r '.items[0].status.containerStatuses[0].imageID // empty')"
  fi

  operator_image_digest="${operator_image_id##*@}"
  deployed_chart_digest=''
  if [ -n "${operator_state}" ]; then
    deployed_chart_digest="$(jq -r \
      '.metadata.annotations["juanie.art/restate-operator-chart-digest"] // empty' \
      <<<"${operator_state}")"
  fi

  crd_state="$(kubectl get crd \
    restateclusters.restate.dev restatedeployments.restate.dev \
    --ignore-not-found -o json)"
  crds_established=false
  if [ -n "${crd_state}" ] && \
    jq -e '
      (.items | length == 2) and
      all(.items[];
        any(.status.conditions[]?;
          .type == "Established" and .status == "True"))
    ' <<<"${crd_state}" >/dev/null; then
    crds_established=true
  fi

  operator_converged=false
  if [[ "${installed_chart}" == *"-${RESTATE_OPERATOR_VERSION}" ]] && \
    { [ "${operator_image_digest}" = "${RESTATE_OPERATOR_IMAGE_DIGEST}" ] || \
      [ "${operator_image_digest}" = "${RESTATE_OPERATOR_AMD64_DIGEST}" ]; } && \
    [ "${crds_established}" = true ] && \
    { [ -z "${deployed_chart_digest}" ] || \
      [ "${deployed_chart_digest}" = "${RESTATE_OPERATOR_CHART_DIGEST}" ]; }; then
    operator_converged=true
    if [ -z "${deployed_chart_digest}" ]; then
      kubectl -n restate-operator annotate deployment/restate-operator \
        "juanie.art/restate-operator-chart-digest=${RESTATE_OPERATOR_CHART_DIGEST}"
    fi
    echo "Restate Operator ${RESTATE_OPERATOR_VERSION} is already converged"
  fi

  if [ "${operator_converged}" = false ]; then
    operator_archive="${deploy_root}/restate-operator-helm-${RESTATE_OPERATOR_VERSION}.tgz"
    operator_pull_output="$(helm pull oci://ghcr.io/restatedev/restate-operator-helm \
      --version "${RESTATE_OPERATOR_VERSION}" \
      --destination "${deploy_root}" 2>&1)"
    grep -F "Digest: ${RESTATE_OPERATOR_CHART_DIGEST}" <<<"${operator_pull_output}"
    echo "${RESTATE_OPERATOR_CHART_SHA256}  ${operator_archive}" | sha256sum --check

    operator_chart_root="${deploy_root}/restate-operator-chart"
    mkdir -p "${operator_chart_root}"
    tar -xzf "${operator_archive}" -C "${operator_chart_root}"
    kubectl apply --server-side \
      --field-manager=juanie-platform-ci \
      -f "${operator_chart_root}/restate-operator-helm/charts/restate-operator-crds/crds"

    helm upgrade --install restate-operator "${operator_archive}" \
      --namespace restate-operator \
      --create-namespace \
      --set installCrds=false \
      --set-string version="${RESTATE_OPERATOR_VERSION}" \
      --atomic \
      --wait \
      --timeout 10m
    kubectl wait --for=condition=Established \
      crd/restateclusters.restate.dev \
      crd/restatedeployments.restate.dev \
      --timeout=2m
    kubectl -n restate-operator rollout status deployment/restate-operator --timeout=5m

    operator_image_id="$(kubectl -n restate-operator get pod \
      -l app=restate-operator \
      -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')"
    operator_image_digest="${operator_image_id##*@}"
    if [ "${operator_image_digest}" != "${RESTATE_OPERATOR_IMAGE_DIGEST}" ] && \
      [ "${operator_image_digest}" != "${RESTATE_OPERATOR_AMD64_DIGEST}" ]; then
      echo "Unexpected Restate Operator image: ${operator_image_id}" >&2
      exit 1
    fi
    kubectl -n restate-operator annotate deployment/restate-operator \
      "juanie.art/restate-operator-chart-digest=${RESTATE_OPERATOR_CHART_DIGEST}" \
      --overwrite
  fi
fi

if [ "${PLATFORM_DEPLOY_REQUIRED}" = true ]; then
  kubectl -n juanie delete job \
    juanie-schema-sync juanie-schema-expand juanie-schema-contract \
    --ignore-not-found=true >/dev/null

  helm upgrade --install juanie "${DEPLOY_CHART_DIR}" \
    --namespace juanie \
    --create-namespace \
    -f "${DEPLOY_CHART_DIR}/values-prod.yaml" \
    --set-string images.web.repository="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}" \
    --set-string images.web.tag="${WEB_IMAGE_TAG}" \
    --set-string images.runtime.repository="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}" \
    --set-string images.runtime.tag="${RUNTIME_IMAGE_TAG}" \
    --set-string images.schemaRunner.repository="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}" \
    --set-string images.schemaRunner.tag="${SCHEMA_RUNNER_IMAGE_TAG}" \
    --set-string env.JUANIE_SOURCE_REPOSITORY="${GITHUB_REPOSITORY}" \
    --set-string env.JUANIE_SOURCE_REVISION="${GITHUB_SHA}" \
    --set schemaSync.enabled=true \
    --atomic \
    --cleanup-on-fail \
    --wait \
    --wait-for-jobs \
    --timeout 20m

  kubectl -n juanie rollout status deployment/juanie-web --timeout=10m
  kubectl -n juanie rollout status deployment/juanie-worker --timeout=10m
  kubectl -n juanie wait \
    --for=condition=Ready \
    restatedeployment/juanie-restate-services \
    --timeout=10m

  restate_deployment_id="$(kubectl -n juanie get \
    restatedeployment/juanie-restate-services \
    -o jsonpath='{.status.deploymentId}')"
  test -n "${restate_deployment_id}"
  restate_deployment="$(kubectl get --raw \
    "/api/v1/namespaces/juanie/services/juanie-restate:9070/proxy/deployments/${restate_deployment_id}")"
  expected_services='[
    "ProjectInitializationWorkflow",
    "ReleaseWorkflow",
    "EnvironmentRuntimeWorkflow",
    "MigrationWorkflow",
    "DeploymentWorkflow",
    "ProjectDeletionWorkflow",
    "SchemaRepairWorkflow",
    "SourceDeliveryWorkflow"
  ]'
  actual_services="$(jq -c '[.services[]?.name] | sort' <<<"${restate_deployment}")"
  expected_services="$(jq -c 'sort' <<<"${expected_services}")"
  if [ "${actual_services}" != "${expected_services}" ]; then
    echo "Restate service catalog mismatch: expected=${expected_services} actual=${actual_services}" >&2
    exit 1
  fi
  service_count="$(jq 'length' <<<"${actual_services}")"
  echo "Verified immutable Restate deployment ${restate_deployment_id} with ${service_count} services"

  for attempt in $(seq 1 24); do
    if curl -fsS https://juanie.art/api/health/ready >/dev/null; then
      break
    fi
    if [ "${attempt}" -eq 24 ]; then
      curl -fsS https://juanie.art/api/health/ready
    fi
    sleep 5
  done
fi
