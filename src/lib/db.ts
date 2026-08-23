import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let database: NeonQueryFunction<false, false> | null = null;

export function getDatabase(): NeonQueryFunction<false, false> {
  if (database) {
    return database;
  }

  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  database = neon(connectionString);
  return database;
}
