data "external_schema" "drizzle" {
  program = [
    "bunx",
    "drizzle-kit",
    "export",
    "--config",
    "drizzle.schema.config.ts",
  ]
}

env "juanie" {
  url = getenv("ATLAS_DATABASE_URL")
  src = data.external_schema.drizzle.url
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://migrations"
  }
}
