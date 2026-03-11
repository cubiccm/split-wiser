import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL!;
const isLocal = url.startsWith("file:");

const client = createClient({
  url,
  authToken: isLocal ? undefined : process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
