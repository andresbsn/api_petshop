const fs = require("fs");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const envFile = ".env";

if (!fs.existsSync(envFile)) {
  console.error("No existe .env");
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envFile));
const host = parsed.POSTGRES_HOST || "localhost";
const port = parsed.POSTGRES_PORT || "5432";
const database = parsed.POSTGRES_DB;
const user = parsed.POSTGRES_USER;
const password = parsed.POSTGRES_PASSWORD;
const schema = parsed.POSTGRES_SCHEMA || "public";

if (!database || !user || !password) {
  console.error("Faltan POSTGRES_DB, POSTGRES_USER o POSTGRES_PASSWORD en .env");
  process.exit(1);
}

const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=${encodeURIComponent(schema)}`;
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Uso: node scripts/prisma-from-env.js <comando prisma>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl
  }
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
