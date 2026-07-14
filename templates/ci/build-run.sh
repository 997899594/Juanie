#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
juanie_base_url="${JUANIE_BASE_URL:-https://juanie.art}"
state_dir="${JUANIE_BUILD_STATE_DIR:-.juanie/build-run}"
build_run_file="${state_dir}/build-run.json"
units_file="${state_dir}/units.json"
groups_file="${state_dir}/groups.json"
release_services_file="${state_dir}/release-services.json"
build_outputs_file="${state_dir}/build-outputs.json"
release_file="${state_dir}/release.json"
artifacts_ready_file="${state_dir}/artifacts-ready"

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "${name} is required"
    exit 1
  fi
}

request_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"

  require_env JUANIE_TOKEN

  if [ -n "$payload" ]; then
    curl -fsSL -X "$method" "${juanie_base_url}${path}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${JUANIE_TOKEN}" \
      -d "$payload"
    return
  fi

  curl -fsSL -X "$method" "${juanie_base_url}${path}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JUANIE_TOKEN}"
}

request_json_with_token() {
  local method="$1"
  local path="$2"
  local token="$3"
  curl -fsSL -X "$method" "${juanie_base_url}${path}" \
    -H "Authorization: Bearer ${token}"
}

load_build_secrets() {
  local build_run_id="$1"
  local unit="$2"
  local secret_names
  local unit_key
  unit_key="$(jq -r '.id' <<<"$unit")"
  secret_names="$(jq -r '.secrets[]?' <<<"$unit")"
  [ -n "$secret_names" ] || return 0

  local response
  local capability_token
  capability_token="$(cat "${state_dir}/secret-access-token")"
  response="$(
    request_json_with_token \
      GET \
      "/api/build-runs/${build_run_id}/secrets?unitKey=${unit_key}" \
      "$capability_token"
  )"
  while IFS= read -r encoded; do
    [ -n "$encoded" ] || continue
    local entry
    local key
    local value
    entry="$(printf '%s' "$encoded" | base64 -d)"
    key="$(jq -r '.key' <<<"$entry")"
    value="$(jq -r '.value' <<<"$entry")"
    export "${key}=${value}"
  done < <(jq -r '.secrets | to_entries[] | @base64' <<<"$response")

  while IFS= read -r key; do
    [ -n "$key" ] || continue
    if [ -z "${!key+x}" ]; then
      echo "Required build secret ${key} was not returned by Juanie"
      return 1
    fi
  done <<<"$secret_names"
}

append_docker_secret_args() {
  local unit="$1"
  local -n result="$2"
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    result+=(--secret "id=${key},env=${key}")
  done < <(jq -r '.secrets[]?' <<<"$unit")
}

wait_for_image() {
  local image="$1"
  local deadline
  deadline=$(( $(date +%s) + 180 ))

  until docker buildx imagetools inspect "$image" >/dev/null 2>&1; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "Image manifest was not available before build unit completion: ${image}"
      return 1
    fi
    sleep 5
  done
}

image_digest() {
  local image="$1"
  docker buildx imagetools inspect "$image" --format '{{json .Manifest}}' | jq -r '.digest // empty'
}

report_unit() {
  local build_run_id="$1"
  local unit_key="$2"
  local status="$3"
  local image="${4:-}"
  local digest="${5:-}"
  local error_message="${6:-}"
  local payload

  payload="$(
    jq -cn \
      --arg status "$status" \
      --arg image "$image" \
      --arg imageDigest "$digest" \
      --arg errorMessage "$error_message" \
      '{
        status: $status,
        image: (if $image == "" then null else $image end),
        imageDigest: (if $imageDigest == "" then null else $imageDigest end),
        errorMessage: (if $errorMessage == "" then null else $errorMessage end)
      }'
  )"

  request_json PATCH "/api/build-runs/${build_run_id}/units/${unit_key}" "$payload" >/dev/null
}

