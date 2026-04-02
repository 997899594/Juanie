#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PLAN_FILE="$(mktemp)"
trap 'rm -f "$PLAN_FILE"' EXIT

ruby <<'RUBY' >"$PLAN_FILE"
require 'json'
require 'yaml'

config = YAML.load_file('juanie.yaml') || {}
services = Array(config['services'])
service = services.first || raise('juanie.yaml must define at least one service')
build = service['build'] || {}

definition = build['definition']&.to_s
if definition.nil? || definition.empty?
  definition = './docker-bake.hcl' if File.file?('docker-bake.hcl')
  definition ||= './docker-bake.json' if File.file?('docker-bake.json')
end

dockerfile = build['dockerfile']&.to_s
dockerfile = 'Dockerfile' if (dockerfile.nil? || dockerfile.empty?) && File.file?('Dockerfile')

strategy = (build['strategy'] || 'auto').to_s
if strategy == 'auto'
  strategy =
    if definition && !definition.empty?
      'bake'
    elsif dockerfile && !dockerfile.empty?
      'dockerfile'
    else
      'buildpacks'
    end
end

release_services = services.map do |entry|
  name = entry['name'].to_s.strip
  raise 'service.name is required' if name.empty?
  { name: name, image: ENV.fetch('IMAGE_TAG') }
end

puts JSON.generate(
  {
    releaseServices: release_services,
    build: {
      strategy: strategy,
      context: (build['context'] || '.').to_s,
      dockerfile: dockerfile.to_s,
      target: build['target'].to_s,
      definition: definition.to_s,
    },
  }
)
RUBY

BUILD_STRATEGY="$(jq -r '.build.strategy' "$PLAN_FILE")"
BUILD_CONTEXT="$(jq -r '.build.context' "$PLAN_FILE")"
BUILD_DOCKERFILE="$(jq -r '.build.dockerfile' "$PLAN_FILE")"
BUILD_TARGET="$(jq -r '.build.target' "$PLAN_FILE")"
BUILD_DEFINITION="$(jq -r '.build.definition' "$PLAN_FILE")"
RELEASE_SERVICES_JSON="$(jq -c '.releaseServices' "$PLAN_FILE")"

case "$BUILD_STRATEGY" in
  bake)
    if [ -n "$BUILD_TARGET" ]; then
      docker buildx bake \
        --file "$BUILD_DEFINITION" \
        "$BUILD_TARGET" \
        --set "$BUILD_TARGET.tags=$IMAGE_TAG" \
        --set "$BUILD_TARGET.args.GIT_SHA=$GITHUB_SHA" \
        --set "$BUILD_TARGET.cache-from=type=gha" \
        --set "$BUILD_TARGET.cache-to=type=gha,mode=max" \
        --push \
        --progress plain
    else
      docker buildx bake \
        --file "$BUILD_DEFINITION" \
        --set "*.tags=$IMAGE_TAG" \
        --set "*.args.GIT_SHA=$GITHUB_SHA" \
        --set "*.cache-from=type=gha" \
        --set "*.cache-to=type=gha,mode=max" \
        --push \
        --progress plain
    fi
    ;;
  dockerfile)
    docker buildx build \
      --file "$BUILD_DOCKERFILE" \
      --tag "$IMAGE_TAG" \
      --build-arg "GIT_SHA=$GITHUB_SHA" \
      --cache-from "type=gha" \
      --cache-to "type=gha,mode=max" \
      --push \
      "$BUILD_CONTEXT"
    ;;
  buildpacks)
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "$PWD:/workspace" \
      -w /workspace \
      buildpacksio/pack \
      pack build "$IMAGE_TAG" --builder paketobuildpacks/builder-jammy-full --publish
    ;;
  *)
    echo "Unsupported build strategy: $BUILD_STRATEGY"
    exit 1
    ;;
esac

for _ in $(seq 1 36); do
  if docker buildx imagetools inspect "$IMAGE_TAG" >/dev/null 2>&1; then
    break
  fi
  echo "Waiting for image manifest to become visible: $IMAGE_TAG"
  sleep 5
done

docker buildx imagetools inspect "$IMAGE_TAG" >/dev/null 2>&1

release_response="$(
  curl -fsSX POST "https://juanie.art/api/releases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JUANIE_TOKEN:?JUANIE_TOKEN is required}" \
    -d "{
      \"repository\": \"${GITHUB_REPOSITORY}\",
      \"sha\": \"${GITHUB_SHA}\",
      \"ref\": \"${GITHUB_REF}\",
      \"services\": ${RELEASE_SERVICES_JSON}
    }"
)"

echo "$release_response"

release_id="$(printf '%s' "$release_response" | jq -r '.release.id')"
release_path="$(printf '%s' "$release_response" | jq -r '.release.releasePath // empty')"

[ -n "$release_id" ] && [ "$release_id" != "null" ] || {
  echo "Juanie did not return a release id"
  exit 1
}

if [ -n "$release_path" ]; then
  echo "Release detail: https://juanie.art${release_path}"
fi

for _ in $(seq 1 270); do
  status_response="$(
    curl -fsSL "https://juanie.art/api/releases/${release_id}/status" \
      -H "Authorization: Bearer ${JUANIE_TOKEN}"
  )"

  status="$(printf '%s' "$status_response" | jq -r '.release.status')"
  status_label="$(printf '%s' "$status_response" | jq -r '.release.statusLabel')"
  terminal="$(printf '%s' "$status_response" | jq -r '.release.terminal')"
  succeeded="$(printf '%s' "$status_response" | jq -r '.release.succeeded')"
  error_message="$(printf '%s' "$status_response" | jq -r '.release.error // empty')"

  echo "Juanie release ${release_id}: ${status} (${status_label})"

  if [ "$terminal" = "true" ]; then
    [ "$succeeded" = "true" ] && exit 0
    [ -n "$error_message" ] && echo "Juanie release failed: ${error_message}"
    exit 1
  fi

  sleep 10
done

echo "Timed out waiting for Juanie release ${release_id}"
exit 1
