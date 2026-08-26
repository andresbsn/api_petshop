const fs = require("fs");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const envFile = ".env";
const parsed = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const env = { ...process.env, ...parsed };

const host = env.POSTGRES_HOST || "localhost";
const port = env.POSTGRES_PORT || "5432";
const database = env.POSTGRES_DB;
const user = env.POSTGRES_USER;
const password = env.POSTGRES_PASSWORD;
const schema = env.POSTGRES_SCHEMA || "public";

if (!database || !user || !password) {
  console.error("Faltan POSTGRES_DB, POSTGRES_USER o POSTGRES_PASSWORD");
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
    ...env,
    DATABASE_URL: databaseUrl
  }
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
