#!/usr/bin/env bash

juanie_base_url="${JUANIE_BASE_URL:-https://juanie.art}"
juanie_oidc_audience='juanie-ci'

require_juanie_identity_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "${name} is required" >&2
    return 1
  fi
}

acquire_ci_oidc_token() {
  case "${JUANIE_EXECUTOR_PROVIDER:-}" in
    github)
      require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_URL
      require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_TOKEN
      local separator='?'
      [[ "$ACTIONS_ID_TOKEN_REQUEST_URL" == *'?'* ]] && separator='&'
      curl -fsSL \
        -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
        "${ACTIONS_ID_TOKEN_REQUEST_URL}${separator}audience=${juanie_oidc_audience}" |
        jq -er '.value'
      ;;
    gitlab|gitlab-self-hosted)
      require_juanie_identity_env JUANIE_OIDC_TOKEN
      printf '%s' "$JUANIE_OIDC_TOKEN"
      ;;
    *)
      echo "Unsupported JUANIE_EXECUTOR_PROVIDER: ${JUANIE_EXECUTOR_PROVIDER:-unset}" >&2
      return 1
      ;;
  esac
}

request_juanie_json() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local payload="${4:-}"
  local response_file
  local http_status
  local curl_args=(
    --silent
    --show-error
    --request "$method"
    --header 'Content-Type: application/json'
  )

  response_file="$(mktemp)"
  curl_args+=(--output "$response_file" --write-out '%{http_code}')
  if [ -n "$token" ]; then
    curl_args+=(--header "Authorization: Bearer ${token}")
  fi
  if [ -n "$payload" ]; then
    curl_args+=(--data-binary "$payload")
  fi

  if ! http_status="$(curl "${curl_args[@]}" "$url")"; then
    [ ! -s "$response_file" ] || cat "$response_file" >&2
    rm -f "$response_file"
    return 1
  fi

  if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    printf 'Juanie API %s %s returned HTTP %s\n' "$method" "$url" "$http_status" >&2
    if jq -e . "$response_file" >/dev/null 2>&1; then
      jq -c . "$response_file" >&2
    else
      cat "$response_file" >&2
    fi
    rm -f "$response_file"
    return 22
  fi

  cat "$response_file"
  rm -f "$response_file"
}

request_juanie_file() {
  local method="$1"
  local url="$2"
  local token="$3"
  local output_file="$4"
  shift 4

  local response_file
  local http_status
  local curl_args=(
    --silent
    --show-error
    --request "$method"
    --header "Authorization: Bearer ${token}"
    --output
  )

  mkdir -p "$(dirname "$output_file")"
  response_file="$(mktemp "${output_file}.download.XXXXXX")"
  curl_args+=("$response_file" --write-out '%{http_code}')

  if ! http_status="$(curl "${curl_args[@]}" "$@" "$url")"; then
    [ ! -s "$response_file" ] || head -c 2000 "$response_file" >&2
    rm -f "$response_file"
    return 1
  fi

  if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    printf 'Juanie API %s %s returned HTTP %s\n' "$method" "$url" "$http_status" >&2
    if jq -e . "$response_file" >/dev/null 2>&1; then
      jq -c . "$response_file" >&2
    else
      head -c 2000 "$response_file" >&2
    fi
    rm -f "$response_file"
    return 22
  fi

  mv "$response_file" "$output_file"
}

download_juanie_source_archive() {
  local token="$1"
  local output_file="$2"
  local base_sha="${3:-}"
  local request_args=(
    --get
    --data-urlencode "repository=${JUANIE_REPOSITORY}"
    --data-urlencode "provider=${JUANIE_PROVIDER}"
    --data-urlencode "ref=${JUANIE_RELEASE_REF}"
    --data-urlencode "sha=${JUANIE_SOURCE_SHA}"
    --data-urlencode "externalRunId=${JUANIE_EXTERNAL_RUN_ID}"
  )

  if [ -n "$base_sha" ]; then
    request_args+=(--data-urlencode "baseSha=${base_sha}")
  fi

  request_juanie_file \
    GET \
    "${juanie_base_url}/api/ci/source/archive" \
    "$token" \
    "$output_file" \
    "${request_args[@]}" || return $?

  if ! gzip -t "$output_file"; then
    rm -f "$output_file"
    echo 'Juanie source archive failed gzip integrity validation' >&2
    return 1
  fi
}

acquire_juanie_ci_token() {
  require_juanie_identity_env JUANIE_REPOSITORY
  require_juanie_identity_env JUANIE_PROVIDER
  require_juanie_identity_env JUANIE_RELEASE_REF
  require_juanie_identity_env JUANIE_SOURCE_SHA
  require_juanie_identity_env JUANIE_EXTERNAL_RUN_ID

  local oidc_token
  local payload
  oidc_token="$(acquire_ci_oidc_token)"
  payload="$(
    printf '%s' "$oidc_token" | jq -Rsc \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg provider "$JUANIE_PROVIDER" \
      --arg ref "$JUANIE_RELEASE_REF" \
      --arg sha "$JUANIE_SOURCE_SHA" \
      --arg beforeSha "${JUANIE_BEFORE_SHA:-}" \
      --arg externalRunId "$JUANIE_EXTERNAL_RUN_ID" \
      '{
        idToken: .,
        provider: $provider,
        repository: $repository,
        ref: $ref,
        sha: $sha,
        beforeSha: (if $beforeSha == "" then null else $beforeSha end),
        externalRunId: $externalRunId
      }'
  )"

  request_juanie_json POST "${juanie_base_url}/api/auth/ci/exchange" '' "$payload" |
    jq -er '.token'
}

juanie_api_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local token
  token="$(acquire_juanie_ci_token)"
  request_juanie_json "$method" "${juanie_base_url}${path}" "$token" "$payload"
}
