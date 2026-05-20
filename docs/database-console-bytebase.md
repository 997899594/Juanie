# Bytebase Database Console

Juanie can expose Bytebase Community as the platform database workbench. This is an optional
visual console for browsing schemas, running controlled queries, and investigating runtime data.
It is not a second release or migration control plane.

## Boundary

| Responsibility | Owner |
| --- | --- |
| Environment, release, promotion, rollout state | Juanie |
| Schema Gate, drift detection, repair scaffold, baseline | Juanie + Atlas |
| Repo-tracked application migrations | Child application migration tool |
| Database browsing and SQL workbench | Bytebase |

DDL/DML changes for production must still go through Juanie release, promotion, or Schema Repair.
Bytebase is linked from the database page for operational visibility, not for bypassing delivery
governance.

## Runtime Configuration

Set these on the Juanie chart or local environment:

```bash
BYTEBASE_ENABLED=true
BYTEBASE_URL=https://bytebase.juanie.art
BYTEBASE_SQL_EDITOR_PATH=/sql-editor
BYTEBASE_OIDC_CLIENT_ID=bytebase
BYTEBASE_OIDC_ISSUER=https://juanie.art
```

Juanie does not send users to a blank Bytebase workspace. The database card calls Juanie's
`POST /api/projects/:id/databases/:dbId/console` endpoint first. That endpoint logs in to Bytebase,
configures the Juanie OIDC provider in Bytebase, creates the matching Bytebase project /
environment / instance when missing, syncs the instance, then returns a database-scoped SQL editor
URL.

Juanie exposes the OIDC endpoints Bytebase needs:

- `/.well-known/openid-configuration`
- `/api/oidc/authorize`
- `/api/oidc/token`
- `/api/oidc/userinfo`
- `/api/oidc/jwks`

The browser login identity is the current Juanie user through OIDC. The database connection identity
is still the application database owner from Juanie's managed database connection string.

No separate Bytebase account setup is required for the first run. If
`BYTEBASE_SERVICE_ACCOUNT_EMAIL` / `BYTEBASE_SERVICE_ACCOUNT_KEY` are absent, Juanie derives a stable
platform bootstrap identity from `NEXTAUTH_SECRET`, signs up Bytebase's first admin when needed, and
reuses that identity for future provisioning. Operators may still override it with an explicit
Bytebase automation user.

For first-time Bytebase bootstrapping, set:

```bash
BYTEBASE_BOOTSTRAP_EMAIL=platform@juanie.art
BYTEBASE_BOOTSTRAP_PASSWORD=...
BYTEBASE_BOOTSTRAP_TITLE="Juanie Platform"
```

After the first admin exists, operators may provide a dedicated Bytebase service account /
automation user for `BYTEBASE_SERVICE_ACCOUNT_EMAIL` and `BYTEBASE_SERVICE_ACCOUNT_KEY`, but it is
not required for the default Juanie-managed flow.

Optional custom deep-link template:

```bash
BYTEBASE_DATABASE_URL_TEMPLATE="{workspaceUrl}/projects/{projectName}/environments/{environmentName}/databases/{databaseName}"
```

Supported template keys:

`workspaceUrl`, `sqlEditorUrl`, `projectId`, `projectName`, `environmentId`, `environmentName`,
`databaseId`, `databaseName`, `databaseLabel`, `databaseType`, `host`, `port`, `namespace`,
`serviceName`.

If no template is configured, Juanie opens the database-scoped Bytebase SQL editor URL returned by
the provisioning endpoint.

## Bootstrap

Bytebase is disabled by default. On small single-node installs, use Plan B: install Bytebase as an
on-demand workbench, keep the StatefulSet at `replicas=0`, and store Bytebase metadata in the
existing Juanie control-plane PostgreSQL database with a dedicated `bytebase` database/user.

```bash
BYTEBASE_ENABLED=true \
BYTEBASE_REPLICAS=0 \
BYTEBASE_HOSTNAME=bytebase.juanie.art \
bash deploy/k8s/scripts/init-server.sh
```

Bootstrap renders the official Bytebase chart through a Helm post-renderer because the chart
currently hard-codes the StatefulSet replica count. This keeps Helm as the install owner while
making `replicas=0` the default desired state.

Because Plan B reuses the Juanie control-plane PostgreSQL instance, run the Bytebase bootstrap after
the Juanie chart has created the `postgres` StatefulSet and `juanie-secret`. A fresh cluster should
first run infrastructure bootstrap with Bytebase disabled, deploy Juanie, then run the Bytebase
bootstrap command above.

To start or stop the workbench:

```bash
deploy/k8s/scripts/bytebase-on-demand.sh start
deploy/k8s/scripts/bytebase-on-demand.sh stop
deploy/k8s/scripts/bytebase-on-demand.sh status
```

`start` performs a memory guard by default. Override `BYTEBASE_START_MIN_AVAILABLE_MEMORY_MIB` or
set `BYTEBASE_START_RESOURCE_CHECK_ENABLED=false` only after intentionally accepting the capacity
risk.

The metadata database stores Bytebase users, projects, instance mappings, SQL history, and
settings. It is not a child application database. Bootstrap creates it in the existing Juanie
control-plane PostgreSQL instance by default, using `PLATFORM_DATABASE_*` and
`PLATFORM_DATABASE_PASSWORD_SECRET*` to find the admin connection.

Advanced deployments may override the metadata database:

```bash
BYTEBASE_ENABLED=true \
BYTEBASE_METADATA_DATABASE_URL='postgresql://bytebase:***@postgres.example:5432/bytebase?sslmode=require' \
bash deploy/k8s/scripts/init-server.sh
```

Do not store Bytebase metadata in any child application database. Child application database URLs
are target instances for the workbench; they are not where Bytebase stores its own state.

After bootstrap, expose the Juanie UI entry only when operators are ready to start Bytebase on
demand:

```yaml
env:
  BYTEBASE_ENABLED: "true"
  BYTEBASE_URL: "https://bytebase.juanie.art"
```

## Child Application Databases

Juanie already knows managed and external child application database connection metadata through
the environment/database model. Those databases should be registered into Bytebase as managed
instances with least-privilege credentials. This is intentionally separate from the metadata
database above:

- Bytebase metadata database: one platform-owned database used by Bytebase itself.
- Child application databases: many project/environment databases opened from Juanie as workbench
  targets.

Production access should stay read-first. Schema changes and data-changing operations still return
to Juanie release, promotion, or Schema Repair unless an operator explicitly enables a stronger
Bytebase governance mode.

## Free-Edition Guardrail

The current product decision is to use Bytebase Community as the default open-source workbench and
keep paid Enterprise features optional. If a deployment needs JIT access, advanced approval
workflows, dynamic data masking, enterprise SSO, or a larger user/instance quota, the platform
should surface that as an operator decision instead of depending on it for the core release path.
