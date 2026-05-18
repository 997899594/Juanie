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
BYTEBASE_EXTERNAL_PG_URL='postgresql://bytebase:***@postgres.example:5432/bytebase?sslmode=require' \
BYTEBASE_HOSTNAME=bytebase.juanie.art \
bash deploy/k8s/scripts/init-server.sh
```

`BYTEBASE_EXTERNAL_PG_URL` should point to a dedicated PostgreSQL database and least-privilege user.
Do not reuse the Juanie control-plane database schema.

After bootstrap, deploy Juanie with:

```yaml
env:
  BYTEBASE_ENABLED: "true"
  BYTEBASE_URL: "https://bytebase.juanie.art"
```

## Free-Edition Guardrail

The current product decision is to use Bytebase Community as the default open-source workbench and
keep paid Enterprise features optional. If a deployment needs JIT access, advanced approval
workflows, dynamic data masking, enterprise SSO, or a larger user/instance quota, the platform
should surface that as an operator decision instead of depending on it for the core release path.
