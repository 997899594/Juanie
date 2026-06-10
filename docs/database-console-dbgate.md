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
5. reconciles a Gateway API `HTTPRoute` for a dedicated console hostname;
6. returns a short-lived Juanie-signed console URL for that database.

The generated DbGate workspace runs with `SINGLE_CONNECTION`, `SINGLE_DATABASE`, and read-only mode
by default. Database schema changes still go through releases, promotion, repair plans, and Atlas.

## Configuration

```bash
DATABASE_CONSOLE_ENABLED=true
DATABASE_CONSOLE_READONLY=true
DATABASE_CONSOLE_ROUTE_NAMESPACE=juanie
DATABASE_CONSOLE_GATEWAY_SERVICE_NAME=juanie-web
DATABASE_CONSOLE_TOKEN_TTL_SECONDS=3600
DBGATE_HOSTNAME_BASE_DOMAIN=juanie.art
DBGATE_IMAGE=dbgate/dbgate:7.2.0
DBGATE_IDLE_TTL_MINUTES=60
DBGATE_CONSOLE_CLEANUP_SCHEDULE=*/15 * * * *
```

The browser entry is a dedicated database console hostname:

```text
https://dbgate-<database-id>.juanie.art/?token=<signed-session>
```

Gateway API routes that hostname to the Juanie web service. Juanie validates the signed token,
stores a host-only HTTP-only cookie, strips the token from the browser URL, then proxies root-path
DbGate requests to the internal `ClusterIP` service. DbGate itself is not routed directly to the
public gateway.

DbGate workspaces are lightweight and lazy-created. Juanie records the last open timestamp on the
Deployment metadata and the scheduler removes idle DbGate Deployment, Service, Secret, and HTTPRoute
resources after `DBGATE_IDLE_TTL_MINUTES` minutes. Reopening the console recreates the workspace from
the stored database connection context.

## Security Baseline

- DbGate is not used as the source of authorization. Juanie owns authentication, project access, and
  signed console sessions.
- Target connection strings are stored in Kubernetes Secrets, not in browser URLs.
- DbGate uses `SKIP_ALL_AUTH=true` only behind the Juanie host-level server-side gateway.
- `DATABASE_CONSOLE_READONLY=true` is the default.
- DDL/DML governance stays in Atlas-backed release and repair flows.
