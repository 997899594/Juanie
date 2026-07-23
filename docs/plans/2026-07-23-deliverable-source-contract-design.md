# Deliverable Source Contract

`juanie.yml` remains the only repository-owned Juanie contract. Every customer-facing deliverable
consumes a first-class build-only graph node through `source.target`. Runtime services,
build targets, and deliverables are separate graph concepts, and target references are validated
before a build run is created. The legacy `source.service` shape is not accepted.

The build plan carries the target identity through build, release, and artifact extraction. A
target can use managed builds, Dockerfiles, or Bake definitions without becoming a runtime service.
This keeps deployment topology independent from downloadable artifact topology and gives each
artifact an immutable, independently addressable output.

For repositories without a monorepo package graph, affected selection uses changed paths. An empty
commit therefore produces no build units, no release, and no delivery work. Any ordinary source
change still selects root-scoped services, while `juanie.yml` and CI metadata remain global inputs.

The managed CI runtime owns API error rendering. Every non-successful Juanie response prints the
HTTP status and structured response body to the GitHub Actions log before the job exits. Repository
owners get the exact invalid `juanie.yml` path or control-plane failure without adding workflow
files, secrets, or provider-specific configuration to the application repository.
