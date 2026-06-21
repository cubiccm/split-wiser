/**
 * Whether the server is running as a local dev instance (`pnpm dev:local`),
 * which points at a local sqlite file rather than the remote Turso database.
 *
 * This is the security boundary for the email auth bypass: it can never be
 * true in a production build, so the bypass route is inert outside local dev.
 */
export function isLocalDev() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.TURSO_DATABASE_URL ?? "").startsWith("file:")
  );
}