build_unit() {
  local build_run_id="$1"
  local unit="$2"
  local unit_key
  local service_name
  local strategy
  local context
  local dockerfile
  local bake_target
  local bake_definition
  local image
  local digest

  unit_key="$(jq -r '.id' <<<"$unit")"
  service_name="$(jq -r '.service' <<<"$unit")"
  strategy="$(jq -r '.strategy' <<<"$unit")"
  context="$(jq -r '.context' <<<"$unit")"
  dockerfile="$(jq -r '.dockerfile // ""' <<<"$unit")"
  bake_target="$(jq -r '.bakeTarget // ""' <<<"$unit")"
  bake_definition="$(jq -r '.bakeDefinition // ""' <<<"$unit")"
  image="$(jq -r '.outputs[0].image' <<<"$unit")"

  report_unit "$build_run_id" "$unit_key" running "$image" || return 1
  load_build_secrets "$build_run_id" "$unit" || return 1

  if [ "$strategy" = 'bake' ] && [ -n "$bake_definition" ]; then
    local target="$bake_target"
    local bake_cache_args=()
    [ -n "$target" ] || target="$service_name"
    if [ "${JUANIE_DOCKER_CACHE_BACKEND:-}" = 'gha' ]; then
      bake_cache_args=(
        --set "$target.cache-from=type=gha"
        --set "$target.cache-to=type=gha,mode=max"
      )
    fi
    docker buildx bake "$target" \
      -f "$bake_definition" \
      --set "$target.tags=$image" \
      --set "$target.args.GIT_SHA=${JUANIE_SOURCE_SHA}" \
      "${bake_cache_args[@]}" \
      --push || return 1
  elif [ "$strategy" = 'dockerfile' ]; then
    [ -n "$dockerfile" ] || dockerfile='Dockerfile'
    local docker_cache_args=()
    local docker_secret_args=()
    append_docker_secret_args "$unit" docker_secret_args
    if [ "${JUANIE_DOCKER_CACHE_BACKEND:-}" = 'gha' ]; then
      docker_cache_args=(
        --cache-from type=gha,scope="juanie-${service_name}"
        --cache-to type=gha,mode=max,scope="juanie-${service_name}"
      )
    fi
    docker buildx build \
      --file "$dockerfile" \
      --tag "$image" \
      --build-arg "GIT_SHA=${JUANIE_SOURCE_SHA}" \
      "${docker_secret_args[@]}" \
      "${docker_cache_args[@]}" \
      --push \
      "$context" || return 1
  else
    if [ "$(jq '.secrets | length' <<<"$unit")" -gt 0 ]; then
      echo "Build unit ${unit_key} requires BuildKit secrets and must use dockerfile or bake"
      return 1
    fi
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "$PWD:/workspace" \
      -w /workspace \
      buildpacksio/pack \
      pack build "$image" --builder paketobuildpacks/builder-jammy-full --publish || return 1
  fi

  wait_for_image "$image" || return 1
  digest="$(image_digest "$image")" || return 1
  report_unit "$build_run_id" "$unit_key" succeeded "$image" "$digest" || return 1
}

get_unit() {
  local unit_key="$1"
  jq -c --arg key "$unit_key" '.[] | select(.id == $key)' "$units_file"
}

build_bake_group() {
  local build_run_id="$1"
  local group_json="$2"
  local unit_keys
  local first_unit
  local bake_definition
  local targets=()
  local bake_set_args=()
  local images=()
  local unit_key

  mapfile -t unit_keys < <(jq -r '.units[]' <<<"$group_json")
  first_unit="$(get_unit "${unit_keys[0]}")"
  bake_definition="$(jq -r '.bakeDefinition // ""' <<<"$first_unit")"

  if [ -z "$bake_definition" ]; then
    echo 'Bake group is missing build definition'
    return 1
  fi

  for unit_key in "${unit_keys[@]}"; do
    local unit
    local target
    local service_name
    local image

    unit="$(get_unit "$unit_key")"
    service_name="$(jq -r '.service' <<<"$unit")"
    target="$(jq -r '.bakeTarget // ""' <<<"$unit")"
    [ -n "$target" ] || target="$service_name"
    image="$(jq -r '.outputs[0].image' <<<"$unit")"

    report_unit "$build_run_id" "$unit_key" running "$image" || return 1
    load_build_secrets "$build_run_id" "$unit" || return 1
    targets+=("$target")
    images+=("${unit_key}|${image}")
    bake_set_args+=(
      --set "$target.tags=$image"
      --set "$target.args.GIT_SHA=${JUANIE_SOURCE_SHA}"
    )
    while IFS= read -r key; do
      [ -n "$key" ] || continue
      bake_set_args+=(--set "$target.secret+=id=${key},env=${key}")
    done < <(jq -r '.secrets[]?' <<<"$unit")
    if [ "${JUANIE_DOCKER_CACHE_BACKEND:-}" = 'gha' ]; then
      bake_set_args+=(
        --set "$target.cache-from=type=gha"
        --set "$target.cache-to=type=gha,mode=max"
      )
    fi
  done

  docker buildx bake "${targets[@]}" \
    -f "$bake_definition" \
    "${bake_set_args[@]}" \
    --push || return 1

  for item in "${images[@]}"; do
    unit_key="${item%%|*}"
    local image="${item#*|}"
    local digest
    wait_for_image "$image" || return 1
    digest="$(image_digest "$image")" || return 1
    report_unit "$build_run_id" "$unit_key" succeeded "$image" "$digest" || return 1
  done
}

