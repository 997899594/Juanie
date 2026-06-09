# DbGate Database Console

Juanie uses Atlas as the database migration and drift-control path. The database console is a
separate visual workbench for browsing tables, previewing data, and running operational queries.

## Architecture

| Responsibility | Tool |
| --- | --- |
| Schema as code, migration diff, validation, apply, drift gate | Atlas |
| Visual database browsing and SQL workbench | DbGate Community |
| User auth, project permission, environment/database context | Juanie |

Juanie does not expose a shared DbGate instance. When a user opens a database console, Juanie:

1. validates the current Juanie session and project runtime permission;
2. loads the selected database connection from the control plane;
3. writes the target connection into a Kubernetes Secret;
4. reconciles a single-database DbGate Deployment and ClusterIP Service;
5. returns a Juanie-authenticated proxy URL for that database.

The generated DbGate workspace runs with `SINGLE_CONNECTION`, `SINGLE_DATABASE`, and read-only mode
by default. Database schema changes still go through releases, promotion, repair plans, and Atlas.

## Configuration

```bash
DATABASE_CONSOLE_ENABLED=true
DATABASE_CONSOLE_READONLY=true
DBGATE_IMAGE=dbgate/dbgate:7.2.0
DBGATE_IDLE_TTL_MINUTES=60
DBGATE_CONSOLE_CLEANUP_SCHEDULE=*/15 * * * *
```

The browser entry stays under Juanie:

```text
/api/projects/<project-id>/databases/<database-id>/console/proxy/
```

DbGate itself is only exposed as a Kubernetes `ClusterIP` service. It is not routed directly through
Gateway API.

DbGate workspaces are lightweight and lazy-created. Juanie records the last open timestamp on the
Deployment metadata and the scheduler removes idle DbGate Deployment, Service, and Secret resources
after `DBGATE_IDLE_TTL_MINUTES` minutes. Reopening the console recreates the workspace from the
stored database connection context.

## Security Baseline

- DbGate is not used as the source of authorization. Juanie owns authentication and project access.
- Target connection strings are stored in Kubernetes Secrets, not in browser URLs.
- DbGate uses `SKIP_ALL_AUTH=true` only behind the Juanie server-side proxy.
- `DATABASE_CONSOLE_READONLY=true` is the default.
- DDL/DML governance stays in Atlas-backed release and repair flows.
