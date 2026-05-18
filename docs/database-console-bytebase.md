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
```

Optional deep-link template:

```bash
BYTEBASE_DATABASE_URL_TEMPLATE="{workspaceUrl}/projects/{projectName}/environments/{environmentName}/databases/{databaseName}"
```

Supported template keys:

`workspaceUrl`, `sqlEditorUrl`, `projectId`, `projectName`, `environmentId`, `environmentName`,
`databaseId`, `databaseName`, `databaseLabel`, `databaseType`, `host`, `port`, `namespace`,
`serviceName`.

If no template is configured, Juanie opens the Bytebase SQL editor. This avoids hard-coding a
Bytebase internal route shape and lets operators adjust the link after Bytebase upgrades.

## Bootstrap

Bytebase is disabled by default. To install it with platform bootstrap:

```bash
BYTEBASE_ENABLED=true \
BYTEBASE_HOSTNAME=bytebase.juanie.art \
bash deploy/k8s/scripts/init-server.sh
```

Bootstrap refuses to install Bytebase on small nodes by default. The default guard requires at
least `6144MiB` total memory and `1536MiB` currently available memory because Bytebase plus its
metadata database are long-running platform services, not a lightweight page plugin. Override
`BYTEBASE_MIN_NODE_MEMORY_MIB`, `BYTEBASE_MIN_AVAILABLE_MEMORY_MIB`, or set
`BYTEBASE_RESOURCE_CHECK_ENABLED=false` only after intentionally accepting the capacity risk.

By default bootstrap creates a dedicated CloudNativePG cluster named `bytebase-metadata` in the
Bytebase namespace. This database stores Bytebase users, projects, instance mappings, SQL history,
and settings. It is not a child application database.

Advanced deployments may override the metadata database:

```bash
BYTEBASE_ENABLED=true \
BYTEBASE_METADATA_DATABASE_URL='postgresql://bytebase:***@postgres.example:5432/bytebase?sslmode=require' \
bash deploy/k8s/scripts/init-server.sh
```

Do not reuse the Juanie control-plane database schema or any child application database as the
Bytebase metadata database. Child application database URLs are target instances for the workbench;
they are not where Bytebase stores its own state.

After bootstrap, deploy Juanie with:

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
