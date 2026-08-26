import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function configureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  if (!database || !user || !password) {
    return;
  }

  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const schema = process.env.POSTGRES_SCHEMA ?? "public";

  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=${encodeURIComponent(schema)}`;
}

configureDatabaseUrl();

export const prisma = new PrismaClient();
