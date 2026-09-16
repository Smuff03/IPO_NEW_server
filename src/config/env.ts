import path from "path";
import dotenv from "dotenv";

// Load .env by an absolute path derived from this file's own location, not
// process.cwd(). `dotenv/config`'s default behavior reads relative to cwd,
// which is unreliable under process managers (PM2, systemd, some Windows
// launchers) that can start the process with an unresolved/relative cwd
// (observed: `pm2 env` reporting cwd as literally "."). This works the same
// in dev (running from src/config) and prod (running from dist/config),
// since both sit exactly one level under the project root either way.
const envPath = path.resolve(__dirname, "..", "..", ".env");
const result = dotenv.config({ path: envPath });
if (result.error) {
  // Non-fatal: env vars may be supplied another way (real environment
  // variables, Docker --env-file, etc). Logged so a missing .env is visible
  // at startup instead of silently producing empty RapidAPI keys later.
  // eslint-disable-next-line no-console
  console.warn(`[env] Could not load .env from ${envPath}: ${result.error.message}`);
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail loudly at startup rather than silently using an undefined secret/URL.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  rapidApi: {
    key: process.env.RAPIDAPI_KEY ?? "",
    host: process.env.RAPIDAPI_HOST ?? "indian-ipo-wallah.p.rapidapi.com",
  },
  ipoGuru: {
    apiKey: process.env.IPOGURU_API_KEY ?? "",
  },
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@example.com",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "change_this_password",
  enableCron: (process.env.ENABLE_CRON ?? "true") === "true",
  cron: {
    gmp: process.env.GMP_CRON_SCHEDULE ?? "*/30 * * * *",
    status: process.env.STATUS_CRON_SCHEDULE ?? "*/30 * * * *",
    subscription: process.env.SUBSCRIPTION_CRON_SCHEDULE ?? "*/30 * * * *",
    upcoming: process.env.UPCOMING_CRON_SCHEDULE ?? "0 * * * *",
    articles: process.env.ARTICLES_CRON_SCHEDULE ?? "0 * * * *",
    reviews: process.env.REVIEWS_CRON_SCHEDULE ?? "0 */3 * * *",
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  },
};

void required; // kept for future strict-mode validation of secrets in production