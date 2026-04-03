variable "REGISTRY" {
  default = "ghcr.io"
}

variable "IMAGE_NAME" {
  default = "997899594/juanie"
}

variable "GITHUB_SHA" {
  default = "dev"
}

variable "CACHE_SCOPE" {
  default = "juanie-images"
}

variable "PLATFORM" {
  default = "linux/amd64"
}

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  platforms  = [PLATFORM]
  cache-from = ["type=gha,scope=${CACHE_SCOPE}"]
  cache-to   = ["type=gha,mode=max,scope=${CACHE_SCOPE}"]
}

target "web" {
  inherits = ["_common"]
  target   = "web"
  tags = [
    "${REGISTRY}/${IMAGE_NAME}:web-${GITHUB_SHA}",
    "${REGISTRY}/${IMAGE_NAME}:web-latest",
  ]
}

target "worker" {
  inherits = ["_common"]
  target   = "worker"
  tags = [
    "${REGISTRY}/${IMAGE_NAME}:worker-${GITHUB_SHA}",
    "${REGISTRY}/${IMAGE_NAME}:worker-latest",
  ]
}

target "migrate" {
  inherits = ["_common"]
  target   = "migrate"
  tags = [
    "${REGISTRY}/${IMAGE_NAME}:migrate-${GITHUB_SHA}",
    "${REGISTRY}/${IMAGE_NAME}:migrate-latest",
  ]
}

group "default" {
  targets = ["web", "worker", "migrate"]
}