build_group() {
  local build_run_id="$1"
  local group_json="$2"
  local unit_keys
  local group_mode
  local failed_unit=""
  local failed_message=""

  group_mode="$(jq -r '.mode' <<<"$group_json")"
  unit_keys="$(jq -r '.units[]' <<<"$group_json")"

  if [ "$group_mode" = 'bake_group' ]; then
    if ! build_bake_group "$build_run_id" "$group_json"; then
      while IFS= read -r unit_key; do
        [ -n "$unit_key" ] || continue
        report_unit "$build_run_id" "$unit_key" failed "" "" "Build group failed" || true
      done <<<"$unit_keys"
      exit 1
    fi
    return
  fi

  while IFS= read -r unit_key; do
    [ -n "$unit_key" ] || continue
    local unit
    unit="$(get_unit "$unit_key")"
    if ! build_unit "$build_run_id" "$unit"; then
      failed_unit="$unit_key"
      failed_message="Build unit ${unit_key} failed"
      report_unit "$build_run_id" "$unit_key" failed "" "" "$failed_message" || true
      break
    fi
  done <<<"$unit_keys"

  if [ -n "$failed_unit" ]; then
    echo "$failed_message"
    exit 1
  fi
}

start_build_run() {
  require_env JUANIE_REPOSITORY
  require_env JUANIE_SOURCE_SHA
  require_env JUANIE_RELEASE_REF
  require_env JUANIE_IMAGE_REGISTRY
  require_env JUANIE_PROVIDER

  mkdir -p "$state_dir"

  local selected_services_json="${JUANIE_SELECTED_SERVICES_JSON:-}"
  local selected_targets_json="${JUANIE_SELECTED_TARGETS_JSON:-}"
  local payload
  payload="$(
    jq -cn \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg sha "$JUANIE_SOURCE_SHA" \
      --arg ref "$JUANIE_RELEASE_REF" \
      --arg registry "$JUANIE_IMAGE_REGISTRY" \
      --arg provider "$JUANIE_PROVIDER" \
      --arg externalRunId "${JUANIE_EXTERNAL_RUN_ID:-}" \
      --arg servicesJson "$selected_services_json" \
      --arg targetsJson "$selected_targets_json" \
      '{
        repository: $repository,
        sha: $sha,
        ref: $ref,
        registry: $registry,
        provider: $provider,
        externalRunId: (if $externalRunId == "" then null else $externalRunId end)
      }
      + (if $servicesJson == "" then {} else {services: ($servicesJson | fromjson)} end)
      + (if $targetsJson == "" then {} else {targets: ($targetsJson | fromjson)} end)'
  )"

  local response
  response="$(request_json POST /api/build-runs "$payload")"
  local secret_access_token
  secret_access_token="$(jq -r '.secretAccessToken // empty' <<<"$response")"
  [ -n "$secret_access_token" ] || {
    echo 'Juanie did not return a build secret capability'
    exit 1
  }
  printf '%s' "$secret_access_token" > "${state_dir}/secret-access-token"
  chmod 600 "${state_dir}/secret-access-token"
  jq 'del(.secretAccessToken)' <<<"$response" | tee "$build_run_file"

  jq -c '.plan.units' "$build_run_file" > "$units_file"
  jq -c '.plan.groups' "$build_run_file" > "$groups_file"
  jq -c '[.plan.units[].outputs[] | select(.kind == "image") | {name: .service, image}]' "$build_run_file" \
    > "$release_services_file"
  jq -c '[.plan.units[].outputs[] | {name, kind, service, target, image}]' "$build_run_file" \
    > "$build_outputs_file"

  local build_run_id
  build_run_id="$(jq -r '.buildRun.id' "$build_run_file")"
  [ -n "$build_run_id" ] && [ "$build_run_id" != "null" ] || {
    echo 'Juanie did not return a build run id'
    exit 1
  }

  echo "$build_run_id" > "${state_dir}/build-run-id"
}

