import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { neon } from "@neondatabase/serverless";

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

  if (!connectionString) {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");
  }

  const migrationPath = resolve("migrations/001_access_grants.sql");
  const migration = await readFile(migrationPath, "utf8");
  const statements = migration
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const sql = neon(connectionString);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log(`Applied ${statements.length} migration statements.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
