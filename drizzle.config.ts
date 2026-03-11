import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local may not exist in production (env vars set externally)
}

const url = process.env.TURSO_DATABASE_URL!;
const isLocal = url.startsWith("file:");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: isLocal ? "sqlite" : "turso",
  dbCredentials: isLocal
    ? { url }
    : { url, authToken: process.env.TURSO_AUTH_TOKEN },
});