build_selected_group() {
  require_env JUANIE_BUILD_RUN_ID
  require_env JUANIE_BUILD_GROUP_JSON
  build_group "$JUANIE_BUILD_RUN_ID" "$JUANIE_BUILD_GROUP_JSON"
}

build_all_groups() {
  local build_run_id
  build_run_id="$(cat "${state_dir}/build-run-id")"
  jq -c '.[]' "$groups_file" | while IFS= read -r group; do
    build_group "$build_run_id" "$group"
  done
}

finalize_build_run() {
  local build_run_id="${JUANIE_BUILD_RUN_ID:-}"
  if [ -z "$build_run_id" ]; then
    build_run_id="$(cat "${state_dir}/build-run-id")"
  fi

  local response
  response="$(request_json POST "/api/build-runs/${build_run_id}/finalize")"
  printf '%s\n' "$response" | tee "$release_file"

  local release_id
  local release_path
  release_id="$(jq -r '.release.id' "$release_file")"
  release_path="$(jq -r '.release.releasePath // empty' "$release_file")"

  [ -n "$release_id" ] && [ "$release_id" != "null" ] || {
    echo 'Juanie did not return a release id'
    exit 1
  }

  if [ -n "$release_path" ]; then
    echo "Release detail: ${juanie_base_url}${release_path}"
  fi

  echo "$release_id" > "${state_dir}/release-id"
  printf '%s\n' "$(cat "$release_services_file")" > "${state_dir}/release-services.json"

  for _ in $(seq 1 270); do
    local status_response
    status_response="$(
      curl -fsSL "${juanie_base_url}/api/releases/${release_id}/status" \
        -H "Authorization: Bearer ${JUANIE_TOKEN}"
    )"

    local status
    local status_label
    local resolution
    local error_message
    status="$(printf '%s' "$status_response" | jq -r '.release.status')"
    status_label="$(printf '%s' "$status_response" | jq -r '.release.statusLabel')"
    resolution="$(printf '%s' "$status_response" | jq -r '.release.resolution')"
    error_message="$(printf '%s' "$status_response" | jq -r '.release.error // empty')"

    echo "Juanie release ${release_id}: ${status} (${status_label})"

    case "$resolution" in
      succeeded)
        printf '%s' 'true' > "$artifacts_ready_file"
        return 0
        ;;
      action_required)
        if [ -n "$release_path" ]; then
          echo "Juanie release requires manual action: ${juanie_base_url}${release_path}"
        fi
        if [ "$status" = "awaiting_rollout" ]; then
          printf '%s' 'true' > "$artifacts_ready_file"
        else
          printf '%s' 'false' > "$artifacts_ready_file"
        fi
        return 0
        ;;
      failed)
        [ -n "$error_message" ] && echo "Juanie release failed: ${error_message}"
        return 1
        ;;
    esac

    sleep 10
  done

  echo "Timed out waiting for Juanie release ${release_id}"
  exit 1
}

case "$command" in
  start)
    start_build_run
    ;;
  build-group)
    build_selected_group
    ;;
  build-all)
    build_all_groups
    ;;
  finalize)
    finalize_build_run
    ;;
  *)
    echo "Usage: $0 {start|build-group|build-all|finalize}"
    exit 2
    ;;
esac
